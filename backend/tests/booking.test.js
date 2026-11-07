import test, { before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import express from 'express';
import Stripe from 'stripe';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:5173';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.STRIPE_SECRET_KEY = 'sk_test_' + crypto.randomBytes(16).toString('hex');
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_' + crypto.randomBytes(16).toString('hex');
process.env.BOOKING_RESERVATION_MINUTES = '30';
process.env.EVENT_TIMEZONE_OFFSET_MINUTES = '330';

const { default: User } = await import('../models/User.js');
const { default: Event } = await import('../models/event.js');
const { default: Booking } = await import('../models/booking.js');
const { default: StripeWebhookEvent } = await import('../models/StripeWebhookEvent.js');
const { default: bookingRoutes } = await import('../routes/bookingRoutes.js');
const { default: paymentRoutes, mountStripeWebhooks } = await import('../routes/paymentRoutes.js');
const { default: eventRoutes } = await import('../routes/eventRoutes.js');
const { default: ticketRoutes } = await import('../routes/ticketRoutes.js');
const { default: adminRoutes } = await import('../routes/adminRoutes.js');
const { stripeGateway } = await import('../services/stripeGateway.js');
const { generateToken } = await import('../utils/authTokens.js');
const { reconcileBookings } = await import('../services/bookingMaintenance.js');
const { requireStripeConfig } = await import('../config/bookingSecurity.js');
const { parseDateTime, parseInstant } = await import('../utils/dateUtils.js');

const databasePrefix = `eventra_booking_test_${process.pid}_${crypto.randomBytes(4).toString('hex')}`;
const uri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017';
let caseNumber = 0;
let server;
let base;
let gateway;
const stripeSdk = new Stripe(process.env.STRIPE_SECRET_KEY);
const makeGateway = () => {
  const sessions = new Map(), intents = new Map(), refunds = new Map(), keys = new Map();
  const calls = { sessions: 0, intents: 0, refunds: 0, expires: 0, cancels: 0 };
  let serial = 0;
  const fake = {
    sessions, intents, refunds, calls, createFails: false, retrieveFails: false, refundPending: false,
    webhooks: stripeSdk.webhooks,
    checkout: { sessions: {
      async create(params, options) {
        if (fake.createFails) throw new Error('Simulated external creation failure.');
        if (keys.has(options.idempotencyKey)) return keys.get(options.idempotencyKey);
        calls.sessions++;
        const object = { id: `cs_test_${++serial}`, object: 'checkout.session', status: 'open',
          mode: 'payment', payment_status: 'unpaid', currency: params.line_items[0].price_data.currency,
          amount_total: params.line_items.reduce((sum, line) => sum + line.price_data.unit_amount * line.quantity, 0),
          metadata: { ...params.metadata }, client_reference_id: params.client_reference_id,
          payment_intent: null, livemode: false, url: `https://checkout.stripe.com/c/pay/cs_test_${serial}` };
        sessions.set(object.id, object); keys.set(options.idempotencyKey, object); return object;
      },
      async retrieve(id) {
        if (fake.retrieveFails) throw new Error('Simulated external outage.');
        if (!sessions.has(id)) throw new Error('Unknown test session.');
        return sessions.get(id);
      },
      async expire(id) {
        if (fake.retrieveFails) throw new Error('Simulated external outage.');
        const object = sessions.get(id);
        if (object.status !== 'open') throw new Error('Session not open.');
        calls.expires++; object.status = 'expired'; return object;
      },
    } },
    paymentIntents: {
      async create(params, options) {
        if (fake.createFails) throw new Error('Simulated external creation failure.');
        if (keys.has(options.idempotencyKey)) return keys.get(options.idempotencyKey);
        calls.intents++;
        const object = { id: `pi_test_${++serial}`, object: 'payment_intent', status: 'requires_payment_method',
          amount: params.amount, amount_received: 0, currency: params.currency,
          metadata: { ...params.metadata }, livemode: false, client_secret: `test_client_secret_${serial}` };
        intents.set(object.id, object); keys.set(options.idempotencyKey, object); return object;
      },
      async retrieve(id) {
        if (fake.retrieveFails) throw new Error('Simulated external outage.');
        if (!intents.has(id)) throw new Error('Unknown test intent.');
        return intents.get(id);
      },
      async cancel(id) {
        if (fake.retrieveFails) throw new Error('Simulated external outage.');
        const object = intents.get(id);
        if (object.status === 'succeeded') throw new Error('Already succeeded.');
        calls.cancels++; object.status = 'canceled'; return object;
      },
    },
    refundsApi: null,
  };
  fake.charges = { async retrieve(id) {
    for (const intent of intents.values()) if (intent.latest_charge?.id === id) return intent.latest_charge;
    throw new Error('Unknown test charge.');
  } };
  fake.refunds = {
    async create(params, options) {
      if (fake.retrieveFails) throw new Error('Simulated external outage.');
      if (keys.has(options.idempotencyKey)) return keys.get(options.idempotencyKey);
      const intent = intents.get(params.payment_intent);
      calls.refunds++;
      const object = { id: `re_test_${++serial}`, payment_intent: intent.id, amount: intent.amount_received,
        currency: intent.currency, status: fake.refundPending ? 'pending' : 'succeeded' };
      refunds.set(object.id, object); keys.set(options.idempotencyKey, object); return object;
    },
    async retrieve(id) {
      const refund = refunds.get(id);
      if (refund?.status === 'succeeded') {
        const intent = intents.get(refund.payment_intent);
        Object.assign(intent.latest_charge, { amount_refunded: refund.amount, refunded: refund.amount === intent.amount });
      }
      return refund;
    },
    async list(params) {
      const data = [...refunds.values()].filter((refund) => refund.payment_intent === params.payment_intent);
      return { data, has_more: false };
    },
  };
  fake.refundRecords = refunds;
  return fake;
};

const app = express();
mountStripeWebhooks(app);
app.use(express.json());
app.use('/api/bookings', bookingRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/admin', adminRoutes);
before(async () => {
  if (!/^mongodb:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|\?|$)/.test(uri)) {
    throw new Error('Tests require loopback MongoDB and select their own isolated databases.');
  }
  mock.method(stripeGateway, 'client', () => {
    requireStripeConfig();
    return gateway;
  });
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => {
  await mongoose.disconnect();
  try {
    await mongoose.connect(uri, { dbName: `${databasePrefix}_case${++caseNumber}`, serverSelectionTimeoutMS: 4000 });
    await Promise.all([User.createIndexes(), Event.createIndexes(), Booking.createIndexes(), StripeWebhookEvent.createIndexes()]);
  } catch { throw new Error('Unable to initialize isolated local MongoDB test database.'); }
  gateway = makeGateway();
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  mock.restoreAll();
  // Deliberately retain isolated test databases: no drop/delete database operations.
});

let userSerial = 0;
const user = (role) => User.create({ name: `Audit ${role}`, email: `user${++userSerial}@eventra.test`,
  password: 'Audit-Password9!', role, isVerified: true });
const seed = async (quantity = 3, overrides = {}) => {
  const [customer, organizer] = await Promise.all([user('customer'), user('organizer')]);
  const start = new Date(Date.now() + 7200000), end = new Date(Date.now() + 10800000);
  const event = await Event.create({
    tenantId: organizer._id, title: 'Phase 2 Test Event', description: 'Isolated booking security fixture.',
    category: 'Conference', startDateTime: start, endDateTime: end, date: start,
    location: 'Test Venue', ticketPrice: 10, totalCapacity: Math.max(1, quantity), availableTickets: quantity,
    status: 'published', isPublished: true, approvalStatus: 'approved',
    locations: [{ name: 'Test Venue', date: start, startDateTime: start, endDateTime: end, ticketTiers: [
      { name: 'General', price: 10, totalQuantity: Math.max(1, quantity), availableQuantity: quantity, soldQuantity: 0 },
    ] }], ...overrides,
  });
  return { customer, organizer, event, location: event.locations[0], tier: event.locations[0]?.ticketTiers[0] };
};
const bodyFor = (fixture, quantity = 1) => ({ eventId: fixture.event._id.toString(),
  locationId: fixture.location._id.toString(), ticketTierId: fixture.tier._id.toString(), ticketQuantity: quantity });
const request = async (path, { user: actor, body, method = body === undefined ? 'GET' : 'POST', key, token } = {}) => {
  const response = await fetch(base + path, { method,
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(actor || token ? { authorization: `Bearer ${token || generateToken(actor)}` } : {}),
      ...(key ? { 'Idempotency-Key': key } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, data: await response.json() };
};
const reserve = async (fixture, quantity = 1, actor = fixture.customer, key = crypto.randomUUID()) => {
  const result = await request('/api/bookings', { user: actor, body: bodyFor(fixture, quantity), key });
  assert.equal(result.status, 201, 'Expected pending reservation creation.');
  return result.data.booking;
};
const checkout = async (fixture, booking) => {
  const result = await request('/api/payment/create-checkout-session', { user: fixture.customer, body: { bookingId: booking._id } });
  assert.equal(result.status, 200, 'Expected Checkout initialization.');
  return result;
};
const completeProvider = async (booking, changes = {}) => {
  const stored = await Booking.findById(booking._id);
  const session = gateway.sessions.get(stored.stripeCheckoutSessionId);
  if (stored.amountCents === 0 && session) {
    Object.assign(session, { status: 'complete', payment_status: 'no_payment_required' }, changes);
    return session;
  }
  let intent;
  if (session) {
    intent = { id: `pi_completed_${crypto.randomBytes(6).toString('hex')}`, object: 'payment_intent',
      amount: session.amount_total, amount_received: session.amount_total, currency: session.currency,
      metadata: { ...session.metadata }, status: 'succeeded', livemode: false };
    gateway.intents.set(intent.id, intent);
    Object.assign(session, { status: 'complete', payment_status: 'paid', payment_intent: intent });
  } else intent = gateway.intents.get(stored.stripePaymentIntentId);
  Object.assign(intent, { status: 'succeeded', amount_received: intent.amount }, changes);
  intent.latest_charge = {
    id: 'ch_test_' + crypto.randomBytes(6).toString('hex'), payment_intent: intent.id,
    amount: intent.amount, amount_captured: intent.amount, amount_refunded: 0,
    currency: intent.currency, paid: true, captured: true, refunded: false,
  };
  return intent;
};
const confirm = (fixture, booking) => request(`/api/bookings/${booking._id}/confirm`, { user: fixture.customer, body: {} });
const paidBooking = async (fixture) => {
  const booking = await reserve(fixture);
  await checkout(fixture, booking); await completeProvider(booking);
  const result = await confirm(fixture, booking);
  assert.equal(result.status, 200); assert.equal(result.data.booking.bookingStatus, 'CONFIRMED');
  return result.data.booking;
};
const stock = (fixture) => Event.findById(fixture.event._id).select('+reservationJournal');
const expired = async (booking) => {
  const deadline = new Date(Date.now() - 1000);
  await Booking.updateOne({ _id: booking._id }, { $set: { reservationExpiresAt: deadline } });
  await Event.updateOne({ _id: booking.eventId }, { $set: { 'reservationJournal.$[reservation].expiresAt': deadline } },
    { arrayFilters: [{ 'reservation.booking': new mongoose.Types.ObjectId(booking._id) }] });
};
const eventFor = (type, object, id = `evt_test_${crypto.randomBytes(6).toString('hex')}`) =>
  ({ id, object: 'event', type, livemode: false, created: Math.floor(Date.now() / 1000), data: { object } });
const webhook = async (event, signature) => {
  const payload = JSON.stringify(event);
  const response = await fetch(base + '/api/payment/webhook', { method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': signature ||
      stripeSdk.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET }) }, body: payload });
  return { status: response.status, data: await response.json() };
};
const checkIn = (fixture, booking, actor = fixture.organizer, eventId = fixture.event._id.toString()) =>
  request('/api/tickets/check-in', { user: actor, body: { eventId, ticketToken: booking.qrToken } });

test('customer can access own pending booking without a QR or internal payment fields', async () => {
  const fixture = await seed();
  const booking = await reserve(fixture);
  const result = await request('/api/bookings/' + booking.bookingId, { user: fixture.customer });
  assert.equal(result.status, 200); assert.equal(result.data.bookingStatus, 'PENDING');
  for (const key of ['qrToken', 'qrCodeString', 'requestKey', 'requestFingerprint', 'paymentParameters', 'stripePaymentIntentId']) {
    assert.ok(!Object.hasOwn(result.data, key), 'Internal booking field must not be returned.');
  }
  assert.equal(result.data.canUseTicket, false);
});
test('other customers cannot read or cancel a booking', async () => {
  const fixture = await seed(), other = await user('customer'), booking = await reserve(fixture);
  assert.equal((await request('/api/bookings/' + booking._id, { user: other })).status, 404);
  assert.equal((await request('/api/bookings/' + booking._id + '/cancel', { user: other, body: {} })).status, 404);
  assert.equal((await request('/api/bookings/' + booking._id + '/confirm', { user: other, body: {} })).status, 404);
});
test('organizer accesses own event bookings but cannot access unrelated bookings', async () => {
  const fixture = await seed(), other = await user('organizer'), booking = await reserve(fixture);
  assert.equal((await request('/api/bookings/' + booking._id, { user: fixture.organizer })).status, 200);
  assert.equal((await request('/api/bookings/' + booking._id, { user: other })).status, 404);
});
test('admin retains booking read access while only customers can initiate payment', async () => {
  const fixture = await seed(), admin = await user('superadmin'), booking = await reserve(fixture);
  assert.equal((await request('/api/bookings/' + booking._id, { user: admin })).status, 200);
  assert.equal((await request('/api/payment/create-checkout-session', { user: admin, body: { bookingId: booking._id } })).status, 403);
});
test('missing/invalid tokens and organizer booking creation are rejected', async () => {
  const fixture = await seed();
  for (const options of [{}, { token: 'invalid' }]) {
    assert.equal((await request('/api/bookings', { ...options, body: bodyFor(fixture), key: crypto.randomUUID() })).status, 401);
  }
  assert.equal((await request('/api/bookings', { user: fixture.organizer, body: bodyFor(fixture), key: crypto.randomUUID() })).status, 403);
});
test('fake client payment success, totals and payment IDs never confirm a booking', async () => {
  const fixture = await seed();
  for (const extra of [{ paymentStatus: 'paid' }, { totalAmount: 1 }, { stripePaymentIntentId: 'pi_fake' }]) {
    assert.equal((await request('/api/bookings', { user: fixture.customer,
      body: { ...bodyFor(fixture), ...extra }, key: crypto.randomUUID() })).status, 400);
  }
  const booking = await reserve(fixture);
  assert.equal((await request('/api/bookings/' + booking._id + '/confirm', { user: fixture.customer, body: { success: true } })).status, 400);
  assert.equal((await Booking.findById(booking._id)).bookingStatus, 'PENDING');
});
test('invalid booking ID and unrelated payment-session access are rejected', async () => {
  const fixture = await seed(), booking = await reserve(fixture), other = await user('customer');
  assert.equal((await request('/api/bookings/not-an-id', { user: fixture.customer })).status, 400);
  assert.equal((await request('/api/payment/create-checkout-session', { user: other, body: { bookingId: booking._id } })).status, 404);
});
test('backend computes the exact subtotal, added fee and charged total', async () => {
  const fixture = await seed();
  const booking = await reserve(fixture, 2);
  assert.equal(booking.subtotal, 20); assert.equal(booking.platformFee, 1);
  assert.equal(booking.organizerRevenue, 20); assert.equal(booking.totalAmount, 21);
  await checkout(fixture, booking);
  const stored = await Booking.findById(booking._id);
  assert.equal(gateway.sessions.get(stored.stripeCheckoutSessionId).amount_total, 2100);
});
test('booking reserves inventory without marking it sold or generating tickets', async () => {
  const fixture = await seed(2), booking = await reserve(fixture);
  const event = await stock(fixture), tier = event.locations[0].ticketTiers[0];
  assert.equal(event.availableTickets, 1); assert.equal(tier.availableQuantity, 1);
  assert.equal(tier.reservedQuantity, 1); assert.equal(tier.soldQuantity, 0);
  assert.equal(event.ticketTypes[0].availableQuantity, 1);
  assert.equal(booking.paymentStatus, 'pending'); assert.equal(booking.ticketStatus, 'PENDING');
});
test('retries and simultaneous requests with the same key reserve only once', async () => {
  const fixture = await seed(2), key = crypto.randomUUID();
  const results = await Promise.all([1, 2].map(() => request('/api/bookings', { user: fixture.customer, body: bodyFor(fixture), key })));
  assert.deepEqual(results.map((value) => value.status), [201, 201]);
  assert.equal(results[0].data.booking._id, results[1].data.booking._id);
  assert.equal(await Booking.countDocuments(), 1);
  assert.equal((await stock(fixture)).reservationJournal.length, 1);
  assert.equal((await stock(fixture)).availableTickets, 1);
});
test('reusing an idempotency key for a different quantity is rejected', async () => {
  const fixture = await seed(), key = crypto.randomUUID();
  await reserve(fixture, 1, fixture.customer, key);
  assert.equal((await request('/api/bookings', { user: fixture.customer, body: bodyFor(fixture, 2), key })).status, 409);
});
test('missing request keys, fractional quantities and excessive quantities are rejected', async () => {
  const fixture = await seed();
  assert.equal((await request('/api/bookings', { user: fixture.customer, body: bodyFor(fixture) })).status, 400);
  for (const quantity of [0, -1, 1.5, 101, '1e2', { $gt: 0 }]) {
    assert.equal((await request('/api/bookings', { user: fixture.customer, body: { ...bodyFor(fixture), ticketQuantity: quantity }, key: crypto.randomUUID() })).status, 400);
  }
});
test('booking above available inventory is rejected', async () => {
  const fixture = await seed(1);
  assert.equal((await request('/api/bookings', { user: fixture.customer, body: bodyFor(fixture, 2), key: crypto.randomUUID() })).status, 409);
  assert.equal((await stock(fixture)).availableTickets, 1);
});
test('two customers competing for the last ticket cannot oversell', async () => {
  const fixture = await seed(1), other = await user('customer');
  const result = await Promise.all([fixture.customer, other].map((actor) =>
    request('/api/bookings', { user: actor, body: bodyFor(fixture), key: crypto.randomUUID() })));
  assert.deepEqual(result.map((value) => value.status).sort(), [201, 409]);
  const event = await stock(fixture);
  assert.equal(event.availableTickets, 0);
  assert.equal(event.locations[0].ticketTiers[0].availableQuantity, 0);
  assert.equal(event.locations[0].ticketTiers[0].reservedQuantity, 1);
});

for (const [label, overrides] of [
  ['unpublished', { isPublished: false, status: 'draft' }],
  ['unapproved', { approvalStatus: 'pending' }],
  ['rejected', { approvalStatus: 'rejected' }],
  ['ongoing', { startDateTime: new Date(Date.now() - 60000) }],
  ['completed', { startDateTime: new Date(Date.now() - 7200000), endDateTime: new Date(Date.now() - 3600000) }],
  ['cancelled', { status: 'cancelled', isCancelled: true }],
  ['inactive', { isActive: false }],
  ['booking closed', { bookingClosesAt: new Date(Date.now() - 1000) }],
  ['sold out event', { availableTickets: 0 }],
]) {
  test(`backend rejects a ${label} event`, async () => {
    const fixture = await seed(2, overrides);
    const result = await request('/api/bookings', { user: fixture.customer, body: bodyFor(fixture), key: crypto.randomUUID() });
    assert.equal(result.status, 409); assert.equal(await Booking.countDocuments(), 0);
  });
}
test('expired ticket tier and invalid location/tier combinations are rejected', async () => {
  const fixture = await seed();
  const invalid = { ...bodyFor(fixture), locationId: new mongoose.Types.ObjectId().toString() };
  assert.equal((await request('/api/bookings', { user: fixture.customer, body: invalid, key: crypto.randomUUID() })).status, 400);
  await Event.updateOne({ _id: fixture.event._id }, { $set: { 'locations.0.ticketTiers.0.expiryDate': new Date(Date.now() - 1000) } });
  assert.equal((await request('/api/bookings', { user: fixture.customer, body: bodyFor(fixture), key: crypto.randomUUID() })).status, 409);
});
test('stock in another tier cannot satisfy a sold-out selected tier', async () => {
  const fixture = await seed(5);
  await Event.updateOne({ _id: fixture.event._id }, { $set: { 'locations.0.ticketTiers.0.availableQuantity': 0 } });
  await Event.updateOne({ _id: fixture.event._id }, {
    $push: { 'locations.0.ticketTiers': { _id: new mongoose.Types.ObjectId(), name: 'Other', price: 20,
      totalQuantity: 5, availableQuantity: 5, soldQuantity: 0 } } });
  assert.equal((await request('/api/bookings', { user: fixture.customer, body: bodyFor(fixture), key: crypto.randomUUID() })).status, 409);
  assert.equal((await stock(fixture)).availableTickets, 5);
});
test('public active listings exclude completed, unpublished and unapproved events', async () => {
  const fixture = await seed();
  for (const update of [{ approvalStatus: 'pending' }, { approvalStatus: 'approved', isPublished: false },
    { isPublished: true, startDateTime: new Date(Date.now() - 3600000), endDateTime: new Date(Date.now() - 1000) }]) {
    await Event.updateOne({ _id: fixture.event._id }, { $set: update });
    for (const path of ['/api/events', '/api/events/upcoming']) assert.equal((await request(path)).data.length, 0);
  }
});
test('published upcoming event is listed without leaking the inventory journal', async () => {
  const fixture = await seed();
  await reserve(fixture);
  const listed = await request('/api/events/upcoming');
  assert.equal(listed.data.length, 1);
  assert.ok(!Object.hasOwn(listed.data[0], 'reservationJournal'));
});
test('Stripe verification confirms once and generates the real group QR only afterward', async () => {
  const fixture = await seed(2), booking = await reserve(fixture);
  await checkout(fixture, booking);
  assert.equal((await confirm(fixture, booking)).data.booking.bookingStatus, 'PENDING');
  await completeProvider(booking);
  const result = await confirm(fixture, booking), confirmed = result.data.booking;
  assert.equal(result.status, 200); assert.equal(confirmed.bookingStatus, 'CONFIRMED');
  assert.equal(confirmed.paymentStatus, 'paid'); assert.equal(confirmed.canUseTicket, true);
  assert.ok(/^TKT-[a-f0-9]{64}$/.test(confirmed.qrToken));
  const again = await confirm(fixture, booking);
  assert.equal(again.data.booking.qrToken, confirmed.qrToken);
  const event = await stock(fixture);
  assert.equal(event.locations[0].ticketTiers[0].soldQuantity, 1);
  assert.equal(event.locations[0].ticketTiers[0].reservedQuantity, 0);
  assert.equal(event.availableTickets, 1);
});
test('duplicate Checkout initiation uses one provider object and one hold', async () => {
  const fixture = await seed(2), booking = await reserve(fixture);
  await checkout(fixture, booking); await checkout(fixture, booking);
  assert.equal(gateway.calls.sessions, 1); assert.equal((await stock(fixture)).availableTickets, 1);
});
test('PaymentIntent flow also waits for trusted Stripe success', async () => {
  const fixture = await seed(), booking = await reserve(fixture);
  const init = await request('/api/payment/create-payment-intent', { user: fixture.customer, body: { bookingId: booking._id } });
  assert.equal(init.status, 200);
  assert.equal(init.data.booking.bookingStatus, 'PENDING'); assert.ok(init.data.clientSecret);
  await completeProvider(booking);
  assert.equal((await confirm(fixture, booking)).data.booking.bookingStatus, 'CONFIRMED');
});
for (const [label, changes] of [
  ['amount', { amount: 1, amount_received: 1 }],
  ['received amount', { amount_received: 1 }],
  ['currency', { currency: 'eur' }],
  ['customer/booking metadata', { metadata: { bookingId: new mongoose.Types.ObjectId().toString() } }],
]) {
  test(`mismatched Stripe ${label} cannot confirm tickets`, async () => {
    const fixture = await seed(), booking = await reserve(fixture);
    await checkout(fixture, booking); await completeProvider(booking, changes);
    assert.equal((await confirm(fixture, booking)).status, 409);
    const stored = await Booking.findById(booking._id);
    assert.equal(stored.bookingStatus, 'PENDING'); assert.ok(!stored.qrToken);
    assert.equal(stored.paymentReviewRequired, true);
  });
}
test('a free tier stays free and is confirmed only after verified free Checkout completion', async () => {
  const fixture = await seed();
  await Event.updateOne({ _id: fixture.event._id }, { $set: { ticketPrice: 20, 'locations.0.ticketTiers.0.price': 0 } });
  const booking = await reserve(fixture);
  assert.equal(booking.totalAmount, 0);
  await checkout(fixture, booking);
  assert.equal((await confirm(fixture, booking)).data.booking.bookingStatus, 'PENDING');
  await completeProvider(booking);
  assert.equal((await confirm(fixture, booking)).data.booking.bookingStatus, 'CONFIRMED');
});
test('valid signed raw webhook confirms a booking and duplicate delivery is harmless', async () => {
  const fixture = await seed(), booking = await reserve(fixture);
  await checkout(fixture, booking); await completeProvider(booking);
  const session = gateway.sessions.get((await Booking.findById(booking._id)).stripeCheckoutSessionId);
  const event = eventFor('checkout.session.completed', session);
  assert.equal((await webhook(event)).status, 200);
  const token = (await Booking.findById(booking._id)).qrToken;
  const duplicate = await webhook(event);
  assert.equal(duplicate.status, 200); assert.equal(duplicate.data.duplicate, true);
  assert.equal((await Booking.findById(booking._id)).qrToken, token);
  assert.equal(await StripeWebhookEvent.countDocuments(), 1);
  assert.equal((await stock(fixture)).locations[0].ticketTiers[0].soldQuantity, 1);
});
test('simultaneous duplicate webhooks do not duplicate stock consumption or passes', async () => {
  const fixture = await seed(2), booking = await reserve(fixture);
  await checkout(fixture, booking); await completeProvider(booking);
  const event = eventFor('checkout.session.completed', gateway.sessions.get((await Booking.findById(booking._id)).stripeCheckoutSessionId));
  const result = await Promise.all([webhook(event), webhook(event)]);
  assert.ok(result.some((value) => value.status === 200));
  assert.ok(result.every((value) => [200, 503].includes(value.status)));
  assert.equal((await webhook(event)).status, 200);
  assert.equal((await stock(fixture)).locations[0].ticketTiers[0].soldQuantity, 1);
  assert.equal(await Booking.countDocuments(), 1);
});
test('invalid signatures, modified payloads and wrong payment mode are rejected', async () => {
  const fixture = await seed(), booking = await reserve(fixture);
  await checkout(fixture, booking); await completeProvider(booking);
  const event = eventFor('checkout.session.completed', gateway.sessions.get((await Booking.findById(booking._id)).stripeCheckoutSessionId));
  assert.equal((await webhook(event, 'invalid')).status, 400);
  const original = JSON.stringify(event);
  const signature = stripeSdk.webhooks.generateTestHeaderString({ payload: original, secret: process.env.STRIPE_WEBHOOK_SECRET });
  assert.equal((await webhook({ ...event, id: 'evt_modified' }, signature)).status, 400);
  assert.equal((await webhook({ ...event, livemode: true })).status, 400);
  assert.equal((await Booking.findById(booking._id)).bookingStatus, 'PENDING');
});
test('failed Stripe payment releases inventory and does not create tickets', async () => {
  const fixture = await seed(1), booking = await reserve(fixture);
  const initialized = await request('/api/payment/create-payment-intent', { user: fixture.customer, body: { bookingId: booking._id } });
  const intent = gateway.intents.get(initialized.data.paymentIntentId);
  intent.last_payment_error = { code: 'card_declined' };
  const result = await webhook(eventFor('payment_intent.payment_failed', intent));
  assert.equal(result.status, 200);
  const stored = await Booking.findById(booking._id);
  assert.equal(stored.bookingStatus, 'FAILED'); assert.ok(!stored.qrToken);
  assert.equal((await stock(fixture)).availableTickets, 1);
});
test('expired Checkout session releases inventory exactly once', async () => {
  const fixture = await seed(1), booking = await reserve(fixture);
  await checkout(fixture, booking);
  const session = gateway.sessions.get((await Booking.findById(booking._id)).stripeCheckoutSessionId);
  session.status = 'expired';
  const event = eventFor('checkout.session.expired', session);
  assert.equal((await webhook(event)).status, 200); assert.equal((await webhook(event)).status, 200);
  assert.equal((await Booking.findById(booking._id)).bookingStatus, 'EXPIRED');
  assert.equal((await stock(fixture)).availableTickets, 1);
});
test('reservation expiry releases stock even during a Stripe outage and recovers later', async () => {
  const fixture = await seed(1), booking = await reserve(fixture);
  await checkout(fixture, booking); await expired(booking);
  gateway.retrieveFails = true;
  assert.equal((await reconcileBookings()).deferred, 1);
  assert.equal((await stock(fixture)).availableTickets, 1);
  assert.equal((await Booking.findById(booking._id)).bookingStatus, 'EXPIRED');
  gateway.retrieveFails = false;
  await reconcileBookings();
  assert.equal((await Booking.findById(booking._id)).needsReconciliation, false);
  assert.equal(gateway.calls.expires, 1);
});
test('late payment after reservation release is refunded instead of consuming resold inventory', async () => {
  const fixture = await seed(1), booking = await reserve(fixture);
  await checkout(fixture, booking); await expired(booking);
  gateway.retrieveFails = true; await reconcileBookings(); gateway.retrieveFails = false;
  const newer = await reserve(fixture);
  await completeProvider(booking);
  const session = gateway.sessions.get((await Booking.findById(booking._id)).stripeCheckoutSessionId);
  const event = eventFor('checkout.session.completed', session);
  assert.equal((await webhook(event)).status, 200); assert.equal((await webhook(event)).status, 200);
  const old = await Booking.findById(booking._id);
  assert.equal(old.bookingStatus, 'EXPIRED'); assert.equal(old.paymentStatus, 'refunded'); assert.ok(!old.qrToken);
  assert.equal(gateway.calls.refunds, 1);
  assert.equal((await stock(fixture)).availableTickets, 0);
  assert.equal((await Booking.findById(newer._id)).bookingStatus, 'PENDING');
});
test('cancelling own pending booking releases stock once', async () => {
  const fixture = await seed(1), booking = await reserve(fixture);
  await checkout(fixture, booking);
  for (let i = 0; i < 2; i++) {
    const result = await request('/api/bookings/' + booking._id + '/cancel', { user: fixture.customer, body: {} });
    assert.equal(result.status, 200);
  }
  assert.equal((await stock(fixture)).availableTickets, 1);
  assert.equal((await Booking.findById(booking._id)).bookingStatus, 'CANCELLED');
});
test('event rejection after reservation prevents confirmation and refunds a received payment', async () => {
  const fixture = await seed(1), booking = await reserve(fixture);
  await checkout(fixture, booking); await completeProvider(booking);
  await Event.updateOne({ _id: fixture.event._id }, { $set: { approvalStatus: 'rejected' } });
  await reconcileBookings();
  const stored = await Booking.findById(booking._id);
  assert.notEqual(stored.bookingStatus, 'CONFIRMED'); assert.equal(stored.paymentStatus, 'refunded');
  assert.equal((await stock(fixture)).availableTickets, 1);
});
test('payment initialization failure is honest and expiry later releases the hold', async () => {
  const fixture = await seed(1), booking = await reserve(fixture);
  gateway.createFails = true;
  const result = await request('/api/payment/create-checkout-session', { user: fixture.customer, body: { bookingId: booking._id } });
  assert.equal(result.status, 503); assert.equal((await Booking.findById(booking._id)).paymentStatus, 'pending');
  await expired(booking);
  await reconcileBookings();
  assert.equal((await stock(fixture)).availableTickets, 1);
});
test('failure after atomic stock reservation is repaired without reserving twice', async () => {
  const fixture = await seed(2), key = crypto.randomUUID();
  const original = Booking.findOneAndUpdate;
  let failed = false;
  const failure = mock.method(Booking, 'findOneAndUpdate', function (...args) {
    if (!failed && args[1]?.$set?.reservationState === 'HELD') { failed = true; throw new Error('Simulated database projection failure.'); }
    return original.apply(this, args);
  });
  try {
    assert.equal((await request('/api/bookings', { user: fixture.customer, body: bodyFor(fixture), key })).status, 503);
  } finally { failure.mock.restore(); }
  const retry = await request('/api/bookings', { user: fixture.customer, body: bodyFor(fixture), key });
  assert.equal(retry.status, 201);
  assert.equal((await stock(fixture)).availableTickets, 1);
  assert.equal((await stock(fixture)).reservationJournal.length, 1);
});
test('failure after verified inventory consumption is repaired without duplicate tickets', async () => {
  const fixture = await seed(2), booking = await reserve(fixture);
  await checkout(fixture, booking); await completeProvider(booking);
  const original = Booking.findOneAndUpdate;
  let failed = false;
  const failure = mock.method(Booking, 'findOneAndUpdate', function (...args) {
    if (!failed && args[1]?.$set?.bookingStatus === 'CONFIRMED') { failed = true; throw new Error('Simulated confirmation projection failure.'); }
    return original.apply(this, args);
  });
  try { assert.equal((await confirm(fixture, booking)).status, 503); }
  finally { failure.mock.restore(); }
  assert.equal((await stock(fixture)).reservationJournal[0].status, 'CONSUMED');
  await reconcileBookings(); await reconcileBookings();
  const stored = await Booking.findById(booking._id);
  assert.equal(stored.bookingStatus, 'CONFIRMED'); assert.ok(stored.qrToken);
  assert.equal((await stock(fixture)).locations[0].ticketTiers[0].soldQuantity, 1);
  assert.equal((await stock(fixture)).availableTickets, 1);
});
test('valid group pass is consumed atomically and rejects a second check-in', async () => {
  const fixture = await seed(), booking = await paidBooking(fixture);
  const first = await checkIn(fixture, booking);
  assert.equal(first.status, 200); assert.equal(first.data.quantity, 1);
  const second = await checkIn(fixture, booking);
  assert.equal(second.status, 409); assert.equal(second.data.code, 'TICKET_USED');
});
test('simultaneous check-ins admit the group only once', async () => {
  const fixture = await seed(), booking = await paidBooking(fixture);
  const results = await Promise.all([checkIn(fixture, booking), checkIn(fixture, booking)]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
});
test('wrong event and unrelated organizer cannot validate a pass', async () => {
  const fixture = await seed(), booking = await paidBooking(fixture), other = await user('organizer');
  assert.equal((await checkIn(fixture, booking, other)).status, 403);
  const event = await Event.create({ ...fixture.event.toObject(), _id: new mongoose.Types.ObjectId(), title: 'Other Event' });
  const wrong = await checkIn(fixture, booking, fixture.organizer, event._id.toString());
  assert.equal(wrong.status, 409); assert.equal(wrong.data.code, 'WRONG_EVENT');
  assert.equal((await Booking.findById(booking._id)).isCheckedIn, false);
});
test('invalid passes, missing event IDs and customer check-in attempts are rejected', async () => {
  const fixture = await seed(), booking = await paidBooking(fixture);
  assert.equal((await checkIn(fixture, { qrToken: 'TKT-' + crypto.randomBytes(32).toString('hex') })).status, 404);
  assert.equal((await request('/api/tickets/verify', { user: fixture.organizer, body: { ticketToken: booking.qrToken } })).status, 400);
  assert.equal((await checkIn(fixture, booking, fixture.customer)).status, 403);
});
for (const status of ['CANCELLED', 'FAILED', 'EXPIRED']) {
  test(`${status.toLowerCase()} bookings cannot be checked in even if a token remains`, async () => {
    const fixture = await seed(), booking = await paidBooking(fixture);
    await Booking.updateOne({ _id: booking._id }, { $set: { bookingStatus: status } });
    assert.equal((await checkIn(fixture, booking)).status, 409);
  });
}
test('unverified legacy paid labels do not grant a valid ticket', async () => {
  const fixture = await seed(), token = 'TKT-' + crypto.randomBytes(32).toString('hex');
  const legacy = await Booking.create({ bookingId: 'BKG-LEGACY001', eventId: fixture.event._id, tenantId: fixture.organizer._id,
    customerId: fixture.customer._id, ticketQuantity: 1, totalAmount: 10, platformFee: 0.5, organizerRevenue: 9.5,
    bookingStatus: 'CONFIRMED', paymentStatus: 'paid', ticketStatus: 'VALID', qrToken: token, qrCodeString: token });
  assert.equal((await checkIn(fixture, { qrToken: token })).status, 409);
  assert.equal((await request('/api/bookings/' + legacy._id, { user: fixture.customer })).data.canUseTicket, false);
});
test('out-of-order failure notification cannot undo a confirmed payment', async () => {
  const fixture = await seed(), booking = await paidBooking(fixture);
  const stored = await Booking.findById(booking._id), intent = gateway.intents.get(stored.stripePaymentIntentId);
  assert.equal((await webhook(eventFor('payment_intent.payment_failed', intent))).status, 200);
  assert.equal((await Booking.findById(booking._id)).bookingStatus, 'CONFIRMED');
});
test('admin refund calls Stripe and releases consumed inventory only after verified refund', async () => {
  const fixture = await seed(1), booking = await paidBooking(fixture), admin = await user('superadmin');
  const result = await request('/api/admin/transactions/' + booking._id + '/refund', { user: admin, body: {}, method: 'PUT' });
  assert.equal(result.status, 200); assert.equal(result.data.booking.paymentStatus, 'refunded');
  assert.equal(gateway.calls.refunds, 1); assert.equal((await stock(fixture)).availableTickets, 1);
  assert.equal((await Booking.findById(booking._id)).bookingStatus, 'CANCELLED');
  assert.notEqual((await checkIn(fixture, booking)).status, 200);
});
test('pending refunds block QR use and release stock only after provider success', async () => {
  const fixture = await seed(1), booking = await paidBooking(fixture), admin = await user('superadmin');
  gateway.refundPending = true;
  assert.equal((await request('/api/admin/transactions/' + booking._id + '/refund', { user: admin, body: {}, method: 'PUT' })).status, 202);
  assert.equal((await stock(fixture)).availableTickets, 0);
  assert.equal((await checkIn(fixture, booking)).status, 409);
  for (const refund of gateway.refundRecords.values()) refund.status = 'succeeded';
  await reconcileBookings();
  assert.equal((await stock(fixture)).availableTickets, 1); assert.equal(gateway.calls.refunds, 1);
});
test('used tickets cannot be refunded by the admin action', async () => {
  const fixture = await seed(), booking = await paidBooking(fixture), admin = await user('superadmin');
  await checkIn(fixture, booking);
  assert.equal((await request('/api/admin/transactions/' + booking._id + '/refund', { user: admin, body: {}, method: 'PUT' })).status, 409);
  assert.equal(gateway.calls.refunds, 0);
});
test('timezone conversion is independent of host timezone and ISO inputs require offsets', () => {
  assert.equal(parseDateTime('2030-01-01', '07:00 PM').toISOString(), '2030-01-01T13:30:00.000Z');
  assert.equal(parseInstant('2030-01-01T19:00:00+05:30').toISOString(), '2030-01-01T13:30:00.000Z');
  for (const value of ['2030-01-01T19:00:00', 'bad']) assert.throws(() => parseInstant(value));
  assert.throws(() => parseDateTime('2030-01-01', '25:99'));
});

test('a second location with spare tickets cannot hide a race on the last selected-tier ticket', async () => {
  const fixture = await seed(1), other = await user('customer');
  await Event.updateOne({ _id: fixture.event._id }, {
    $set: { availableTickets: 21, totalCapacity: 21 },
    $push: { locations: { _id: new mongoose.Types.ObjectId(), name: 'Spare Venue',
      startDateTime: fixture.event.startDateTime, endDateTime: fixture.event.endDateTime,
      ticketTiers: [{ _id: new mongoose.Types.ObjectId(), name: 'Other', price: 20,
        totalQuantity: 20, availableQuantity: 20, reservedQuantity: 0, soldQuantity: 0 }] } },
  });
  const results = await Promise.all([fixture.customer, other].map((actor) =>
    request('/api/bookings', { user: actor, body: bodyFor(fixture), key: crypto.randomUUID() })));
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
  const event = await stock(fixture);
  assert.equal(event.availableTickets, 20);
  assert.equal(event.locations[0].ticketTiers[0].availableQuantity, 0);
  assert.equal(event.locations[1].ticketTiers[0].availableQuantity, 20);
});
test('legacy top-level ticket inventory supports secure reservations and whole-group admission', async () => {
  const fixture = await seed(2);
  const tierId = new mongoose.Types.ObjectId();
  await Event.updateOne({ _id: fixture.event._id }, { $set: { locations: [],
    ticketTypes: [{ _id: tierId, name: 'General', price: 10, totalQuantity: 2, availableQuantity: 2, soldQuantity: 0 }] } });
  fixture.location = { _id: fixture.event._id }; fixture.tier = { _id: tierId };
  const booking = await reserve(fixture, 2);
  await checkout(fixture, booking); await completeProvider(booking);
  const confirmed = (await confirm(fixture, booking)).data.booking;
  assert.equal(confirmed.bookingStatus, 'CONFIRMED');
  assert.equal((await stock(fixture)).ticketTypes[0].soldQuantity, 2);
  assert.equal((await checkIn(fixture, confirmed)).data.quantity, 2);
});
test('missing Stripe configuration returns an error instead of fake success or an unsigned webhook', async () => {
  const fixture = await seed();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  try {
    assert.equal((await request('/api/bookings', { user: fixture.customer, body: bodyFor(fixture), key: crypto.randomUUID() })).status, 503);
    assert.equal((await webhook(eventFor('payment_intent.succeeded', {}), 'invalid')).status, 503);
    assert.equal(await Booking.countDocuments(), 0);
  } finally { process.env.STRIPE_WEBHOOK_SECRET = secret; }
});

test('simultaneous payment confirmation consumes inventory and generates a QR once', async () => {
  const fixture = await seed(2), booking = await reserve(fixture);
  await checkout(fixture, booking); await completeProvider(booking);
  const results = await Promise.all([confirm(fixture, booking), confirm(fixture, booking)]);
  assert.ok(results.every((result) => result.status === 200));
  assert.equal(results[0].data.booking.qrToken, results[1].data.booking.qrToken);
  const event = await stock(fixture);
  assert.equal(event.locations[0].ticketTiers[0].soldQuantity, 1);
  assert.equal(event.availableTickets, 1);
});
test('failure after releasing inventory is recovered without releasing twice', async () => {
  const fixture = await seed(1), booking = await reserve(fixture);
  await checkout(fixture, booking);
  const original = Booking.findOneAndUpdate;
  let failed = false;
  const failure = mock.method(Booking, 'findOneAndUpdate', function (...args) {
    if (!failed && args[1]?.$set?.reservationState === 'RELEASED') { failed = true; throw new Error('Simulated release projection failure.'); }
    return original.apply(this, args);
  });
  try {
    assert.equal((await request('/api/bookings/' + booking._id + '/cancel', { user: fixture.customer, body: {} })).status, 503);
  } finally { failure.mock.restore(); }
  assert.equal((await stock(fixture)).availableTickets, 1);
  await reconcileBookings(); await reconcileBookings();
  assert.equal((await stock(fixture)).availableTickets, 1);
  assert.equal((await Booking.findById(booking._id)).bookingStatus, 'CANCELLED');
});

test('new reservations reclaim expired holds without waiting for the periodic worker', async () => {
  const fixture = await seed(1), old = await reserve(fixture);
  await expired(old);
  const newer = await reserve(fixture);
  assert.notEqual(newer._id, old._id);
  const event = await stock(fixture);
  assert.equal(event.availableTickets, 0);
  assert.equal(event.locations[0].ticketTiers[0].reservedQuantity, 1);
  assert.equal((await Booking.findById(old._id)).bookingStatus, 'EXPIRED');
});
test('retrying an expired idempotent request cannot report a new successful reservation', async () => {
  const fixture = await seed(1), key = crypto.randomUUID();
  const old = await reserve(fixture, 1, fixture.customer, key);
  await expired(old);
  const response = await request('/api/bookings', { user: fixture.customer, body: bodyFor(fixture), key });
  assert.equal(response.status, 409); assert.equal(response.data.code, 'RESERVATION_EXPIRED');
  assert.equal((await stock(fixture)).availableTickets, 1);
});

test('contact fields reject control characters and structured input without reserving inventory', async () => {
  const fixture = await seed();
  for (const invalid of [{ customerName: 'Line' + String.fromCharCode(10) + 'break' },
    { customerEmail: { $ne: null } }, { customerPhone: [] }]) {
    const result = await request('/api/bookings', { user: fixture.customer,
      body: { ...bodyFor(fixture), ...invalid }, key: crypto.randomUUID() });
    assert.equal(result.status, 400);
  }
  assert.equal(await Booking.countDocuments(), 0);
  assert.equal((await stock(fixture)).availableTickets, 3);
});

const providerRefund = async (booking, { amount, status = 'succeeded' } = {}) => {
  const stored = await Booking.findById(booking._id);
  const session = gateway.sessions.get(stored.stripeCheckoutSessionId);
  const intent = gateway.intents.get(stored.stripePaymentIntentId) || session?.payment_intent;
  const refund = { id: 're_external_' + crypto.randomBytes(5).toString('hex'),
    payment_intent: intent.id, amount: amount ?? intent.amount, currency: intent.currency, status, metadata: {} };
  gateway.refundRecords.set(refund.id, refund);
  const refunded = [...gateway.refundRecords.values()].filter((value) =>
    value.payment_intent === intent.id && value.status === 'succeeded').reduce((sum, value) => sum + value.amount, 0);
  Object.assign(intent.latest_charge, { amount_refunded: refunded, refunded: refunded === intent.amount });
  return { intent, refund };
};
test('external full refund invalidates the pass and restores only unused seats once', async () => {
  const fixture = await seed(1), booking = await paidBooking(fixture);
  const { intent } = await providerRefund(booking);
  assert.equal(intent.status, 'succeeded');
  const event = eventFor('charge.refunded', { ...intent.latest_charge, metadata: {} });
  assert.equal((await webhook(event)).status, 200);
  assert.equal((await webhook(event)).status, 200);
  const stored = await Booking.findById(booking._id);
  assert.equal(stored.bookingStatus, 'CANCELLED'); assert.equal(stored.paymentStatus, 'refunded');
  assert.equal(stored.refundedAmount, stored.totalAmount); assert.ok(!stored.qrToken);
  assert.equal((await stock(fixture)).availableTickets, 1); assert.equal(gateway.calls.refunds, 0);
  assert.notEqual((await checkIn(fixture, booking)).status, 200);
});
test('a charge refunded before booking confirmation cannot generate a pass', async () => {
  const fixture = await seed(1), booking = await reserve(fixture);
  await checkout(fixture, booking); await completeProvider(booking); await providerRefund(booking);
  const result = await confirm(fixture, booking);
  assert.equal(result.status, 200); assert.equal(result.data.booking.bookingStatus, 'CANCELLED');
  assert.equal(result.data.booking.paymentStatus, 'refunded'); assert.equal(result.data.booking.canUseTicket, false);
  assert.equal((await stock(fixture)).availableTickets, 1);
});
test('external refund cannot put already-admitted seats back on sale', async () => {
  const fixture = await seed(1), booking = await paidBooking(fixture);
  assert.equal((await checkIn(fixture, booking)).status, 200);
  const { intent } = await providerRefund(booking);
  assert.equal((await webhook(eventFor('charge.refunded', { ...intent.latest_charge, metadata: {} }))).status, 200);
  assert.equal((await stock(fixture)).availableTickets, 0);
  assert.equal((await stock(fixture)).locations[0].ticketTiers[0].soldQuantity, 1);
  assert.equal((await Booking.findById(booking._id)).isCheckedIn, true);
});
test('external partial refund quarantines the group for manual resolution without issuing another refund', async () => {
  const fixture = await seed(1), booking = await paidBooking(fixture);
  const { intent } = await providerRefund(booking, { amount: 100 });
  assert.equal((await webhook(eventFor('charge.refunded', { ...intent.latest_charge, metadata: {} }))).status, 200);
  const stored = await Booking.findById(booking._id);
  assert.equal(stored.bookingStatus, 'CANCELLED'); assert.equal(stored.paymentReviewRequired, true);
  assert.equal(stored.refundedAmount, 1); assert.equal(stored.externalRefundDetected, true);
  assert.equal((await stock(fixture)).availableTickets, 1);
  assert.equal((await confirm(fixture, booking)).data.booking.canUseTicket, false);
  assert.equal(gateway.calls.refunds, 0);
});
test('external pending refund invalidates admission and settles only after provider success', async () => {
  const fixture = await seed(1), booking = await paidBooking(fixture);
  const { intent, refund } = await providerRefund(booking, { status: 'pending' });
  assert.equal((await webhook(eventFor('refund.created', refund))).status, 200);
  let stored = await Booking.findById(booking._id);
  assert.equal(stored.paymentStatus, 'paid'); assert.equal(stored.paymentReviewRequired, true);
  assert.equal(stored.needsReconciliation, true); assert.ok(!stored.qrToken);
  refund.status = 'succeeded';
  Object.assign(intent.latest_charge, { amount_refunded: intent.amount, refunded: true });
  await reconcileBookings();
  stored = await Booking.findById(booking._id);
  assert.equal(stored.paymentStatus, 'refunded'); assert.equal(stored.paymentReviewRequired, false);
  assert.equal((await stock(fixture)).availableTickets, 1); assert.equal(gateway.calls.refunds, 0);
});
test('failed external refunds remain quarantined instead of silently reactivating the pass', async () => {
  const fixture = await seed(1), booking = await paidBooking(fixture);
  const { refund } = await providerRefund(booking, { status: 'pending' });
  await webhook(eventFor('refund.created', refund));
  refund.status = 'failed';
  assert.equal((await webhook(eventFor('refund.failed', refund))).status, 200);
  const stored = await Booking.findById(booking._id);
  assert.equal(stored.bookingStatus, 'CANCELLED'); assert.equal(stored.paymentReviewRequired, true);
  assert.equal(stored.needsReconciliation, false); assert.ok(!stored.qrToken);
  assert.equal(gateway.calls.refunds, 0);
});
