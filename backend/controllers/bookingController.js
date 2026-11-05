import Booking from '../models/booking.js';
import Event from '../models/event.js';
import { BookingError, bookingErrorResponse, mongoId } from '../config/bookingSecurity.js';
import { bookingResponse } from '../utils/bookingResponse.js';
import { createPendingBooking, authorizedBooking, projectReservation, releasePending } from '../services/bookingService.js';
import { readReservation } from '../services/inventoryService.js';
import { synchronizePayment, cancelPendingPayment } from '../services/paymentService.js';

const snapshot = async (booking) => {
  if (booking.paymentVersion !== 2 || booking.bookingStatus !== 'PENDING') return booking;
  const { reservation } = await readReservation(booking);
  if (reservation?.status === 'HELD' && new Date(booking.reservationExpiresAt) <= new Date()) return releasePending(booking, 'EXPIRED');
  return reservation ? projectReservation(booking, reservation) : booking;
};
const populateBooking = (booking) => booking.populate([
  { path: 'eventId', select: 'title startDateTime endDateTime date startTime endTime location bannerUrl status isPublished isActive approvalStatus isCancelled cancelledAt category contactEmail contactPhone' },
  { path: 'customerId', select: 'name' }, { path: 'tenantId', select: 'name' },
]);
export const createBooking = async (req, res) => {
  try {
    const booking = await createPendingBooking(req.user, req.body, req.get('Idempotency-Key'));
    return res.status(201).json({
      message: booking.bookingStatus === 'CONFIRMED' ? 'Payment verified and booking confirmed.' : 'Tickets reserved. Complete payment before the reservation expires.',
      booking: bookingResponse(booking),
    });
  } catch (error) { return bookingErrorResponse(res, error); }
};
export const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ customerId: req.user._id }).sort({ createdAt: -1 });
    const result = [];
    for (const original of bookings) {
      const booking = await populateBooking(await snapshot(original));
      result.push(bookingResponse(booking));
    }
    return res.json(result);
  } catch (error) { return bookingErrorResponse(res, error); }
};
export const getBookingById = async (req, res) => {
  try {
    const booking = await snapshot(await authorizedBooking(req.params.bookingId, req.user));
    return res.json(bookingResponse(await populateBooking(booking)));
  } catch (error) { return bookingErrorResponse(res, error); }
};
export const confirmBooking = async (req, res) => {
  try {
    if (req.body && Object.keys(req.body).length) throw new BookingError(400, 'Payment confirmation accepts no client payment assertions.');
    const booking = await authorizedBooking(req.params.bookingId, req.user, { customerOnly: true });
    const updated = await synchronizePayment(booking, { refresh: true });
    return res.json({ booking: bookingResponse(await populateBooking(updated)) });
  } catch (error) { return bookingErrorResponse(res, error); }
};
export const cancelBooking = async (req, res) => {
  try {
    const booking = await authorizedBooking(req.params.bookingId, req.user, { customerOnly: true });
    if (!['PENDING', 'CANCELLED'].includes(booking.bookingStatus)) throw new BookingError(409, 'Only pending bookings can be cancelled here.');
    const updated = await cancelPendingPayment(booking);
    return res.status(updated.needsReconciliation ? 202 : 200).json({
      message: updated.needsReconciliation ? 'Cancellation recorded; payment reconciliation is pending.' : 'Pending booking cancelled.',
      booking: bookingResponse(updated),
    });
  } catch (error) { return bookingErrorResponse(res, error); }
};
export const verifyTicket = async (req, res) => {
  try {
    const token = req.body?.qrCodeString || req.body?.ticketToken || req.body?.qrToken || req.body?.token;
    const eventId = typeof req.body?.eventId === 'string' ? req.body.eventId.toLowerCase() : '';
    if (!mongoId(eventId) || typeof token !== 'string' || !/^TKT-[a-f0-9]{64}$/.test(token)) {
      throw new BookingError(400, 'Select an event and provide a valid ticket token.', 'INVALID_TICKET');
    }
    const event = await Event.findById(eventId);
    if (!event || event.tenantId.toString() !== req.user._id.toString()) {
      throw new BookingError(403, 'You cannot validate tickets for this event.');
    }
    if (event.status !== 'published' || !event.isPublished || event.approvalStatus !== 'approved' ||
        event.isActive === false || event.isCancelled || event.cancelledAt || new Date(event.endDateTime) <= new Date()) {
      throw new BookingError(409, 'This event is not eligible for check-in.', 'EVENT_UNAVAILABLE');
    }
    const booking = await Booking.findOne({ qrToken: token });
    if (!booking) throw new BookingError(404, 'Invalid ticket.', 'INVALID_TICKET');
    if (booking.eventId.toString() !== eventId || booking.tenantId.toString() !== req.user._id.toString()) {
      throw new BookingError(409, 'This ticket belongs to a different event.', 'WRONG_EVENT');
    }
    if (booking.isCheckedIn || booking.ticketStatus === 'USED') throw new BookingError(409, 'Ticket already used.', 'TICKET_USED');
    if (booking.locationEndDateTime && new Date(booking.locationEndDateTime) <= new Date()) {
      throw new BookingError(409, 'This event location has ended.', 'EVENT_ENDED');
    }
    const checked = await Booking.findOneAndUpdate({
      _id: booking._id, eventId, tenantId: req.user._id, qrToken: token,
      paymentVersion: 2, bookingStatus: 'CONFIRMED', paymentStatus: 'paid',
      paymentVerifiedAt: { $exists: true, $ne: null }, ticketStatus: 'VALID', isCheckedIn: false,
      refundRequested: { $ne: true },
    }, { $set: { ticketStatus: 'USED', isCheckedIn: true, checkedInAt: new Date() } }, { returnDocument: 'after' });
    if (!checked) throw new BookingError(409, 'Ticket is already used or is not a valid confirmed booking.', 'TICKET_UNAVAILABLE');
    return res.json({ valid: true, message: 'Ticket valid. Group entry recorded.',
      attendee: checked.customerName || 'Customer', user: { name: checked.customerName || 'Customer' },
      event: { _id: event._id, title: event.title }, quantity: checked.ticketQuantity,
      ticketsCount: checked.ticketQuantity, locationName: checked.locationName, ticketType: checked.ticketType });
  } catch (error) { return bookingErrorResponse(res, error); }
};
