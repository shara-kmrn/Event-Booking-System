import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AxiosError } from 'axios';
import API from '../src/api/axios.js';
import { SESSION_CHANGED_EVENT, readToken, saveSession, clearSession, tokenExpiry, logoutSession } from '../src/api/authSession.js';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}
beforeEach(() => {
  globalThis.localStorage = new MemoryStorage();
  globalThis.window = new EventTarget();
});
const sessionToken = (exp) => 'header.' + btoa(JSON.stringify({ exp })).replace(/=/g, '') + '.signature';
const rejection = (config, status = 401) => {
  throw new AxiosError('Request failed.', 'ERR_BAD_REQUEST', config, null, { status, data: {}, headers: {}, config });
};

test('saving a session preserves the profile without duplicating the JWT', () => {
  saveSession({ name: 'Customer', role: 'customer', token: 'private-test-token' }, 'test-token');
  assert.equal(readToken(), 'test-token');
  const user = JSON.parse(localStorage.getItem('user'));
  assert.equal(user.role, 'customer');
  assert.ok(!Object.hasOwn(user, 'token'));
});

test('logout clears storage, frontend user/token state and notifies listeners', () => {
  saveSession({ name: 'Customer' }, 'test-token');
  let user = { name: 'Customer' };
  let token = 'test-token';
  let events = 0;
  window.addEventListener(SESSION_CHANGED_EVENT, () => events++);
  logoutSession((value) => { user = value; }, (value) => { token = value; });
  assert.equal(user, null);
  assert.equal(token, null);
  assert.equal(localStorage.getItem('user'), null);
  assert.equal(readToken(), null);
  assert.equal(events, 1);
});

test('an old session cannot clear a newer login', () => {
  saveSession({ name: 'New Customer' }, 'new-token');
  assert.equal(clearSession('old-token'), false);
  assert.equal(readToken(), 'new-token');
});

test('invalid and expired token metadata is recognized', () => {
  assert.equal(tokenExpiry('invalid'), 0);
  assert.equal(tokenExpiry('header.' + btoa('{}') + '.signature'), 0);
  assert.ok(tokenExpiry(sessionToken(Math.floor(Date.now() / 1000) - 10)) < Date.now());
  assert.ok(tokenExpiry(sessionToken(Math.floor(Date.now() / 1000) + 3600)) > Date.now());
});

test('Axios attaches the current bearer token to profile restoration', async () => {
  saveSession({ name: 'Customer' }, 'test-token');
  const response = await API.get('/auth/profile', { adapter: async (config) => {
    assert.equal(config.headers.Authorization, 'Bearer test-token');
    return { status: 200, data: { name: 'Customer', role: 'customer' }, headers: {}, config };
  } });
  assert.equal(response.data.role, 'customer');
});

test('a protected HTTP 401 clears the current session', async () => {
  saveSession({ name: 'Customer' }, 'test-token');
  await assert.rejects(API.get('/auth/profile', { adapter: (config) => rejection(config) }));
  assert.equal(readToken(), null);
  assert.equal(localStorage.getItem('user'), null);
});

test('a failed public login does not clear another existing session', async () => {
  saveSession({ name: 'Customer' }, 'test-token');
  await assert.rejects(API.post('/auth/login', {}, { adapter: (config) => rejection(config) }));
  assert.equal(readToken(), 'test-token');
});

test('a delayed old-token 401 does not log out a new session', async () => {
  saveSession({ name: 'Old Customer' }, 'old-token');
  await assert.rejects(API.get('/auth/profile', { adapter: (config) => {
    saveSession({ name: 'New Customer' }, 'new-token');
    return rejection(config);
  } }));
  assert.equal(readToken(), 'new-token');
});

test('temporary server failures preserve credentials for retry', async () => {
  saveSession({ name: 'Customer' }, 'test-token');
  await assert.rejects(API.get('/auth/profile', { adapter: (config) => rejection(config, 503) }));
  assert.equal(readToken(), 'test-token');
});
