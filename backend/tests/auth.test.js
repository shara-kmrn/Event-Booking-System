import test, { before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
process.env.JWT_TTL_SECONDS = '86400';
process.env.JWT_ISSUER = 'eventra-api';
process.env.JWT_AUDIENCE = 'eventra-web';
process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:5173';
process.env.SMTP_HOST = 'smtp.test.invalid';
process.env.FROM_EMAIL = 'auth-tests@eventra.test';
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;
for (const key of Object.keys(process.env)) if (key.startsWith('AUTH_')) delete process.env[key];

const { default: User } = await import('../models/User.js');
const { default: AuthRateLimit } = await import('../models/AuthRateLimit.js');
const { default: Event } = await import('../models/event.js');
const { default: Booking } = await import('../models/booking.js');
const { default: authRoutes } = await import('../routes/authRoutes.js');
const { default: adminRoutes } = await import('../routes/adminRoutes.js');
const { default: eventRoutes } = await import('../routes/eventRoutes.js');
const { default: bookingRoutes } = await import('../routes/bookingRoutes.js');
const { getSecurityConfig, createCorsOptions } = await import('../config/security.js');
const { generateToken } = await import('../utils/authTokens.js');
const { issueOtp } = await import('../utils/authOtp.js');
const { PRIVATE_USER_FIELDS } = await import('../utils/userResponse.js');

const password = 'Audit-Password9!';
const replacement = 'Changed-Password8!';
const databaseName = `eventra_auth_test_${process.pid}_${crypto.randomBytes(5).toString('hex')}`;
let testCaseNumber = 0;
let server;
let base;
let mail = [];
let deliveryFails = false;
const app = express();
app.use(cors(createCorsOptions()));
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/bookings', bookingRoutes);
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  res.status(error.status || 500).json({ message: 'Request rejected.' });
});

before(async () => {
  const uri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017';
  if (!/^mongodb:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|\?|$)/.test(uri)) {
    throw new Error('Integration tests require a loopback MongoDB URI and always choose their own temporary database.');
  }
  try {
    await mongoose.connect(uri, { dbName: databaseName, serverSelectionTimeoutMS: 4000 });
    await Promise.all([User.init(), AuthRateLimit.init(), Event.init(), Booking.init()]);
  } catch {
    throw new Error('Unable to connect to local MongoDB for isolated authentication tests.');
  }
  mock.method(nodemailer, 'createTransport', () => ({
    async sendMail(message) {
      if (deliveryFails) throw new Error('Simulated SMTP failure with private transport details.');
      mail.push(message);
      return { accepted: [message.to] };
    },
  }));
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await mongoose.disconnect();
  await mongoose.connect(process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017', {
    dbName: `${databaseName}_case${++testCaseNumber}`, serverSelectionTimeoutMS: 4000,
  });
  await Promise.all([User.createIndexes(), AuthRateLimit.createIndexes(), Event.createIndexes(), Booking.createIndexes()]);
  mail = [];
  deliveryFails = false;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  // Retain isolated test databases; Phase 2 prohibits destructive database operations.
  await mongoose.disconnect();
  mock.restoreAll();
});

const request = async (path, body, token, options = {}) => {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}), ...options.headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    ...options,
    // Preserve authentication/content headers when extra options are supplied.
    ...(options.headers ? { headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}), ...options.headers } } : {}),
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { throw new Error('Expected JSON response.'); }
  return { status: response.status, data, headers: response.headers };
};
const codeFor = (email) => {
  const message = mail.filter((entry) => entry.to === email).at(-1);
  const code = message?.html.match(/<strong[^>]*>([0-9]{6})<\/strong>/)?.[1];
  assert.ok(code, 'Expected an OTP in captured test email.');
  return code;
};
const safe = (value) => {
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    assert.ok(!PRIVATE_USER_FIELDS.includes(key), `Sensitive user field returned: ${key}`);
    safe(item);
  }
};
const fixture = async (role = 'customer', extra = {}) => User.create({
  name: 'Audit User', email: `${role}@eventra.test`, password, role, isVerified: true, ...extra,
});
const login = (email = 'customer@eventra.test', value = password) =>
  request('/api/auth/login', { email, password: value });
const registration = (role = 'customer') => request('/api/auth/register', {
  firstName: 'Audit', lastName: 'User', name: 'Audit User', email: `${role}@eventra.test`,
  password, role, verificationMethod: 'email',
});
const ageSend = (user, purpose = 'verification') => User.updateOne({ _id: user._id },
  { $set: { [purpose === 'verification' ? 'otpLastSentAt' : 'resetPasswordLastSentAt']: new Date(Date.now() - 61000) } });

test('customer registration stores a hash and returns no OTP or authentication internals', async () => {
  const result = await registration();
  assert.equal(result.status, 201);
  safe(result.data);
  assert.ok(!result.data.token);
  const user = await User.findOne({ email: 'customer@eventra.test' }).select('+password +otp +otpHash');
  assert.equal(user.role, 'customer');
  assert.ok(user.password !== password);
  assert.ok(user.otp === undefined);
  assert.ok(typeof user.otpHash === 'string' && user.otpHash.length === 64);
  assert.ok(user.otpHash !== codeFor(user.email));
});

test('organizer registration preserves organizer role', async () => {
  assert.equal((await registration('organizer')).status, 201);
  assert.equal((await User.findOne({ email: 'organizer@eventra.test' })).role, 'organizer');
});

test('backend rejects missing/invalid registration names, emails, passwords and privileged roles', async () => {
  for (const body of [
    {}, { name: 'A', email: 'a@eventra.test', password },
    { name: 'User', email: { $ne: null }, password },
    { name: 'User', email: 'invalid', password },
    { name: 'User', email: 'a@eventra.test', password: 'weak' },
    { name: 'User', email: 'a@eventra.test', password: 'A1!' + 'a'.repeat(70) },
    { name: 'User', email: 'a@eventra.test', password, role: 'superadmin' },
  ]) assert.equal((await request('/api/auth/register', body)).status, 400);
});

test('valid password login returns a safe user and expiring versioned JWT', async () => {
  await fixture();
  const result = await login(' CUSTOMER@EVENTRA.TEST ');
  assert.equal(result.status, 200);
  safe(result.data);
  const payload = jwt.verify(result.data.token, process.env.JWT_SECRET, {
    algorithms: ['HS256'], issuer: process.env.JWT_ISSUER, audience: process.env.JWT_AUDIENCE,
  });
  assert.equal(payload.sv, 0);
  assert.equal(payload.exp - payload.iat, 86400);
});

test('invalid password and unknown account are rejected consistently', async () => {
  await fixture();
  const invalid = await login(undefined, 'Wrong-Password9!');
  const unknown = await login('missing@eventra.test');
  assert.equal(invalid.status, 401);
  assert.equal(unknown.status, 401);
  assert.deepEqual(invalid.data, unknown.data);
});
test('malformed or missing login credentials return validation errors', async () => {
  for (const body of [{}, { email: 'x', password }, { email: 'a@eventra.test', password: {} }]) {
    assert.equal((await request('/api/auth/login', body)).status, 400);
  }
});

test('valid OTP verifies and atomically invalidates the code', async () => {
  await registration();
  const result = await request('/api/auth/verify-otp', { email: 'customer@eventra.test', otp: codeFor('customer@eventra.test') });
  assert.equal(result.status, 200);
  safe(result.data);
  assert.ok(result.data.token);
  const user = await User.findOne({ email: 'customer@eventra.test' }).select('+otpHash +otp');
  assert.equal(user.isVerified, true);
  assert.ok(!user.otpHash && !user.otp);
});

test('invalid OTP is rejected', async () => {
  await registration();
  const actual = codeFor('customer@eventra.test');
  const wrong = actual === '111111' ? '222222' : '111111';
  assert.equal((await request('/api/auth/verify-otp', { email: 'customer@eventra.test', otp: wrong })).status, 400);
});

test('missing and malformed OTP values are rejected', async () => {
  for (const otp of [undefined, '123', '1234567', { $ne: null }, 'ABCDEF']) {
    assert.equal((await request('/api/auth/verify-otp', { email: 'customer@eventra.test', otp })).status, 400);
  }
});

test('expired verification OTP is rejected', async () => {
  await registration();
  const otp = codeFor('customer@eventra.test');
  await User.updateOne({ email: 'customer@eventra.test' }, { $set: { otpExpires: new Date(Date.now() - 1000) } });
  assert.equal((await request('/api/auth/verify-otp', { email: 'customer@eventra.test', otp })).status, 400);
});

test('used OTP cannot be reused and verified accounts cannot bypass verification', async () => {
  await registration();
  const body = { email: 'customer@eventra.test', otp: codeFor('customer@eventra.test') };
  assert.equal((await request('/api/auth/verify-otp', body)).status, 200);
  const replay = await request('/api/auth/verify-otp', body);
  const bypass = await request('/api/auth/verify-otp', { email: body.email, otp: '123456' });
  assert.equal(replay.status, 400);
  assert.equal(bypass.status, 400);
  assert.ok(!replay.data.token && !bypass.data.token);
});

test('simultaneous verification consumes the OTP only once', async () => {
  await registration();
  const body = { email: 'customer@eventra.test', otp: codeFor('customer@eventra.test') };
  const results = await Promise.all([request('/api/auth/verify-otp', body), request('/api/auth/verify-otp', body)]);
  assert.deepEqual(results.map((entry) => entry.status).sort(), [200, 400]);
});

test('legacy plaintext verification codes require a fresh resend', async () => {
  const user = await fixture('customer', { isVerified: false, otp: '123456', otpExpires: new Date(Date.now() + 60000) });
  assert.equal((await request('/api/auth/verify-otp', { email: user.email, otp: '123456' })).status, 400);
  assert.equal((await request('/api/auth/resend-otp', { email: user.email })).status, 200);
  const updated = await User.findById(user._id).select('+otp +otpHash');
  assert.ok(!updated.otp && updated.otpHash);
});

test('unverified password login preserves the verification workflow', async () => {
  await fixture('customer', { isVerified: false });
  const result = await login();
  assert.equal(result.status, 403);
  assert.equal(result.data.requiresVerification, true);
  assert.ok(!result.data.token);
  codeFor('customer@eventra.test');
});

test('verification OTP guessing stops after five reserved attempts', async () => {
  await registration();
  const otp = codeFor('customer@eventra.test');
  const wrong = otp === '111111' ? '222222' : '111111';
  for (let i = 0; i < 5; i++) {
    assert.equal((await request('/api/auth/verify-otp', { email: 'customer@eventra.test', otp: wrong })).status, 400);
  }
  assert.equal((await request('/api/auth/verify-otp', { email: 'customer@eventra.test', otp })).status, 400);
  assert.equal((await User.findOne({ email: 'customer@eventra.test' }).select('+otpAttempts')).otpAttempts, 5);
});

test('resend cooldown is shared by registration, resend and unverified login', async () => {
  await registration();
  const count = mail.length;
  await request('/api/auth/resend-otp', { email: 'customer@eventra.test' });
  await login();
  assert.equal(mail.length, count);
});

test('resend endpoint returns 429 and Retry-After after three account requests', async () => {
  const user = await fixture('customer', { isVerified: false });
  for (let i = 0; i < 3; i++) {
    await ageSend(user);
    assert.equal((await request('/api/auth/resend-otp', { email: user.email })).status, 200);
  }
  const limited = await request('/api/auth/resend-otp', { email: user.email });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
});

test('hourly send cap persists independently of endpoint counters', async () => {
  const user = await fixture('customer', { isVerified: false });
  for (let i = 0; i < 5; i++) {
    await ageSend(user);
    assert.equal(await issueOtp(user, 'verification'), true);
  }
  await ageSend(user);
  assert.equal(await issueOtp(user, 'verification'), false);
  assert.equal(mail.length, 5);
});

test('valid password reset hashes the password, consumes OTP and revokes prior JWTs', async () => {
  const user = await fixture();
  const old = await login();
  await request('/api/auth/forgot-password', { email: user.email });
  const otp = codeFor(user.email);
  const result = await request('/api/auth/reset-password', { email: user.email, otp, newPassword: replacement });
  assert.equal(result.status, 200);
  assert.equal((await request('/api/auth/profile', undefined, old.data.token)).status, 401);
  assert.equal((await login(user.email, replacement)).status, 200);
  assert.equal((await login()).status, 401);
  assert.equal((await request('/api/auth/reset-password', { email: user.email, otp, newPassword: replacement })).status, 400);
});

test('invalid and expired password-reset OTPs are rejected', async () => {
  const user = await fixture();
  await request('/api/auth/forgot-password', { email: user.email });
  const otp = codeFor(user.email);
  const wrong = otp === '111111' ? '222222' : '111111';
  assert.equal((await request('/api/auth/reset-password', { email: user.email, otp: wrong, newPassword: replacement })).status, 400);
  await User.updateOne({ _id: user._id }, { $set: { resetPasswordExpires: new Date(Date.now() - 1000) } });
  assert.equal((await request('/api/auth/reset-password', { email: user.email, otp, newPassword: replacement })).status, 400);
});

test('reset and registration enforce the same password policy', async () => {
  const user = await fixture();
  await request('/api/auth/forgot-password', { email: user.email });
  const otp = codeFor(user.email);
  assert.equal((await request('/api/auth/reset-password', { email: user.email, otp, newPassword: 'weak' })).status, 400);
  assert.equal((await User.findById(user._id).select('+resetPasswordAttempts')).resetPasswordAttempts, 0);
});

test('reset OTP guessing is limited to five attempts', async () => {
  const user = await fixture();
  await request('/api/auth/forgot-password', { email: user.email });
  const otp = codeFor(user.email);
  const wrong = otp === '111111' ? '222222' : '111111';
  for (let i = 0; i < 5; i++) {
    assert.equal((await request('/api/auth/reset-password', { email: user.email, otp: wrong, newPassword: replacement })).status, 400);
  }
  assert.equal((await request('/api/auth/reset-password', { email: user.email, otp, newPassword: replacement })).status, 400);
});

test('forgot-password and resend responses do not disclose account existence', async () => {
  const user = await fixture('customer', { isVerified: false });
  for (const endpoint of ['forgot-password', 'resend-otp']) {
    const known = await request('/api/auth/' + endpoint, { email: user.email });
    const unknown = await request('/api/auth/' + endpoint, { email: 'missing@eventra.test' });
    assert.equal(known.status, 200);
    assert.deepEqual(known.data, unknown.data);
    safe(known.data);
  }
});

test('login rate limit returns 429 after fifteen failed requests', async () => {
  await fixture();
  for (let i = 0; i < 15; i++) assert.equal((await login(undefined, 'Wrong-Password9!')).status, 401);
  assert.equal((await login()).status, 429);
});

test('verification, registration, forgot-password and reset endpoints are rate limited', async () => {
  for (const [endpoint, limit, body] of [
    ['verify-otp', 10, { email: 'missing@eventra.test', otp: '123456' }],
    ['reset-password', 10, { email: 'missing@eventra.test', otp: '123456', newPassword: replacement }],
    ['forgot-password', 3, { email: 'missing@eventra.test' }],
    ['register', 5, { name: 'Audit User', email: 'missing@eventra.test', password }],
  ]) {
    for (let i = 0; i < limit; i++) {
      assert.notEqual((await request('/api/auth/' + endpoint, body)).status, 429);
    }
    assert.equal((await request('/api/auth/' + endpoint, body)).status, 429);
  }
});

test('IP limit applies across distinct emails and ignores untrusted forwarded IPs', async () => {
  for (let i = 0; i < 12; i++) {
    const result = await request('/api/auth/resend-otp', { email: `missing${i}@eventra.test` },
      undefined, { headers: { 'x-forwarded-for': `198.51.100.${i + 1}` } });
    assert.equal(result.status, 200);
  }
  assert.equal((await request('/api/auth/resend-otp', { email: 'another@eventra.test' })).status, 429);
});

test('protected endpoints reject missing, invalid, expired and legacy tokens', async () => {
  const user = await fixture();
  const options = { issuer: process.env.JWT_ISSUER, audience: process.env.JWT_AUDIENCE };
  const expired = jwt.sign({ id: user._id.toString(), sv: 0 }, process.env.JWT_SECRET, { ...options, expiresIn: -1 });
  const legacy = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1d' });
  const noExpiry = jwt.sign({ id: user._id.toString(), sv: 0 }, process.env.JWT_SECRET, options);
  const wrongAlgorithm = jwt.sign({ id: user._id.toString(), sv: 0 }, process.env.JWT_SECRET,
    { ...options, expiresIn: '1d', algorithm: 'HS384' });
  for (const token of [undefined, 'invalid', expired, legacy, noExpiry, wrongAlgorithm]) {
    assert.equal((await request('/api/auth/profile', undefined, token)).status, 401);
  }
});

test('customers cannot access organizer or admin endpoints', async () => {
  await fixture();
  const { data } = await login();
  assert.equal((await request('/api/events/organizer', undefined, data.token)).status, 403);
  assert.equal((await request('/api/admin/users', undefined, data.token)).status, 403);
});

test('organizers cannot access admin endpoints and retain own dashboard access', async () => {
  await fixture('organizer');
  const { data } = await login('organizer@eventra.test');
  assert.equal((await request('/api/admin/users', undefined, data.token)).status, 403);
  assert.equal((await request('/api/events/organizer', undefined, data.token)).status, 200);
});

test('missing accounts cannot use an otherwise valid JWT', async () => {
  const token = generateToken({ _id: new mongoose.Types.ObjectId(), sessionVersion: 0 });
  assert.equal((await request('/api/auth/profile', undefined, token)).status, 401);
});

test('role changes revoke prior sessions and admin responses remain safe', async () => {
  const customer = await fixture();
  const admin = await fixture('superadmin');
  const customerToken = (await login()).data.token;
  const adminToken = generateToken(admin);
  const response = await fetch(base + `/api/admin/users/${customer._id}/role`, {
    method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ role: 'organizer' }),
  });
  assert.equal(response.status, 200);
  safe(await response.json());
  assert.equal((await request('/api/auth/profile', undefined, customerToken)).status, 401);
});

test('profile, admin lists, plan responses and model serialization exclude private auth fields', async () => {
  const user = await fixture('superadmin', { otp: '123456', resetPasswordOtp: '654321' });
  const token = generateToken(user);
  const profile = await request('/api/auth/profile', undefined, token);
  assert.equal(profile.status, 200);
  safe(profile.data);
  const users = await request('/api/admin/users', undefined, token);
  assert.equal(users.status, 200);
  safe(users.data);
  const response = await fetch(base + `/api/admin/organizers/${user._id}/plan`, {
    method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ subscriptionPlan: 'pro' }),
  });
  assert.equal(response.status, 200);
  safe(await response.json());
  const selected = await User.findById(user._id).select('+password +otp +sessionVersion');
  safe(selected.toJSON());
  safe(selected.toObject());
});

test('populated booking customer and organizer never expose auth fields', async () => {
  const customer = await fixture();
  const organizer = await fixture('organizer');
  const event = await Event.create({
    tenantId: organizer._id, title: 'Auth Projection Fixture', description: 'Isolated test fixture.',
    startDateTime: new Date(Date.now() + 3600000), endDateTime: new Date(Date.now() + 7200000),
    date: new Date(Date.now() + 3600000), location: 'Test Venue',
    ticketPrice: 10, totalCapacity: 10, availableTickets: 10,
  });
  const booking = await Booking.create({
    bookingId: 'BKG-TEST', eventId: event._id, tenantId: organizer._id, customerId: customer._id,
    ticketQuantity: 1, totalAmount: 10, platformFee: 0.5, organizerRevenue: 9.5,
    qrToken: 'TEST-TOKEN', qrCodeString: 'TEST-TOKEN',
  });
  const result = await request('/api/bookings/' + booking.bookingId, undefined, generateToken(customer));
  assert.equal(result.status, 200);
  safe(result.data.customerId);
  safe(result.data.tenantId);
  assert.equal(result.data.customerId.name, customer.name);
});

test('SMTP failures return an honest error and never log OTPs or transport details', async () => {
  deliveryFails = true;
  const logs = [];
  const log = mock.method(console, 'log', (...args) => logs.push(args));
  const warn = mock.method(console, 'warn', (...args) => logs.push(args));
  const error = mock.method(console, 'error', (...args) => logs.push(args));
  try {
    const result = await registration();
    assert.equal(result.status, 503);
    safe(result.data);
    assert.ok(!result.data.message.includes('private'));
    assert.equal(logs.length, 0);
    const user = await User.findOne({ email: 'customer@eventra.test' }).select('+otpHash');
    assert.ok(!user.otpHash);
  } finally { log.mock.restore(); warn.mock.restore(); error.mock.restore(); }
});

test('missing SMTP configuration never pretends to send an OTP', async () => {
  const host = process.env.SMTP_HOST;
  delete process.env.SMTP_HOST;
  try {
    assert.equal((await registration()).status, 503);
    assert.equal(await User.countDocuments(), 0);
  } finally { process.env.SMTP_HOST = host; }
});

test('CORS allows configured origins and rejects unexpected origins', async () => {
  const allowed = await request('/api/auth/login', {}, undefined, { headers: { origin: 'http://localhost:5173' } });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  const denied = await request('/api/auth/login', {}, undefined, { headers: { origin: 'https://unexpected.invalid' } });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
});

test('production configuration rejects missing/weak secrets, missing email, and insecure CORS', () => {
  const valid = {
    NODE_ENV: 'production', JWT_SECRET: crypto.randomBytes(48).toString('hex'),
    MONGO_URI: 'mongodb://127.0.0.1/test', CORS_ALLOWED_ORIGINS: 'https://eventra.example',
    SMTP_HOST: 'smtp.example', FROM_EMAIL: 'no-reply@eventra.example',
  };
  assert.ok(getSecurityConfig(valid));
  for (const change of [
    { JWT_SECRET: '' }, { JWT_SECRET: 'short' }, { CORS_ALLOWED_ORIGINS: '' },
    { CORS_ALLOWED_ORIGINS: 'http://eventra.example' }, { CORS_ALLOWED_ORIGINS: 'https://eventra.example/path' },
    { SMTP_HOST: '' }, { FROM_EMAIL: '' }, { JWT_TTL_SECONDS: '0' },
  ]) assert.throws(() => getSecurityConfig({ ...valid, ...change }));
});
