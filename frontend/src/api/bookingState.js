export const canDisplayTicket = (booking) => booking?.canUseTicket === true &&
  booking.bookingStatus === 'CONFIRMED' && booking.paymentStatus === 'paid' &&
  !!booking.paymentVerifiedAt && !booking.refundRequested && !booking.paymentReviewRequired && ['VALID', 'USED'].includes(booking.ticketStatus) &&
  /^TKT-[a-f0-9]{64}$/.test(booking.qrToken || '');
export const isCurrentBooking = (booking, now) => {
  const end = booking.locationEndDateTime || booking.eventId?.endDateTime;
  return !end || new Date(end).getTime() > now;
};
export const bookingStatusMessage = (booking) => {
  if (booking.eventId?.isCancelled || booking.eventId?.status === 'cancelled') return 'This event has been cancelled. Contact support about paid booking refunds.';
  if (booking.paymentReviewRequired) return 'Payment requires reconciliation. Contact support if this message persists.';
  if (booking.bookingStatus === 'PENDING') return 'Payment pending. Your tickets are reserved only until the deadline shown.';
  if (booking.bookingStatus === 'EXPIRED') return 'Reservation expired. Start a new booking; late payments are refunded.';
  if (booking.bookingStatus === 'FAILED') return 'Payment failed. Reserved inventory has been released.';
  if (booking.bookingStatus === 'CANCELLED') return booking.paymentStatus === 'refunded' ? 'Booking cancelled and payment refunded.' : 'Booking cancelled.';
  if (!canDisplayTicket(booking)) return 'This ticket requires payment verification. Contact support.';
  return booking.isCheckedIn ? 'This group pass has already been used.' : 'Verified group pass. All booked attendees must enter together.';
};
export const bookingAttempt = (previous, payload, keyFactory = () => crypto.randomUUID()) => {
  const fingerprint = JSON.stringify(payload);
  return previous?.fingerprint === fingerprint ? previous : { fingerprint, key: keyFactory() };
};
export const validCheckoutUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'checkout.stripe.com' && !url.username && !url.password;
  } catch { return false; }
};
