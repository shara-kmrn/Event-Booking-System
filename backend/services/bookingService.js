import { notifyBooking } from './notificationService.js';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Booking from '../models/booking.js';
import Event from '../models/event.js';
import { BookingError, bookingConfig, mongoId, requireStripeConfig } from '../config/bookingSecurity.js';
import { validEmail } from '../utils/authValidation.js';
import { assertEventEligible, quoteInventory, reserveInventory, readReservation, releaseInventory } from './inventoryService.js';

export const findBooking = async (id) => {
  if (typeof id !== 'string' || (!mongoId(id) && !/^BKG-[A-Za-z0-9_-]{3,80}$/.test(id))) {
    throw new BookingError(400, 'Invalid booking ID.', 'INVALID_BOOKING_ID');
  }
  const booking = await Booking.findOne(mongoId(id) ? { _id: id } : { bookingId: id })
    .select('+requestKey +requestFingerprint +paymentParameters');
  if (!booking) throw new BookingError(404, 'Booking not found.', 'BOOKING_NOT_FOUND');
  return booking;
};
export const authorizeBooking = async (booking, user, { customerOnly = false } = {}) => {
  if (customerOnly) {
    if (user.role !== 'customer' || booking.customerId.toString() !== user._id.toString()) {
      throw new BookingError(404, 'Booking not found.', 'BOOKING_NOT_FOUND');
    }
    return booking;
  }
  if (user.role === 'superadmin') return booking;
  if (user.role === 'customer' && booking.customerId.toString() === user._id.toString()) return booking;
  if (user.role === 'organizer' && booking.tenantId.toString() === user._id.toString() &&
      await Event.exists({ _id: booking.eventId, tenantId: user._id })) return booking;
  throw new BookingError(404, 'Booking not found.', 'BOOKING_NOT_FOUND');
};
export const authorizedBooking = async (id, user, options) => authorizeBooking(await findBooking(id), user, options);

export const projectReservation = async (booking, reservation) => {
  if (!reservation || booking.paymentVersion !== 2) return booking;
  let update;
  let filter = { _id: booking._id, paymentVersion: 2 };
  if (reservation.status === 'CONSUMED') {
    if (booking.bookingStatus !== 'PENDING' || booking.refundRequested) return booking;
    const token = `TKT-${crypto.randomBytes(32).toString('hex')}`;
    filter.bookingStatus = 'PENDING';
    filter.refundRequested = { $ne: true };
    update = { $set: {
      bookingStatus: 'CONFIRMED', paymentStatus: 'paid', paymentVerifiedAt: reservation.verifiedAt,
      reservationState: 'CONSUMED', ticketStatus: 'VALID', qrToken: token, qrCodeString: token,
      needsReconciliation: false, paymentReviewRequired: false,
    } };
  } else if (reservation.status === 'RELEASED') {
    if (booking.bookingStatus === 'CONFIRMED' && !booking.refundRequested) return booking;
    filter.bookingStatus = { $ne: 'CONFIRMED' };
    update = { $set: {
      bookingStatus: reservation.terminalStatus || 'EXPIRED', ticketStatus: 'CANCELLED',
      reservationState: 'RELEASED', qrCodeString: `PENDING:${booking._id}`,
      needsReconciliation: !booking.providerClosed,
      ...(booking.paymentStatus === 'pending' && reservation.terminalStatus === 'FAILED' ? { paymentStatus: 'failed' } : {}),
    }, $unset: { qrToken: '' } };
  } else {
    filter.bookingStatus = 'PENDING';
    update = { $set: { reservationState: 'HELD', needsReconciliation: false } };
  }
  const updated = await Booking.findOneAndUpdate(filter, update, { returnDocument: 'after' })
    .select('+requestKey +requestFingerprint +paymentParameters');
  if (updated) await notifyBooking(updated);
  return updated || findBooking(booking._id.toString());
};

export const ensureReservation = async (booking) => {
  if (booking.paymentVersion !== 2 || booking.bookingStatus !== 'PENDING') return booking;
  let { event, reservation } = await readReservation(booking);
  if (reservation?.status === 'HELD' && new Date(booking.reservationExpiresAt) <= new Date()) return releasePending(booking, 'EXPIRED');
  if (reservation?.status === 'HELD') assertEventEligible(event);
  if (!reservation) {
    if (new Date(booking.reservationExpiresAt) <= new Date()) return releasePending(booking, 'EXPIRED');
    reservation = await reserveInventory(booking);
  }
  return projectReservation(booking, reservation);
};
export const releasePending = async (booking, status) => {
  const current = await findBooking(booking._id.toString());
  if (current.bookingStatus === 'CONFIRMED') throw new BookingError(409, 'This booking is already confirmed.', 'ALREADY_CONFIRMED');
  if (current.paymentVersion !== 2) throw new BookingError(409, 'Legacy bookings require manual payment review.');
  const reservation = await releaseInventory(current, status);
  if (reservation?.status === 'CONSUMED') return projectReservation(current, reservation);
  if (reservation) return projectReservation(current, reservation);
  return await Booking.findOneAndUpdate({ _id: current._id, bookingStatus: 'PENDING' }, {
    $set: { bookingStatus: status, reservationState: 'RELEASED', ticketStatus: 'CANCELLED', needsReconciliation: true,
      ...(status === 'FAILED' ? { paymentStatus: 'failed' } : {}) },
  }, { returnDocument: 'after' }).select('+requestKey +requestFingerprint +paymentParameters') || current;
};

const validatedRequest = (body = {}) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BookingError(400, 'Invalid booking request.');
  const forbidden = ['paymentStatus', 'bookingStatus', 'ticketStatus', 'totalAmount', 'totalPrice', 'unitPrice',
    'platformFee', 'organizerRevenue', 'stripePaymentIntentId', 'stripeCheckoutSessionId', 'qrToken', 'qrCodeString', 'price'];
  if (forbidden.some((key) => Object.hasOwn(body, key))) throw new BookingError(400, 'Payment and price fields must be determined by the server.', 'UNTRUSTED_PAYMENT_DATA');
  if (![body.eventId, body.locationId, body.ticketTierId].every(mongoId)) throw new BookingError(400, 'Valid event, location and ticket type IDs are required.');
  const supplied = body.ticketQuantity ?? body.quantity;
  if (!(typeof supplied === 'number' || (typeof supplied === 'string' && /^[0-9]+$/.test(supplied)))) {
    throw new BookingError(400, 'Ticket quantity must be a whole number.');
  }
  const quantity = Number(supplied);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > bookingConfig().maxTickets) {
    throw new BookingError(400, `Choose between 1 and ${bookingConfig().maxTickets} tickets.`);
  }
  for (const [key, max] of [['customerName', 100], ['customerEmail', 254], ['customerPhone', 32]]) {
    if (body[key] !== undefined && (typeof body[key] !== 'string' || body[key].length > max || /\p{Cc}/u.test(body[key]))) {
      throw new BookingError(400, 'Invalid customer contact details.');
    }
  }
  if (body.customerEmail && !validEmail(body.customerEmail.trim())) throw new BookingError(400, 'A valid contact email is required.');
  return { eventId: body.eventId.toLowerCase(), locationId: body.locationId.toLowerCase(),
    ticketTierId: body.ticketTierId.toLowerCase(), quantity,
    customerName: body.customerName?.trim() || '', customerEmail: body.customerEmail?.trim().toLowerCase() || '',
    customerPhone: body.customerPhone?.trim() || '' };
};

export const createPendingBooking = async (user, body, requestKey) => {
  if (user.role !== 'customer') throw new BookingError(403, 'Only customers can create bookings.');
  if (typeof requestKey !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(requestKey)) {
    throw new BookingError(400, 'A unique Idempotency-Key header is required.', 'IDEMPOTENCY_KEY_REQUIRED');
  }
  const input = validatedRequest(body);
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
  let booking = await Booking.findOne({ customerId: user._id, requestKey, paymentVersion: 2 })
    .select('+requestKey +requestFingerprint +paymentParameters');
  if (booking) {
    if (booking.requestFingerprint !== fingerprint) throw new BookingError(409, 'This request key was used for a different booking.', 'IDEMPOTENCY_CONFLICT');
    if (['FAILED', 'CANCELLED', 'EXPIRED'].includes(booking.bookingStatus)) throw new BookingError(409, 'This booking is closed. Start a new booking.', 'RESERVATION_EXPIRED');
    const current = await ensureReservation(booking);
    if (!['PENDING', 'CONFIRMED'].includes(current.bookingStatus)) throw new BookingError(409, 'This reservation expired. Start a new booking.', 'RESERVATION_EXPIRED');
    return current;
  }
  requireStripeConfig();
  await releaseExpiredEventReservations(input.eventId);
  const event = await Event.findById(input.eventId);
  const quote = quoteInventory(event, input.locationId, input.ticketTierId, input.quantity);
  const id = new mongoose.Types.ObjectId();
  try {
    booking = await Booking.create({
      _id: id, bookingId: `BKG-${crypto.randomBytes(12).toString('hex').toUpperCase()}`,
      eventId: event._id, tenantId: event.tenantId, customerId: user._id,
      locationId: quote.location._id, locationName: quote.location.name, ticketTierId: quote.tier._id,
      locationStartDateTime: quote.start, locationEndDateTime: quote.end,
      ticketType: quote.tier.name, ticketQuantity: input.quantity, unitPrice: quote.unitPrice,
      subtotal: quote.subtotal, totalAmount: quote.totalAmount, amountCents: quote.amountCents,
      platformFee: quote.platformFee, organizerRevenue: quote.organizerRevenue, currency: quote.currency,
      customerName: input.customerName || user.name, customerEmail: input.customerEmail || user.email,
      customerPhone: input.customerPhone || user.contactNumber || '',
      requestKey, requestFingerprint: fingerprint, paymentVersion: 2, paymentStatus: 'pending',
      bookingStatus: 'PENDING', ticketStatus: 'PENDING', reservationState: 'NEW',
      reservationExpiresAt: quote.expiresAt, needsReconciliation: true,
      // A non-pass reference preserves the existing unique legacy index.
      // It is never returned as a QR or accepted by ticket validation.
      qrCodeString: `PENDING:${id}`,
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    booking = await Booking.findOne({ customerId: user._id, requestKey, paymentVersion: 2 })
      .select('+requestKey +requestFingerprint +paymentParameters');
    if (!booking || booking.requestFingerprint !== fingerprint) throw new BookingError(409, 'Booking request conflict.', 'IDEMPOTENCY_CONFLICT');
  }
  try {
    const current = await ensureReservation(booking);
    if (!['PENDING', 'CONFIRMED'].includes(current.bookingStatus)) throw new BookingError(409, 'This reservation expired. Start a new booking.', 'RESERVATION_EXPIRED');
    return current;
  }
  catch (error) {
    if (error instanceof BookingError && !(await readReservation(booking)).reservation) await releasePending(booking, 'FAILED');
    throw error;
  }
};

// Reclaim due holds on demand, even if periodic maintenance is delayed.
// Provider closure/refunds remain durable work through needsReconciliation.
export const releaseExpiredEventReservations = async (eventId) => {
  const [event] = await Event.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(eventId) } },
    { $project: { due: { $filter: { input: { $ifNull: ['$reservationJournal', []] },
      as: 'reservation', cond: { $and: [
        { $eq: ['$$reservation.status', 'HELD'] }, { $lte: ['$$reservation.expiresAt', '$$NOW'] },
      ] } } } } },
  ]);
  for (const reservation of event?.due || []) {
    const booking = await Booking.findById(reservation.booking);
    if (booking?.bookingStatus === 'PENDING' && booking.paymentVersion === 2) await releasePending(booking, 'EXPIRED');
  }
};
