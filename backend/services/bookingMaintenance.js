import { deliverNotifications } from './notificationService.js';
import Booking from '../models/booking.js';
import { bookingConfig, BookingError } from '../config/bookingSecurity.js';
import { ensureReservation, releasePending } from './bookingService.js';
import { synchronizePayment } from './paymentService.js';

export const reconcileBookings = async (limit = 100) => {
  const bookings = await Booking.find({ paymentVersion: 2,
    $or: [{ bookingStatus: 'PENDING' }, { needsReconciliation: true }] })
    .sort({ lastReconciledAt: 1, createdAt: 1 }).limit(limit);
  let deferred = 0;
  for (let booking of bookings) {
    try {
      if (booking.bookingStatus === 'PENDING') {
        try { booking = await ensureReservation(booking); }
        catch (error) {
          if (!(error instanceof BookingError) || error.status >= 500) throw error;
          booking = await releasePending(booking, new Date(booking.reservationExpiresAt) <= new Date() ? 'EXPIRED' : 'FAILED');
        }
      }
      await synchronizePayment(booking);
    } catch {
      deferred++;
      await Booking.updateOne({ _id: booking._id }, { $set: { needsReconciliation: true } });
    } finally {
      await Booking.updateOne({ _id: booking._id }, { $set: { lastReconciledAt: new Date() } });
    }
  }
  return { checked: bookings.length, deferred };
};
export const startBookingMaintenance = () => {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const result = await reconcileBookings();
      await deliverNotifications();
      if (result.deferred) console.warn('Booking reconciliation deferred; persistent records will be retried.');
    } catch { console.error('Booking reconciliation is unavailable; the next scheduled run will retry.'); }
    finally { running = false; }
  };
  const timer = setInterval(tick, bookingConfig().maintenanceSeconds * 1000);
  timer.unref();
  return () => clearInterval(timer);
};
