import Event from '../models/event.js';
import { BookingError, bookingConfig } from '../config/bookingSecurity.js';

export const eligibilityQuery = () => ({
  status: 'published', isPublished: true, approvalStatus: 'approved',
  isActive: { $ne: false }, isCancelled: { $ne: true }, cancelledAt: null,
  $expr: { $and: [
    { $gt: ['$startDateTime', '$$NOW'] }, { $gt: ['$endDateTime', '$$NOW'] },
    { $or: [{ $eq: [{ $ifNull: ['$bookingClosesAt', null] }, null] }, { $gt: ['$bookingClosesAt', '$$NOW'] }] },
  ] },
});
export const assertEventEligible = (event, now = new Date()) => {
  if (!event) throw new BookingError(404, 'Event not found.', 'EVENT_NOT_FOUND');
  if (event.status !== 'published' || !event.isPublished || event.approvalStatus !== 'approved' ||
      event.isActive === false || event.isCancelled || event.cancelledAt) {
    throw new BookingError(409, 'This event is not published, approved and active.', 'EVENT_UNAVAILABLE');
  }
  if (!(new Date(event.startDateTime) > now) || !(new Date(event.endDateTime) > now)) {
    throw new BookingError(409, 'Booking is closed because this event has started or ended.', 'EVENT_STARTED');
  }
  if (event.bookingClosesAt && !(new Date(event.bookingClosesAt) > now)) {
    throw new BookingError(409, 'The booking closing time has passed.', 'BOOKING_CLOSED');
  }
};
export const selectInventory = (event, locationId, tierId) => {
  const nested = event.locations?.length > 0;
  const location = nested ? event.locations.find((value) => value._id.toString() === locationId.toString()) :
    (event._id.toString() === locationId.toString() ? {
      _id: event._id, name: event.location, startDateTime: event.startDateTime, endDateTime: event.endDateTime,
      ticketTiers: event.ticketTypes,
    } : null);
  const tier = location?.ticketTiers.find((value) => value._id.toString() === tierId.toString());
  if (!location || !tier) throw new BookingError(400, 'Choose a valid location and ticket type.', 'INVALID_SELECTION');
  return { location, tier, nested };
};
export const quoteInventory = (event, locationId, tierId, quantity) => {
  assertEventEligible(event);
  const selection = selectInventory(event, locationId, tierId);
  const { location, tier } = selection;
  const now = new Date();
  const start = new Date(location.startDateTime || event.startDateTime);
  const end = new Date(location.endDateTime || event.endDateTime);
  if (!(start > now) || !(end > now)) throw new BookingError(409, 'This location has already started or ended.', 'EVENT_STARTED');
  if (tier.expiryDate && !(new Date(tier.expiryDate) > now)) throw new BookingError(409, 'This ticket type has expired.', 'TIER_EXPIRED');
  if (!Number.isSafeInteger(tier.availableQuantity) || tier.availableQuantity < quantity ||
      !Number.isSafeInteger(event.availableTickets) || event.availableTickets < quantity) {
    throw new BookingError(409, 'The requested tickets are no longer available.', 'INVENTORY_UNAVAILABLE');
  }
  const unitCents = Math.round(tier.price * 100);
  if (!Number.isFinite(tier.price) || tier.price < 0 || !Number.isSafeInteger(unitCents) ||
      Math.abs(tier.price * 100 - unitCents) > 0.000001) {
    throw new BookingError(409, 'This ticket price needs organizer attention.', 'INVALID_EVENT_PRICE');
  }
  const subtotalCents = unitCents * quantity;
  const feeCents = Math.round(subtotalCents * 0.05);
  const amountCents = subtotalCents + feeCents;
  if (!Number.isSafeInteger(amountCents) || amountCents > 99999999) throw new BookingError(400, 'Booking total exceeds the payment limit.');
  const deadlines = [Date.now() + bookingConfig().reservationMinutes * 60000, start.getTime(),
    new Date(event.startDateTime).getTime()];
  if (tier.expiryDate) deadlines.push(new Date(tier.expiryDate).getTime());
  if (event.bookingClosesAt) deadlines.push(new Date(event.bookingClosesAt).getTime());
  return { ...selection, start, end, unitPrice: unitCents / 100, subtotal: subtotalCents / 100,
    platformFee: feeCents / 100, organizerRevenue: subtotalCents / 100,
    totalAmount: amountCents / 100, amountCents, currency: 'usd',
    expiresAt: new Date(Math.min(...deadlines)) };
};

const tierExpression = (booking, deltas) => ({
  $map: { input: '$$location.ticketTiers', as: 'tier', in: {
    $cond: [{ $eq: ['$$tier._id', booking.ticketTierId] }, { $mergeObjects: ['$$tier', {
      availableQuantity: { $add: ['$$tier.availableQuantity', deltas.available] },
      reservedQuantity: { $add: [{ $ifNull: ['$$tier.reservedQuantity', 0] }, deltas.reserved] },
      soldQuantity: { $add: [{ $ifNull: ['$$tier.soldQuantity', 0] }, deltas.sold] },
    }] }, '$$tier'],
  } },
});
const stockStages = (booking, nested, deltas, journal) => {
  const values = { availableTickets: { $add: ['$availableTickets', deltas.available] }, reservationJournal: journal };
  if (nested) {
    values.locations = { $map: { input: '$locations', as: 'location', in: {
      $cond: [{ $eq: ['$$location._id', booking.locationId] },
        { $mergeObjects: ['$$location', { ticketTiers: tierExpression(booking, deltas) }] }, '$$location'],
    } } };
  } else {
    values.ticketTypes = { $map: { input: '$ticketTypes', as: 'tier', in: {
      $cond: [{ $eq: ['$$tier._id', booking.ticketTierId] }, { $mergeObjects: ['$$tier', {
        availableQuantity: { $add: ['$$tier.availableQuantity', deltas.available] },
        reservedQuantity: { $add: [{ $ifNull: ['$$tier.reservedQuantity', 0] }, deltas.reserved] },
        soldQuantity: { $add: [{ $ifNull: ['$$tier.soldQuantity', 0] }, deltas.sold] },
      }] }, '$$tier'],
    } } };
  }
  const stages = [{ $set: values }];
  if (nested) stages.push({ $set: { ticketTypes: {
    $reduce: { input: '$locations', initialValue: [], in: { $concatArrays: ['$$value', '$$this.ticketTiers'] } },
  } } });
  return stages;
};
const journalMap = (booking, values) => ({ $map: {
  input: '$reservationJournal', as: 'reservation', in: {
    $cond: [{ $eq: ['$$reservation.booking', booking._id] },
      { $mergeObjects: ['$$reservation', { $literal: values }] }, '$$reservation'],
  },
} });
const stockMatch = (booking, nested, field, min) => {
  const tier = { _id: booking.ticketTierId, ...(field ? { [field]: { $gte: min } } : {}) };
  return nested ? { locations: { $elemMatch: { _id: booking.locationId, ticketTiers: { $elemMatch: tier } } } } :
    { ticketTypes: { $elemMatch: tier } };
};
export const readReservation = async (booking) => {
  const event = await Event.findById(booking.eventId).select('+reservationJournal');
  return { event, reservation: event?.reservationJournal.find((entry) => entry.booking.toString() === booking._id.toString()) };
};

export const reserveInventory = async (booking) => {
  const event = await Event.findById(booking.eventId);
  assertEventEligible(event);
  const { tier, nested } = selectInventory(event, booking.locationId, booking.ticketTierId);
  if (tier.price !== booking.unitPrice) throw new BookingError(409, 'Ticket price changed. Start a new booking.', 'PRICE_CHANGED');
  const now = new Date();
  const tierCondition = { _id: booking.ticketTierId, price: booking.unitPrice, availableQuantity: { $gte: booking.ticketQuantity },
    $or: [{ expiryDate: null }, { expiryDate: { $gt: now } }] };
  const selection = nested ? { locations: { $elemMatch: {
    _id: booking.locationId,
    $or: [{ startDateTime: { $exists: false } }, { startDateTime: null }, { startDateTime: { $gt: now } }],
    ticketTiers: { $elemMatch: tierCondition },
  } } } : { ticketTypes: { $elemMatch: tierCondition } };
  const eligibility = eligibilityQuery();
  eligibility.$expr.$and.push({ $gt: [{ $literal: booking.reservationExpiresAt }, '$$NOW'] },
    { $lt: [{ $size: { $ifNull: ['$reservationJournal', []] } }, bookingConfig().journalLimit] });
  const entry = {
    booking: booking._id, location: booking.locationId, tier: booking.ticketTierId,
    quantity: booking.ticketQuantity, expiresAt: booking.reservationExpiresAt, status: 'HELD',
  };
  const result = await Event.findOneAndUpdate({
    _id: booking.eventId, ...eligibility, ...selection,
    availableTickets: { $gte: booking.ticketQuantity }, 'reservationJournal.booking': { $ne: booking._id },
  }, stockStages(booking, nested, { available: -booking.ticketQuantity, reserved: booking.ticketQuantity, sold: 0 },
    { $concatArrays: [{ $ifNull: ['$reservationJournal', []] }, { $literal: [entry] }] }),
  { returnDocument: 'after', updatePipeline: true }).select('+reservationJournal');
  if (result) return result.reservationJournal.find((item) => item.booking.toString() === booking._id.toString());
  const existing = (await readReservation(booking)).reservation;
  if (existing) return existing;
  throw new BookingError(409, 'Tickets or the booking window are no longer available.', 'INVENTORY_UNAVAILABLE');
};

export const consumeInventory = async (booking, proof) => {
  const { event } = await readReservation(booking);
  if (!event) throw new BookingError(409, 'The event is no longer available.');
  const nested = event.locations?.length > 0;
  const eligibility = eligibilityQuery();
  eligibility.$expr.$and.push({ $anyElementTrue: [{ $map: {
    input: '$reservationJournal', as: 'reservation', in: { $and: [
      { $eq: ['$$reservation.booking', booking._id] }, { $eq: ['$$reservation.status', 'HELD'] },
      { $gt: ['$$reservation.expiresAt', '$$NOW'] },
    ] },
  } }] });
  const updated = await Event.findOneAndUpdate({
    _id: booking.eventId, ...eligibility,
    ...stockMatch(booking, nested, 'reservedQuantity', booking.ticketQuantity),
    reservationJournal: { $elemMatch: { booking: booking._id, status: 'HELD' } },
  }, stockStages(booking, nested, { available: 0, reserved: -booking.ticketQuantity, sold: booking.ticketQuantity },
    journalMap(booking, { status: 'CONSUMED', paymentIntentId: proof.intentId || '', verifiedAt: new Date() })),
  { returnDocument: 'after', updatePipeline: true }).select('+reservationJournal');
  return updated?.reservationJournal.find((item) => item.booking.toString() === booking._id.toString()) ||
    (await readReservation(booking)).reservation;
};

export const releaseInventory = async (booking, terminalStatus, { consumed = false } = {}) => {
  const { event, reservation } = await readReservation(booking);
  if (!event || !reservation || reservation.status === 'RELEASED') return reservation;
  const expected = consumed ? 'CONSUMED' : 'HELD';
  if (reservation.status !== expected) return reservation;
  const nested = event.locations?.length > 0;
  const counter = consumed ? 'soldQuantity' : 'reservedQuantity';
  const updated = await Event.findOneAndUpdate({
    _id: booking.eventId, ...stockMatch(booking, nested, counter, booking.ticketQuantity),
    reservationJournal: { $elemMatch: { booking: booking._id, status: expected } },
  }, stockStages(booking, nested, {
    available: booking.ticketQuantity, reserved: consumed ? 0 : -booking.ticketQuantity, sold: consumed ? -booking.ticketQuantity : 0,
  }, journalMap(booking, { status: 'RELEASED', terminalStatus })),
  { returnDocument: 'after', updatePipeline: true }).select('+reservationJournal');
  if (!updated) {
    const current = (await readReservation(booking)).reservation;
    if (current?.status === expected) throw new BookingError(503, 'Inventory requires reconciliation.', 'INVENTORY_RECONCILIATION');
    return current;
  }
  return updated.reservationJournal.find((item) => item.booking.toString() === booking._id.toString());
};
