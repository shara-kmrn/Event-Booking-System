import Notification from '../models/Notification.js';
import Booking from '../models/booking.js';
import User from '../models/User.js';
import sendEmail, { assertEmailConfigured } from '../utils/sendEmail.js';
import Event from '../models/event.js';
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]);
const queue = async (id, to, subject, message) => {
  if (!to) return;
  try { await Notification.updateOne({ _id: id }, { $setOnInsert: { to, subject, html: '<p>' + escape(message) + '</p>', status: 'pending' } }, { upsert: true }); }
  catch (error) { if (error.code !== 11000) throw error; }
};
export const notifyBooking = async (booking) => {
  try {
    if (booking.paymentVersion !== 2) return;
    const user = await User.findById(booking.customerId).select('email');
    const ref = booking.bookingId, key = 'booking:' + booking._id;
    if (booking.bookingStatus === 'CONFIRMED' && booking.paymentStatus === 'paid' && booking.paymentVerifiedAt && !booking.refundRequested && !booking.paymentReviewRequired)
      await queue(key + ':confirmed', user?.email, 'Eventra booking confirmed', 'Booking ' + ref + ' is confirmed for ' + booking.ticketQuantity + ' ticket(s). View your verified ticket in My Tickets.');
    if (booking.bookingStatus === 'FAILED' || (booking.paymentStatus === 'failed' && booking.bookingStatus !== 'CANCELLED'))
      await queue(key + ':failed', user?.email, 'Eventra payment unsuccessful', 'Payment for booking ' + ref + ' was not successful. Check My Tickets for the current status.');
    if (booking.bookingStatus === 'CANCELLED')
      await queue(key + ':cancelled', user?.email, 'Eventra booking cancellation', 'Booking ' + ref + ' is cancelled. Refunds, where applicable, require provider verification.');
    if (booking.refundRequested)
      await queue(key + ':refund:' + (booking.paymentStatus === 'refunded' ? 'verified' : 'review'), user?.email, 'Eventra refund status',
        booking.paymentStatus === 'refunded' ? 'Refund for ' + ref + ' has been verified. Refunded amount: ' + booking.refundedAmount + ' ' + booking.currency.toUpperCase() + '.' : 'Refund for ' + ref + ' is awaiting verification or review. Check My Tickets or contact support.');
    await Booking.updateOne({ _id: booking._id, bookingStatus: booking.bookingStatus, paymentStatus: booking.paymentStatus, refundRequested: !!booking.refundRequested }, { $set: { notificationState: booking.bookingStatus + ':' + booking.paymentStatus + ':' + (booking.refundRequested ? 'refund' : 'none') } });
  } catch { console.warn('Booking notification could not be queued; maintenance will retry.'); }
};
export const notifyEvent = async (event, status) => {
  try {
    const organizer = await User.findById(event.tenantId).select('email');
    const reason = status === 'rejected' ? event.rejectionReason : status === 'cancelled' ? event.cancellationReason : '';
    await queue('event:' + event._id + ':' + status + ':' + event.updatedAt.toISOString(), organizer?.email, 'Eventra event ' + status, event.title + ': ' + status + '. ' + reason);
    if (status === 'cancelled') {
      const customers = await Booking.distinct('customerId', { eventId: event._id });
      for (const id of customers) {
        const user = await User.findById(id).select('email');
        await queue('event:' + event._id + ':cancelled:' + id, user?.email, 'Eventra event cancelled', event.title + ' has been cancelled. ' + reason + ' Contact support regarding paid booking refunds; refunds require provider verification.');
      }
    }
  } catch { console.warn('Event notification queue is unavailable.'); }
};
export const deliverNotifications = async (limit = 30) => {
  const bookings = await Booking.find({ paymentVersion: 2, bookingStatus: { $in: ['CONFIRMED','FAILED','CANCELLED'] },
    $expr: { $ne: [{ $ifNull: ['$notificationState', ''] }, { $concat: ['$bookingStatus', ':', '$paymentStatus', ':', { $cond: ['$refundRequested', 'refund', 'none'] }] }] }
  }).sort({ createdAt: 1 }).limit(100);
  for (const booking of bookings) await notifyBooking(booking);
  assertEmailConfigured();
  const pending = await Notification.find({ status: 'pending' }).sort({ createdAt: 1 }).limit(limit);
  for (const notification of pending) {
    const claimed = await Notification.findOneAndUpdate({ _id: notification._id, status: 'pending' }, { $set: { status: 'sending' }, $inc: { attempts: 1 } }, { returnDocument: 'after' }).select('+to +html');
    if (!claimed) continue;
    try {
      const confirmation = claimed._id.match(/^booking:([a-f0-9]{24}):confirmed$/);
      if (confirmation) {
        const booking = await Booking.findById(confirmation[1]);
        const activeEvent = booking && await Event.exists({ _id: booking.eventId, status: 'published', approvalStatus: 'approved', isActive: { $ne: false }, isCancelled: { $ne: true } });
        if (!booking || !activeEvent || booking.bookingStatus !== 'CONFIRMED' || booking.paymentStatus !== 'paid' || !booking.paymentVerifiedAt || booking.refundRequested || booking.paymentReviewRequired) {
          await Notification.updateOne({ _id: claimed._id }, { $set: { status: 'suppressed' } }); continue;
        }
      }
      await sendEmail({ to: claimed.to, subject: claimed.subject, html: claimed.html });
      await Notification.updateOne({ _id: claimed._id }, { $set: { status: 'sent', sentAt: new Date() } });
    } catch {
      // SMTP acceptance can be ambiguous: avoid automatic duplicate delivery.
      await Notification.updateOne({ _id: claimed._id }, { $set: { status: 'uncertain' } });
    }
  }
};
