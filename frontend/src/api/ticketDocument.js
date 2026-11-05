import { canDisplayTicket } from './bookingState.js';
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]);
export const ticketDocument = (booking, qrSvg) => {
  if (!canDisplayTicket(booking) || booking.ticketStatus !== 'VALID' || booking.refundRequested || booking.paymentReviewRequired) throw new Error('Ticket is not eligible for download.');
  const event = booking.eventId || {};
  const lines = ['EVENTRA | VERIFIED GROUP TICKET', event.title, 'Reference: ' + booking.bookingId,
    'Date: ' + new Date(booking.locationStartDateTime || event.startDateTime).toISOString(),
    'Venue: ' + (booking.locationName || event.location), 'Tier: ' + booking.ticketType + ' | Quantity: ' + booking.ticketQuantity,
    'All attendees must enter together. Live gate verification required.'];
  return '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="620" viewBox="0 0 800 620"><rect width="800" height="620" fill="#fff"/>' +
    lines.map((line,index) => '<text x="30" y="' + (40 + index * 35) + '" fill="#111827" font-size="' + (index < 2 ? 22 : 15) + '">' + escape(line) + '</text>').join('') +
    '<g transform="translate(30,300)">' + qrSvg + '</g></svg>';
};
