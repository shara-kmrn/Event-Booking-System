import test from 'node:test';
import assert from 'node:assert/strict';
import { canDisplayTicket, isCurrentBooking, bookingStatusMessage, bookingAttempt, validCheckoutUrl } from '../src/api/bookingState.js';

const pass = () => ({ canUseTicket: true, bookingStatus: 'CONFIRMED', paymentStatus: 'paid',
  paymentVerifiedAt: '2030-01-01T10:00:00.000Z', ticketStatus: 'VALID', qrToken: 'TKT-' + 'a'.repeat(64) });

test('pending booking never displays a pass even with a paid label', () => {
  assert.equal(canDisplayTicket({ ...pass(), bookingStatus: 'PENDING' }), false);
});
test('client success labels cannot replace server verification', () => {
  for (const missing of [{ canUseTicket: false }, { paymentVerifiedAt: undefined }, { qrToken: undefined },
    { qrToken: 'PENDING:booking' }, { ticketStatus: 'PENDING' }]) {
    assert.equal(canDisplayTicket({ ...pass(), ...missing }), false);
  }
});
test('verified confirmed pass is visible; used group passes remain marked as used', () => {
  assert.equal(canDisplayTicket(pass()), true);
  assert.equal(canDisplayTicket({ ...pass(), ticketStatus: 'USED', isCheckedIn: true }), true);
  assert.ok(bookingStatusMessage({ ...pass(), isCheckedIn: true }).includes('already been used'));
});
test('failed, expired, cancelled and refunded bookings have no valid QR', () => {
  for (const status of ['FAILED', 'EXPIRED', 'CANCELLED']) assert.equal(canDisplayTicket({ ...pass(), bookingStatus: status }), false);
  assert.equal(canDisplayTicket({ ...pass(), paymentStatus: 'refunded' }), false);
});
test('status text explains pending, expired, failed and refund states', () => {
  assert.ok(bookingStatusMessage({ bookingStatus: 'PENDING' }).includes('pending'));
  assert.ok(bookingStatusMessage({ bookingStatus: 'EXPIRED' }).includes('expired'));
  assert.ok(bookingStatusMessage({ bookingStatus: 'FAILED' }).includes('failed'));
  assert.ok(bookingStatusMessage({ bookingStatus: 'CANCELLED', paymentStatus: 'refunded' }).includes('refunded'));
});
test('ongoing bookings remain current until their end time', () => {
  const now = Date.parse('2030-01-01T11:00:00Z');
  assert.equal(isCurrentBooking({ eventId: { startDateTime: '2030-01-01T10:00:00Z', endDateTime: '2030-01-01T12:00:00Z' } }, now), true);
  assert.equal(isCurrentBooking({ eventId: { endDateTime: '2030-01-01T10:30:00Z' } }, now), false);
});
test('booked location timing takes precedence over a primary event date', () => {
  const now = Date.parse('2030-01-01T11:00:00Z');
  assert.equal(isCurrentBooking({ locationEndDateTime: '2030-01-01T10:00:00Z',
    eventId: { endDateTime: '2030-01-01T12:00:00Z' } }, now), false);
});
test('payment retries reuse the same request key', () => {
  const body = { eventId: 'event', ticketQuantity: 1 };
  const first = bookingAttempt(null, body, () => 'first-key');
  assert.equal(bookingAttempt(first, { ...body }, () => 'unwanted-new-key'), first);
});
test('changing booking selection creates a new request key', () => {
  const first = bookingAttempt(null, { ticketQuantity: 1 }, () => 'first-key');
  const changed = bookingAttempt(first, { ticketQuantity: 2 }, () => 'next-key');
  assert.equal(changed.key, 'next-key');
});
test('redirects accept Stripe HTTPS checkout and reject lookalikes or unsafe URLs', () => {
  assert.equal(validCheckoutUrl('https://checkout.stripe.com/c/pay/test'), true);
  for (const url of ['javascript:alert(1)', 'http://checkout.stripe.com/test',
    'https://checkout.stripe.com.attacker.invalid/test', 'https://user:password@checkout.stripe.com/test', 'invalid']) {
    assert.equal(validCheckoutUrl(url), false);
  }
});
