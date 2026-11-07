import { notifyBooking } from './notificationService.js';
import Booking from '../models/booking.js';
import Event from '../models/event.js';
import { stripeGateway, expectsLiveMode } from './stripeGateway.js';
import { BookingError } from '../config/bookingSecurity.js';
import { getSecurityConfig } from '../config/security.js';
import { findBooking, ensureReservation, projectReservation, releasePending } from './bookingService.js';
import { consumeInventory, readReservation, releaseInventory } from './inventoryService.js';

const metadataFor = (booking) => ({
  bookingId: booking._id.toString(), eventId: booking.eventId.toString(), customerId: booking.customerId.toString(),
  locationId: booking.locationId.toString(), ticketTierId: booking.ticketTierId.toString(),
  quantity: String(booking.ticketQuantity),
});
const assertMetadata = (object, booking) => {
  for (const [key, value] of Object.entries(metadataFor(booking))) {
    if (object.metadata?.[key] !== value) throw new BookingError(409, 'Payment does not match this booking.', 'PAYMENT_MISMATCH');
  }
  if (object.livemode !== expectsLiveMode()) throw new BookingError(409, 'Payment environment mismatch.', 'PAYMENT_MISMATCH');
};
const assertAmount = (amount, currency, booking) => {
  if (!Number.isSafeInteger(amount) || amount !== booking.amountCents || currency !== booking.currency) {
    throw new BookingError(409, 'Payment amount or currency does not match the booking.', 'PAYMENT_MISMATCH');
  }
};

export const ensureProviderObject = async (booking) => {
  const stripe = stripeGateway.client();
  booking = await findBooking(booking._id.toString());
  if (!booking.paymentFlow || !booking.paymentParameters) throw new BookingError(409, 'Start payment for this booking first.');
  let object;
  if (booking.paymentFlow === 'checkout') {
    if (booking.stripeCheckoutSessionId) return stripe.checkout.sessions.retrieve(booking.stripeCheckoutSessionId, { expand: ['payment_intent.latest_charge'] });
    object = await stripe.checkout.sessions.create(booking.paymentParameters, { idempotencyKey: `eventra:${booking._id}:checkout` });
    assertMetadata(object, booking);
    if (object.client_reference_id !== booking._id.toString()) throw new BookingError(409, 'Checkout reference mismatch.', 'PAYMENT_MISMATCH');
    const updated = await Booking.findOneAndUpdate({
      _id: booking._id, stripeCheckoutSessionId: { $exists: false }, paymentFlow: 'checkout',
    }, { $set: { stripeCheckoutSessionId: object.id } }, { returnDocument: 'after' });
    if (!updated) {
      const current = await findBooking(booking._id.toString());
      if (current.stripeCheckoutSessionId !== object.id) throw new BookingError(409, 'Checkout binding conflict.', 'PAYMENT_MISMATCH');
    }
  } else {
    if (booking.stripePaymentIntentId) return stripe.paymentIntents.retrieve(booking.stripePaymentIntentId, { expand: ['latest_charge'] });
    object = await stripe.paymentIntents.create(booking.paymentParameters, { idempotencyKey: `eventra:${booking._id}:intent` });
    assertMetadata(object, booking);
    assertAmount(object.amount, object.currency, booking);
    const updated = await Booking.findOneAndUpdate({
      _id: booking._id, stripePaymentIntentId: { $exists: false }, paymentFlow: 'intent',
    }, { $set: { stripePaymentIntentId: object.id } }, { returnDocument: 'after' });
    if (!updated) {
      const current = await findBooking(booking._id.toString());
      if (current.stripePaymentIntentId !== object.id) throw new BookingError(409, 'Payment binding conflict.', 'PAYMENT_MISMATCH');
    }
  }
  return object;
};

export const preparePayment = async (booking, user, flow) => {
  booking = await ensureReservation(booking);
  if (booking.paymentVersion !== 2 || booking.bookingStatus !== 'PENDING' || booking.reservationState !== 'HELD') {
    throw new BookingError(409, 'This booking is not awaiting payment.', 'RESERVATION_EXPIRED');
  }
  if (new Date(booking.reservationExpiresAt) <= new Date()) {
    await releasePending(booking, 'EXPIRED');
    throw new BookingError(409, 'The reservation expired. Start a new booking.', 'RESERVATION_EXPIRED');
  }
  stripeGateway.client();
  const metadata = metadataFor(booking);
  const security = getSecurityConfig();
  const origin = process.env.CLIENT_URL || security.origins[0];
  if (!security.origins.includes(origin)) throw new BookingError(503, 'Payment return URL is not configured.');
  const event = await Event.findById(booking.eventId).select('title');
  if (!event) throw new BookingError(409, 'Event is no longer available.');
  const params = flow === 'checkout' ? {
    mode: 'payment', payment_method_types: ['card'], adaptive_pricing: { enabled: false },
    automatic_tax: { enabled: false }, allow_promotion_codes: false,
    client_reference_id: booking._id.toString(), customer_email: user.email,
    line_items: [
      { price_data: { currency: booking.currency, product_data: { name: `${event.title.slice(0, 200)} - ${booking.ticketType}` },
        unit_amount: Math.round(booking.unitPrice * 100) }, quantity: booking.ticketQuantity },
      ...(booking.platformFee > 0 ? [{ price_data: { currency: booking.currency,
        product_data: { name: 'Platform service fee' }, unit_amount: Math.round(booking.platformFee * 100) }, quantity: 1 }] : []),
    ],
    success_url: `${origin}/my-tickets?booking=${encodeURIComponent(booking.bookingId)}&payment_return=1`,
    cancel_url: `${origin}/my-tickets?booking=${encodeURIComponent(booking.bookingId)}&payment_cancelled=1`,
    metadata, payment_intent_data: { metadata },
    // Stripe's own Checkout minimum is 30 minutes. The local deadline is
    // authoritative and the worker expires open sessions at that deadline.
  } : {
    amount: booking.amountCents, currency: booking.currency, payment_method_types: ['card'],
    metadata, description: `Eventra ${booking.bookingId}`,
  };
  if (flow === 'intent' && booking.amountCents === 0) throw new BookingError(409, 'Use Checkout for a free booking.');
  if (!booking.paymentFlow) {
    await Booking.findOneAndUpdate({ _id: booking._id, bookingStatus: 'PENDING', paymentFlow: { $exists: false } }, {
      $set: { paymentFlow: flow, paymentParameters: params, needsReconciliation: true },
    }, { returnDocument: 'after' });
  }
  booking = await findBooking(booking._id.toString());
  if (booking.paymentFlow !== flow) throw new BookingError(409, 'This booking already uses a different payment flow.', 'PAYMENT_FLOW_CONFLICT');
  const object = await ensureProviderObject(booking);
  const current = await findBooking(booking._id.toString());
  if (current.bookingStatus === 'CONFIRMED') return { booking: current };
  if (current.bookingStatus !== 'PENDING' || new Date(current.reservationExpiresAt) <= new Date()) {
    await synchronizePayment(current);
    throw new BookingError(409, 'The reservation is no longer available.', 'RESERVATION_EXPIRED');
  }
  if (flow === 'checkout') {
    if (object.status !== 'open' || typeof object.url !== 'string' ||
        !/^https:\/\/checkout\.stripe\.com\//.test(object.url)) {
      const synced = await synchronizePayment(current);
      if (synced.bookingStatus === 'CONFIRMED') return { booking: synced };
      throw new BookingError(409, 'Checkout is no longer open. Check your booking status.', 'CHECKOUT_CLOSED');
    }
    return { url: object.url, sessionId: object.id, booking: current };
  }
  if (typeof object.client_secret !== 'string') throw new BookingError(503, 'Payment initialization is incomplete.');
  return { clientSecret: object.client_secret, paymentIntentId: object.id, amount: booking.totalAmount, currency: booking.currency, booking: current };
};

export const trustedPayment = async (booking, { inspectRefunds = false } = {}) => {
  const stripe = stripeGateway.client();
  const object = await ensureProviderObject(booking);
  assertMetadata(object, booking);
  let intent;
  if (booking.paymentFlow === 'checkout') {
    if (object.id !== (await findBooking(booking._id.toString())).stripeCheckoutSessionId ||
        object.client_reference_id !== booking._id.toString() || object.mode !== 'payment') {
      throw new BookingError(409, 'Checkout does not match this booking.', 'PAYMENT_MISMATCH');
    }
    assertAmount(object.amount_total, object.currency, booking);
    if (object.payment_intent) intent = typeof object.payment_intent === 'string' ?
      await stripe.paymentIntents.retrieve(object.payment_intent, { expand: ['latest_charge'] }) : object.payment_intent;
    if (!intent) {
      if (booking.amountCents === 0 && object.status === 'complete' && object.payment_status === 'no_payment_required') {
        return { state: 'paid', intentId: '', amount: 0, currency: booking.currency };
      }
      return { state: object.status === 'expired' ? 'expired' : 'pending', provider: object };
    }
  } else intent = object;
  assertMetadata(intent, booking);
  assertAmount(intent.amount, intent.currency, booking);
  if (!/^pi_[A-Za-z0-9_]+$/.test(intent.id || '')) throw new BookingError(409, 'Invalid Stripe payment reference.', 'PAYMENT_MISMATCH');
  const current = await findBooking(booking._id.toString());
  if (current.stripePaymentIntentId && current.stripePaymentIntentId !== intent.id) {
    throw new BookingError(409, 'Payment reference mismatch.', 'PAYMENT_MISMATCH');
  }
  if (!current.stripePaymentIntentId) {
    await Booking.updateOne({ _id: booking._id, stripePaymentIntentId: { $exists: false } }, { $set: { stripePaymentIntentId: intent.id } });
  }
  if (intent.status === 'succeeded') {
    assertAmount(intent.amount_received, intent.currency, booking);
    const charge = typeof intent.latest_charge === 'string' ? await stripe.charges.retrieve(intent.latest_charge) : intent.latest_charge;
    const chargeIntent = typeof charge?.payment_intent === 'string' ? charge.payment_intent : charge?.payment_intent?.id;
    if (!charge || chargeIntent !== intent.id || charge.paid !== true || charge.captured !== true) {
      throw new BookingError(503, 'Captured payment details are unavailable.', 'PAYMENT_PROOF_UNAVAILABLE');
    }
    assertAmount(charge.amount, charge.currency, booking);
    assertAmount(charge.amount_captured, charge.currency, booking);
    if (!Number.isSafeInteger(charge.amount_refunded) || charge.amount_refunded < 0 || charge.amount_refunded > booking.amountCents) {
      throw new BookingError(409, 'Refund details require payment review.', 'PAYMENT_MISMATCH');
    }
    if (inspectRefunds || charge.amount_refunded > 0 || booking.refundRequested) {
      let refunded = 0, pending = false, cursor;
      do {
        const page = await stripe.refunds.list({ payment_intent: intent.id, limit: 100, ...(cursor ? { starting_after: cursor } : {}) });
        for (const refund of page.data) {
          const reference = typeof refund.payment_intent === 'string' ? refund.payment_intent : refund.payment_intent?.id;
          if (reference !== intent.id || refund.currency !== booking.currency || !Number.isSafeInteger(refund.amount) || refund.amount < 0) {
            throw new BookingError(409, 'Refund reference mismatch.', 'PAYMENT_MISMATCH');
          }
          if (refund.status === 'succeeded') refunded += refund.amount;
          else if (['pending', 'requires_action'].includes(refund.status)) pending = true;
        }
        if (page.has_more && !page.data.length) throw new BookingError(503, 'Refund reconciliation is incomplete.');
        cursor = page.has_more ? page.data.at(-1).id : undefined;
      } while (cursor);
      if (refunded > booking.amountCents) throw new BookingError(409, 'Refund amount mismatch.', 'PAYMENT_MISMATCH');
      if (refunded === booking.amountCents) return { state: 'refunded', refundCents: refunded, intentId: intent.id, currency: intent.currency };
      if (pending || charge.amount_refunded > refunded) return { state: 'refund_pending', refundCents: refunded, intentId: intent.id, currency: intent.currency };
      if (refunded > 0) return { state: 'partial_refund', refundCents: refunded, intentId: intent.id, currency: intent.currency };
    }
    if (booking.paymentFlow === 'checkout' && (object.status !== 'complete' || object.payment_status !== 'paid')) {
      return { state: 'pending', provider: object };
    }
    return { state: 'paid', intentId: intent.id, amount: intent.amount_received, currency: intent.currency };
  }
  if (intent.status === 'canceled') return { state: 'failed', provider: object };
  if (intent.status === 'requires_payment_method' && intent.last_payment_error) return { state: 'failed', provider: object };
  if (booking.paymentFlow === 'checkout' && object.status === 'expired') return { state: 'expired', provider: object };
  return { state: 'pending', provider: object };
};

const finishRefund = async (booking, proof) => {
  if (booking.paymentStatus === 'refunded' && !booking.needsReconciliation) return booking;
  await Booking.updateOne({ _id: booking._id }, { $set: {
    paymentStatus: 'paid', paymentVerifiedAt: new Date(), paymentReviewRequired: true, needsReconciliation: true,
  } });
  if (proof.amount > 0) {
    const stripe = stripeGateway.client();
    const refund = booking.stripeRefundId ? await stripe.refunds.retrieve(booking.stripeRefundId) :
      await stripe.refunds.create({ payment_intent: proof.intentId }, { idempotencyKey: `eventra:${booking._id}:refund` });
    const intentId = typeof refund.payment_intent === 'string' ? refund.payment_intent : refund.payment_intent?.id;
    if (intentId !== proof.intentId || refund.amount !== booking.amountCents || refund.currency !== booking.currency) {
      throw new BookingError(409, 'Refund requires payment review.', 'REFUND_MISMATCH');
    }
    await Booking.updateOne({ _id: booking._id }, { $set: { stripeRefundId: refund.id } });
    if (refund.status !== 'succeeded') throw new BookingError(503, 'Refund is pending provider confirmation.', 'REFUND_PENDING');
  }
  const reservation = await releaseInventory(booking, 'CANCELLED', { consumed: true });
  if (reservation?.status === 'RELEASED') booking = await projectReservation(await findBooking(booking._id.toString()), reservation);
  return Booking.findOneAndUpdate({ _id: booking._id, bookingStatus: { $ne: 'CONFIRMED' } }, {
    $set: { paymentStatus: proof.amount > 0 ? 'refunded' : 'failed', refundedAmount: proof.amount / 100, ticketStatus: 'CANCELLED',
      reservationState: 'RELEASED', providerClosed: true, paymentReviewRequired: false, needsReconciliation: false,
      qrCodeString: `PENDING:${booking._id}` }, $unset: { qrToken: '' },
  }, { returnDocument: 'after' });
};
// Invalidate the pass in the same document used by atomic check-in before
// restoring any unused stock. Already-admitted seats are never put back on sale.
const recordProviderRefund = async (booking, proof) => {
  const full = proof.state === 'refunded';
  if (full && booking.paymentStatus === 'refunded' && !booking.needsReconciliation) return booking;
  const terminal = ['FAILED', 'EXPIRED'].includes(booking.bookingStatus) ? booking.bookingStatus : 'CANCELLED';
  const wasUsed = booking.ticketStatus === 'USED' || booking.isCheckedIn;
  const updated = await Booking.findByIdAndUpdate(booking._id, { $set: {
    bookingStatus: terminal, ticketStatus: 'CANCELLED', refundRequested: true,
    externalRefundDetected: booking.externalRefundDetected || !booking.refundRequested || proof.state === 'partial_refund',
    paymentStatus: full ? 'refunded' : 'paid', refundedAmount: proof.refundCents / 100,
    paymentVerifiedAt: booking.paymentVerifiedAt || new Date(), needsReconciliation: true,
    paymentReviewRequired: !full,
  } }, { returnDocument: 'after' });
  const admitted = wasUsed || updated.isCheckedIn;
  let state = updated.reservationState;
  if (!admitted) {
    const { reservation } = await readReservation(updated);
    if (reservation && reservation.status !== 'RELEASED') {
      await releaseInventory(updated, terminal, { consumed: reservation.status === 'CONSUMED' });
    }
    state = 'RELEASED';
  }
  return Booking.findByIdAndUpdate(updated._id, {
    $set: { reservationState: state, providerClosed: full || proof.state === 'partial_refund',
      needsReconciliation: proof.state === 'refund_pending', qrCodeString: `PENDING:${updated._id}` },
    $unset: { qrToken: '' },
  }, { returnDocument: 'after' });
};

const closeUnpaidProvider = async (booking) => {
  const stripe = stripeGateway.client();
  const object = await ensureProviderObject(booking);
  if (booking.paymentFlow === 'checkout') {
    if (object.status === 'open') await stripe.checkout.sessions.expire(object.id, {}, { idempotencyKey: `eventra:${booking._id}:expire` });
    else if (object.status !== 'expired') throw new BookingError(503, 'Payment closure is awaiting reconciliation.');
  } else if (object.status !== 'canceled') {
    const cancelled = await stripe.paymentIntents.cancel(object.id, {}, { idempotencyKey: `eventra:${booking._id}:cancel` });
    if (cancelled.status !== 'canceled') throw new BookingError(503, 'Payment closure is awaiting reconciliation.');
  }
  return Booking.findByIdAndUpdate(booking._id, { $set: { providerClosed: true, needsReconciliation: false, paymentStatus: 'failed' } }, { returnDocument: 'after' });
};

const synchronizePaymentState = async (original, { refresh = false, inspectRefunds = false } = {}) => {
  let booking = await findBooking(original._id.toString());
  if (booking.paymentVersion !== 2) return booking;
  let { reservation } = await readReservation(booking);
  if (reservation?.status === 'CONSUMED' && !booking.refundRequested) {
    booking = await projectReservation(booking, reservation);
    if (booking.bookingStatus === 'CONFIRMED' && !refresh) return booking;
  }
  if (booking.bookingStatus === 'PENDING') {
    if (new Date(booking.reservationExpiresAt) <= new Date()) booking = await releasePending(booking, 'EXPIRED');
    else booking = await ensureReservation(booking);
  }
  if (booking.bookingStatus === 'CONFIRMED' && !booking.refundRequested && !refresh) return booking;
  if (!booking.paymentFlow) {
    if (booking.bookingStatus !== 'PENDING') return Booking.findByIdAndUpdate(booking._id,
      { $set: { providerClosed: true, needsReconciliation: false, paymentStatus: 'failed' } }, { returnDocument: 'after' });
    return booking;
  }
  let proof;
  try { proof = await trustedPayment(booking, { inspectRefunds }); }
  catch (error) {
    if (error instanceof BookingError && error.code === 'PAYMENT_MISMATCH') {
      await Booking.updateOne({ _id: booking._id }, { $set: { paymentReviewRequired: true, needsReconciliation: true } });
    }
    throw error;
  }
  if (proof.state === 'refunded' || proof.state === 'partial_refund' ||
      (proof.state === 'refund_pending' && (!booking.refundRequested || booking.externalRefundDetected))) {
    return recordProviderRefund(booking, proof);
  }
  if (proof.state === 'refund_pending') throw new BookingError(503, 'Refund is pending provider confirmation.', 'REFUND_PENDING');
  if (proof.state === 'paid' && booking.externalRefundDetected) {
    return Booking.findByIdAndUpdate(booking._id, { $set: { paymentReviewRequired: true, needsReconciliation: false } }, { returnDocument: 'after' });
  }
  if (proof.state === 'paid') {
    if (booking.bookingStatus === 'PENDING') {
      reservation = await consumeInventory(booking, proof);
      if (reservation?.status === 'CONSUMED') return projectReservation(booking, reservation);
      booking = await releasePending(booking, 'EXPIRED');
      if (booking.bookingStatus === 'CONFIRMED') return booking;
    }
    if (booking.bookingStatus === 'CONFIRMED') return booking;
    return finishRefund(await findBooking(booking._id.toString()), proof);
  }
  if (booking.bookingStatus === 'PENDING' && ['failed', 'expired'].includes(proof.state)) {
    booking = await releasePending(booking, proof.state === 'failed' ? 'FAILED' : 'EXPIRED');
    if (booking.bookingStatus === 'CONFIRMED') return booking;
  }
  if (booking.bookingStatus !== 'PENDING') return closeUnpaidProvider(booking);
  return booking;
};

export const cancelPendingPayment = async (booking) => {
  booking = await releasePending(booking, 'CANCELLED');
  if (booking.bookingStatus === 'CONFIRMED') throw new BookingError(409, 'Payment already completed. Contact support for a refund.');
  // Persist the cancellation first; a temporary Stripe outage is retried by maintenance.
  try { return await synchronizePayment(booking); }
  catch (error) {
    if (error instanceof BookingError && error.code === 'PAYMENT_MISMATCH') throw error;
    await Booking.updateOne({ _id: booking._id }, { $set: { needsReconciliation: true } });
    return findBooking(booking._id.toString());
  }
};

export const requestVerifiedRefund = async (booking) => {
  if (booking.externalRefundDetected) throw new BookingError(409, 'Externally initiated or partial refunds require manual provider reconciliation.');
  if (booking.paymentVersion !== 2 || !booking.paymentVerifiedAt || booking.paymentStatus !== 'paid') {
    throw new BookingError(409, 'A verified paid booking is required for a refund.');
  }
  if (!booking.refundRequested) {
    const changed = await Booking.findOneAndUpdate({
      _id: booking._id, bookingStatus: 'CONFIRMED', ticketStatus: 'VALID', isCheckedIn: false,
    }, { $set: { bookingStatus: 'CANCELLED', ticketStatus: 'CANCELLED', refundRequested: true,
      needsReconciliation: true, paymentReviewRequired: true } }, { returnDocument: 'after' });
    if (!changed) throw new BookingError(409, 'Used or closed tickets cannot be refunded through this action.');
    booking = changed;
  }
  try { return await synchronizePayment(booking); }
  catch (error) {
    if (error instanceof BookingError && ['PAYMENT_MISMATCH', 'REFUND_MISMATCH'].includes(error.code)) throw error;
    return findBooking(booking._id.toString());
  }
};

export const synchronizePayment = async (...args) => {
  const booking = await synchronizePaymentState(...args);
  await notifyBooking(booking);
  return booking;
};
