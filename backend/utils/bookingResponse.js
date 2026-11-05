const publicFields = [
  '_id', 'bookingId', 'eventId', 'tenantId', 'customerId', 'locationId', 'locationName',
  'locationStartDateTime', 'locationEndDateTime', 'ticketTierId', 'ticketQuantity', 'ticketType',
  'unitPrice', 'subtotal', 'totalAmount', 'platformFee', 'organizerRevenue', 'currency',
  'paymentStatus', 'bookingStatus', 'ticketStatus', 'isCheckedIn', 'checkedInAt',
  'refundedAmount', 'reservationExpiresAt', 'paymentVerifiedAt', 'paymentReviewRequired', 'refundRequested',
  'createdAt', 'updatedAt',
];
export const bookingResponse = (booking, { includeCustomer = true, includePass = true } = {}) => {
  const object = booking.toObject ? booking.toObject() : booking;
  const result = Object.fromEntries(publicFields.filter((key) => object[key] !== undefined).map((key) => [key, object[key]]));
  const confirmed = object.paymentVersion === 2 && object.bookingStatus === 'CONFIRMED' &&
    object.paymentStatus === 'paid' && !!object.paymentVerifiedAt &&
    ['VALID', 'USED'].includes(object.ticketStatus) && /^TKT-[a-f0-9]{64}$/.test(object.qrToken || '');
  const ticketEvent = object.eventId && typeof object.eventId === 'object' && object.eventId.title ? object.eventId : null;
  const eventEligible = !ticketEvent || (ticketEvent.status === 'published' && ticketEvent.isPublished && ticketEvent.approvalStatus === 'approved' && ticketEvent.isActive !== false && !ticketEvent.isCancelled && !ticketEvent.cancelledAt);
  result.canUseTicket = confirmed && eventEligible && !object.refundRequested && !object.paymentReviewRequired;
  if (result.canUseTicket && includePass) {
    result.qrToken = object.qrToken;
    result.qrCodeString = object.qrToken;
  }
  if (includeCustomer) {
    for (const field of ['customerName', 'customerEmail', 'customerPhone']) if (object[field]) result[field] = object[field];
  } else delete result.customerId;
  const event = object.eventId && typeof object.eventId === 'object' ? object.eventId : null;
  const start = object.locationStartDateTime || event?.startDateTime;
  const end = object.locationEndDateTime || event?.endDateTime;
  if (start && end) {
    const now = Date.now();
    result.isUpcoming = new Date(end).getTime() > now;
    result.eventStatus = now < new Date(start).getTime() ? 'UPCOMING' :
      now < new Date(end).getTime() ? 'ONGOING' : 'COMPLETED';
  }
  return result;
};
