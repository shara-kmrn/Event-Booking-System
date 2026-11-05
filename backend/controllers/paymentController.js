import crypto from 'crypto';
import StripeWebhookEvent from '../models/StripeWebhookEvent.js';
import { BookingError, bookingErrorResponse, mongoId } from '../config/bookingSecurity.js';
import { createPendingBooking, authorizedBooking, findBooking } from '../services/bookingService.js';
import { preparePayment, synchronizePayment, ensureProviderObject } from '../services/paymentService.js';
import { stripeGateway, expectsLiveMode } from '../services/stripeGateway.js';
import { bookingResponse } from '../utils/bookingResponse.js';

const initiate = (flow) => async (req, res) => {
  try {
    const body = req.body || {};
    const booking = body.bookingId ?
      await authorizedBooking(body.bookingId, req.user, { customerOnly: true }) :
      await createPendingBooking(req.user, body, req.get('Idempotency-Key'));
    if (body.bookingId && Object.keys(body).some((key) => key !== 'bookingId')) {
      throw new BookingError(400, 'Payment initiation accepts only the booking ID.');
    }
    const result = await preparePayment(booking, req.user, flow);
    return res.json({ ...result, booking: bookingResponse(result.booking) });
  } catch (error) { return bookingErrorResponse(res, error); }
};
export const createPaymentIntent = initiate('intent');
export const createCheckoutSession = initiate('checkout');

export const applyStripeEvent = async (event) => {
  const supported = [
    'charge.refunded', 'refund.created', 'refund.updated', 'refund.failed',
    'payment_intent.succeeded', 'payment_intent.payment_failed', 'payment_intent.canceled',
    'checkout.session.completed', 'checkout.session.expired',
    'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed',
  ];
  if (!supported.includes(event.type)) return;
  const object = event.data?.object;
  const refundEvent = event.type === 'charge.refunded' || event.type.startsWith('refund.');
  let id = object?.metadata?.bookingId;
  if (refundEvent && !mongoId(id)) {
    const intentId = typeof object?.payment_intent === 'string' ? object.payment_intent : object?.payment_intent?.id;
    if (!/^pi_[A-Za-z0-9_]+$/.test(intentId || '')) return;
    const intent = await stripeGateway.client().paymentIntents.retrieve(intentId);
    id = intent.metadata?.bookingId;
  }
  if (!mongoId(id)) return;
  let booking = await findBooking(id);
  if (booking.paymentVersion !== 2) throw new BookingError(409, 'Legacy payment requires manual review.');
  await ensureProviderObject(booking);
  booking = await findBooking(booking._id.toString());
  if (refundEvent) {
    await synchronizePayment(booking, { refresh: true, inspectRefunds: true });
    return;
  }
  if (event.type.startsWith('checkout.session.')) {
    if (object.id !== booking.stripeCheckoutSessionId) throw new BookingError(409, 'Checkout event reference mismatch.', 'PAYMENT_MISMATCH');
  } else {
    // For Checkout, the PaymentIntent is bound only from Stripe's retrieved session.
    if (!booking.stripePaymentIntentId) await synchronizePayment(booking);
    booking = await findBooking(booking._id.toString());
    if (object.id !== booking.stripePaymentIntentId) throw new BookingError(409, 'Payment event reference mismatch.', 'PAYMENT_MISMATCH');
  }
  await synchronizePayment(booking, { refresh: true });
};

export const handleStripeWebhook = async (req, res) => {
  let event;
  try {
    const stripe = stripeGateway.client();
    if (!Buffer.isBuffer(req.body) || typeof req.headers['stripe-signature'] !== 'string') {
      return res.status(400).json({ message: 'A signed raw Stripe payload is required.' });
    }
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
    if (!/^evt_[A-Za-z0-9_]+$/.test(event.id || '') || event.livemode !== expectsLiveMode()) {
      return res.status(400).json({ message: 'Invalid Stripe event.' });
    }
  } catch (error) {
    return res.status(error instanceof BookingError ? error.status : 400).json({
      message: error instanceof BookingError ? error.message : 'Invalid Stripe webhook signature.',
    });
  }
  try {
    const prior = await StripeWebhookEvent.findById(event.id);
    if (prior?.status === 'PROCESSED') return res.json({ received: true, duplicate: true });
    const now = new Date();
    let lease;
    const leaseToken = crypto.randomUUID();
    try {
      lease = await StripeWebhookEvent.findOneAndUpdate({
        _id: event.id, $or: [{ leaseUntil: { $lte: now } }, { leaseUntil: { $exists: false } }],
        status: { $ne: 'PROCESSED' },
      }, { $set: { type: event.type, status: 'PROCESSING', leaseToken, leaseUntil: new Date(Date.now() + 120000) } },
      { upsert: true, returnDocument: 'after' });
    } catch (error) {
      if (error.code !== 11000) throw error;
      const current = await StripeWebhookEvent.findById(event.id);
      if (current?.status === 'PROCESSED') return res.json({ received: true, duplicate: true });
      return res.status(503).json({ message: 'This Stripe event is already being processed. Retry later.' });
    }
    if (!lease) return res.status(503).json({ message: 'Stripe event processing is busy.' });
    try {
      await applyStripeEvent(event);
      await StripeWebhookEvent.updateOne({ _id: event.id, leaseToken }, {
        $set: { status: 'PROCESSED', processedAt: new Date() }, $unset: { leaseUntil: '', leaseToken: '' },
      });
    } catch (error) {
      await StripeWebhookEvent.updateOne({ _id: event.id, leaseToken }, { $set: { status: 'RETRY', leaseUntil: new Date(0) } });
      throw error;
    }
    return res.json({ received: true });
  } catch (error) { return bookingErrorResponse(res, error); }
};
