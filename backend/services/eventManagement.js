import Event from '../models/event.js';
import Booking from '../models/booking.js';
import { BookingError, mongoId } from '../config/bookingSecurity.js';
import { text } from '../utils/phase3Validation.js';
import { notifyEvent } from './notificationService.js';
const instant = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw new BookingError(400, 'Use an ISO date with timezone.');
  return new Date(value);
};
export const manageEvent = async (id, user, body, action = 'edit') => {
  if (!mongoId(id)) throw new BookingError(400, 'Invalid event ID.');
  const event = await Event.findOne({ _id: id, ...(user.role === 'superadmin' ? {} : { tenantId: user._id }) }).select('+reservationJournal');
  if (!event) throw new BookingError(404, 'Event not found.');
  const now = new Date();
  if (new Date(event.endDateTime) <= now) throw new BookingError(409, 'Completed events cannot be changed.');
  const filter = { _id: event._id, updatedAt: event.updatedAt, locations: event.locations.toObject(),
    reservationJournal: event.reservationJournal.toObject(), availableTickets: event.availableTickets,
    $expr: { $gt: [action === 'edit' ? '$startDateTime' : '$endDateTime', '$$NOW'] } };
  let changes = {};
  if (action === 'cancel') {
    changes = { status: 'cancelled', isCancelled: true, isActive: false, cancelledAt: now,
      cancellationReason: text(body?.reason, 'cancellation reason', 1000, 5) };
    if (event.isCancelled) return event;
  } else {
    if (event.isCancelled || new Date(event.startDateTime) <= now) throw new BookingError(409, 'Only upcoming active events may be edited.');
    const allowed = ['title', 'description', 'category', 'bannerUrl', 'locations'];
    if (!body || Array.isArray(body) || !Object.keys(body).length || Object.keys(body).some((key) => !allowed.includes(key))) throw new BookingError(400, 'Unsupported event fields.');
    for (const key of ['title', 'description', 'category', 'bannerUrl']) {
      if (body[key] !== undefined) changes[key] = text(body[key], key, key === 'description' ? 20000 : key === 'bannerUrl' ? 2000000 : 200, key === 'bannerUrl' ? 0 : 1);
    }
    if (changes.bannerUrl && !/^https?:\/\//i.test(changes.bannerUrl) && !/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(changes.bannerUrl)) throw new BookingError(400, 'Use an HTTP image URL or PNG/JPEG/WebP image.');
    if (body.locations !== undefined) {
      if (!Array.isArray(body.locations) || !body.locations.length || body.locations.length !== event.locations.length) throw new BookingError(409, 'Existing location identities must be preserved.');
      const hasHistory = event.reservationJournal.length > 0 || !!await Booking.exists({ eventId: event._id });
      const locations = event.locations.toObject();
      for (let i = 0; i < locations.length; i++) {
        const loc = locations[i], input = body.locations[i];
        if (String(input?._id) !== String(loc._id) || !Array.isArray(input.ticketTiers) || input.ticketTiers.length !== loc.ticketTiers.length) throw new BookingError(409, 'Location and tier identities must be preserved.');
        const start = instant(input.startDateTime), end = instant(input.endDateTime);
        const name = text(input.name, 'venue', 200), address = text(input.address ?? '', 'address', 500, 0);
        if (!(start > now && end > start)) throw new BookingError(400, 'Invalid event schedule.');
        if (hasHistory && (name !== loc.name || address !== loc.address || +start !== +new Date(loc.startDateTime) || +end !== +new Date(loc.endDateTime))) throw new BookingError(409, 'Venues and dates are locked after booking activity.');
        Object.assign(loc, { name, address, startDateTime: start, endDateTime: end, date: start });
        for (let j = 0; j < loc.ticketTiers.length; j++) {
          const tier = loc.ticketTiers[j], proposed = input.ticketTiers[j];
          if (String(proposed?._id) !== String(tier._id)) throw new BookingError(409, 'Tier identity must be preserved.');
          const capacity = proposed.totalQuantity, price = proposed.price, tierName = text(proposed.name, 'tier name', 100);
          if (!Number.isSafeInteger(capacity) || capacity < (tier.soldQuantity || 0) + (tier.reservedQuantity || 0) || capacity < 0 || capacity > 10000000) throw new BookingError(409, 'Capacity cannot be below sold and reserved seats.');
          if (typeof price !== 'number' || !Number.isFinite(price) || price < 0 || price > 999999.99 || Math.abs(price * 100 - Math.round(price * 100)) > 0.000001) throw new BookingError(400, 'Invalid ticket price.');
          if (hasHistory && (price !== tier.price || tierName !== tier.name)) throw new BookingError(409, 'Ticket names and prices are locked after booking activity.');
          tier.availableQuantity += capacity - tier.totalQuantity;
          Object.assign(tier, { totalQuantity: capacity, price, name: tierName });
        }
      }
      const tiers = locations.flatMap((loc) => loc.ticketTiers);
      Object.assign(changes, { locations, ticketTypes: tiers, totalCapacity: tiers.reduce((sum, tier) => sum + tier.totalQuantity, 0),
        availableTickets: tiers.reduce((sum, tier) => sum + tier.availableQuantity, 0), ticketPrice: Math.min(...tiers.map((tier) => tier.price)),
        startDateTime: new Date(Math.min(...locations.map((loc) => +loc.startDateTime))), endDateTime: new Date(Math.max(...locations.map((loc) => +loc.endDateTime))),
        date: locations[0].date, location: locations[0].name,
        schedules: locations.map((loc) => ({ location: loc.name, date: loc.date, startTime: loc.startTime, endTime: loc.endTime })) });
    }
    changes.approvalStatus = 'pending'; changes.rejectionReason = '';
  }
  event.set(changes); await event.validate();
  const updated = await Event.findOneAndUpdate(filter, { $set: changes }, { returnDocument: 'after', runValidators: true });
  if (!updated) throw new BookingError(409, 'Event changed during this request. Reload and retry.');
  if (action === 'cancel') await notifyEvent(updated, 'cancelled');
  return updated;
};
