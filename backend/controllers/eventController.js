import { manageEvent } from '../services/eventManagement.js';
import { bookingErrorResponse } from '../config/bookingSecurity.js';
import { pageQuery, literalSearch, text } from '../utils/phase3Validation.js';
import Event from '../models/event.js';
import Category from '../models/category.js';
import { parseDateTime, parseInstant, calculateLifecycleStatus } from '../utils/dateUtils.js';

// Helper to format event object with dynamic lifecycle status
const formatEventWithStatus = (eventDoc, currentTime = new Date()) => {
  const event = eventDoc.toObject ? eventDoc.toObject() : { ...eventDoc };
  const status = event.isCancelled || event.status === 'cancelled' ? 'CANCELLED' : calculateLifecycleStatus(event.startDateTime, event.endDateTime, currentTime);
  delete event.reservationJournal;
  const bookingAllowed = event.status === 'published' && event.isPublished && event.approvalStatus === 'approved' &&
    event.isActive !== false && !event.isCancelled && !event.cancelledAt && event.availableTickets > 0 &&
    currentTime < new Date(event.startDateTime) && (!event.bookingClosesAt || currentTime < new Date(event.bookingClosesAt));

  // Normalize locations array for frontend if empty
  let locations = event.locations && event.locations.length > 0 ? event.locations : [];
  if (locations.length === 0) {
    const defaultTiers = (event.ticketTypes || []).map((t) => ({
      _id: t._id,
      name: t.name,
      price: t.price,
      totalQuantity: t.quantity || t.totalQuantity || 0,
      soldQuantity: t.soldQuantity || 0,
      availableQuantity: t.availableQuantity ?? (t.quantity - (t.soldQuantity || 0)),
      expiryDate: t.expiryDate || null,
      soldOut: (t.availableQuantity ?? (t.quantity - (t.soldQuantity || 0))) <= 0,
    }));

    locations = [
      {
        _id: event._id,
        name: event.location || 'Main Venue',
        address: '',
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        startDateTime: event.startDateTime,
        endDateTime: event.endDateTime,
        ticketTiers: defaultTiers,
      },
    ];
  } else {
    locations = locations.map((loc) => ({
      ...loc,
      ticketTiers: (loc.ticketTiers || []).map((tier) => ({
        ...tier,
        availableQuantity: Math.max(0, tier.availableQuantity ?? (tier.totalQuantity - (tier.soldQuantity || 0))),
        soldOut: (tier.availableQuantity ?? (tier.totalQuantity - (tier.soldQuantity || 0))) <= 0,
      })),
    }));
  }

  return {
    ...event,
    eventStatus: status,
    bookingAllowed,
    supportsLocationEditing: Boolean(event.locations?.length),
    locations,
  };
};

// @desc    Create a new event (Organizer only with Free-tier plan limit)
// @route   POST /api/events
// @access  Private (Organizer)
export const createEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      bannerUrl,
      date,
      startTime = '07:00 PM',
      endTime = '11:00 PM',
      startDateTime: reqStartDateTime,
      endDateTime: reqEndDateTime,
      location,
      locations: reqLocations,
      schedules,
      ticketPrice,
      totalCapacity,
      totalTickets,
      ticketTypes,
      contactEmail,
      contactPhone,
      bookingClosesAt,
      status = 'published',
    } = req.body;

    text(title, 'title', 200); text(description, 'description', 20000);
    if (!['draft','published'].includes(status)) return res.status(400).json({ message: 'Invalid event status.' });
    // Multi-tenant Subscription Limit Check (Free tier = max 2 events)
    if (req.user.subscriptionPlan === 'free') {
      const eventCount = await Event.countDocuments({ tenantId: req.user._id });
      if (eventCount >= 2) {
        return res.status(403).json({
          message: 'Free tier limit reached (Max 2 events). Please upgrade to Pro to create more.',
        });
      }
    }

    const primaryDate = date ? new Date(date) : new Date();
    const primaryStartDT = reqStartDateTime ? parseInstant(reqStartDateTime) : parseDateTime(primaryDate, startTime);
    const primaryEndDT = reqEndDateTime ? parseInstant(reqEndDateTime) : parseDateTime(primaryDate, endTime);

    // Ensure endDateTime is after startDateTime
    if (primaryEndDT <= primaryStartDT) {
      return res.status(400).json({ message: 'End time must be after start time.' });
    }

    // Process Location-based Ticket Tiers
    let processedLocations = [];
    let overallCapacity = 0;
    let overallTicketTypes = [];
    let startingPrice = Number(ticketPrice || 0);

    if (Array.isArray(reqLocations) && reqLocations.length > 0) {
      processedLocations = reqLocations.map((loc) => {
        const locDate = loc.date ? new Date(loc.date) : primaryDate;
        const locStartDT = loc.startDateTime ? parseInstant(loc.startDateTime) : parseDateTime(locDate, loc.startTime || startTime);
        const locEndDT = loc.endDateTime ? parseInstant(loc.endDateTime) : parseDateTime(locDate, loc.endTime || endTime);

        const tiers = (loc.ticketTiers || loc.ticketTypes || []).map((t) => {
          const totalQty = Number(t.totalQuantity || t.quantity || 0);
          const soldQty = 0;
          const availQty = Math.max(0, totalQty - soldQty);
          return {
            name: t.name || 'General',
            price: Number(t.price || 0),
            totalQuantity: totalQty,
            soldQuantity: soldQty,
            availableQuantity: availQty,
            expiryDate: t.expiryDate ? new Date(t.expiryDate) : null,
          };
        });

        return {
          name: loc.name || loc.location || 'Main Venue',
          address: loc.address || '',
          date: locDate,
          startTime: loc.startTime || startTime,
          endTime: loc.endTime || endTime,
          startDateTime: locStartDT,
          endDateTime: locEndDT,
          ticketTiers: tiers,
        };
      });

      // Collect all tiers across locations for legacy fallback
      processedLocations.forEach((loc) => {
        loc.ticketTiers.forEach((tier) => {
          overallCapacity += tier.totalQuantity;
          overallTicketTypes.push(tier);
        });
      });

      if (overallTicketTypes.length > 0) {
        startingPrice = Math.min(...overallTicketTypes.map((t) => t.price));
      }
    } else if (Array.isArray(ticketTypes) && ticketTypes.length > 0) {
      // Legacy ticketTypes provided
      overallTicketTypes = ticketTypes.map((t) => {
        const qty = Number(t.quantity || t.totalQuantity || 0);
        return {
          name: t.name || 'General',
          price: Number(t.price || 0),
          totalQuantity: qty,
          soldQuantity: 0,
          availableQuantity: qty,
          expiryDate: t.expiryDate ? new Date(t.expiryDate) : null,
        };
      });

      overallCapacity = overallTicketTypes.reduce((sum, t) => sum + t.totalQuantity, 0);
      startingPrice = Math.min(...overallTicketTypes.map((t) => t.price));

      processedLocations = [
        {
          name: location || 'Main Venue',
          address: '',
          date: primaryDate,
          startTime,
          endTime,
          startDateTime: primaryStartDT,
          endDateTime: primaryEndDT,
          ticketTiers: overallTicketTypes,
        },
      ];
    } else {
      // Default single General tier
      const cap = Number(totalCapacity || totalTickets || 100);
      const defaultTier = {
        name: 'General',
        price: startingPrice,
        totalQuantity: cap,
        soldQuantity: 0,
        availableQuantity: cap,
        expiryDate: null,
      };

      overallCapacity = cap;
      overallTicketTypes = [defaultTier];

      processedLocations = [
        {
          name: location || 'Main Venue',
          address: '',
          date: primaryDate,
          startTime,
          endTime,
          startDateTime: primaryStartDT,
          endDateTime: primaryEndDT,
          ticketTiers: [defaultTier],
        },
      ];
    }

    // Process schedules for legacy compatibility
    let processedSchedules = [];
    if (Array.isArray(schedules) && schedules.length > 0) {
      processedSchedules = schedules.map((s) => ({
        location: s.location || location || 'Main Venue',
        date: s.date ? new Date(s.date) : primaryDate,
        startTime: s.startTime || startTime,
        endTime: s.endTime || endTime,
      }));
    } else {
      processedSchedules = processedLocations.map((loc) => ({
        location: loc.name,
        date: loc.date,
        startTime: loc.startTime,
        endTime: loc.endTime,
      }));
    }

    for (const loc of processedLocations) {
      if (!(loc.startDateTime > new Date()) || !(loc.endDateTime > loc.startDateTime) || !loc.ticketTiers.length) return res.status(400).json({ message: 'All locations require future dates, an end after start, and ticket tiers.' });
      text(loc.name, 'venue', 200);
      for (const tier of loc.ticketTiers) {
        text(tier.name, 'ticket name', 100);
        if (!Number.isSafeInteger(tier.totalQuantity) || tier.totalQuantity < 1 || tier.totalQuantity > 10000000 || !Number.isFinite(tier.price) || tier.price < 0 || tier.price > 999999.99 || Math.abs(tier.price * 100 - Math.round(tier.price * 100)) > 0.000001) return res.status(400).json({ message: 'Use whole ticket capacities and valid two-decimal prices.' });
      }
    }
    const primaryLocation = processedLocations[0];
    const isPublished = status === 'published';

    const event = await Event.create({
      tenantId: req.user._id,
      title,
      description,
      category: category || 'Music & Concerts',
      bannerUrl: bannerUrl || '',
      startDateTime: new Date(Math.min(...processedLocations.map((loc) => +loc.startDateTime))),
      endDateTime: new Date(Math.max(...processedLocations.map((loc) => +loc.endDateTime))),
      date: primaryLocation.date,
      startTime: primaryLocation.startTime,
      endTime: primaryLocation.endTime,
      location: primaryLocation.name,
      locations: processedLocations,
      schedules: processedSchedules,
      ticketPrice: startingPrice,
      totalCapacity: overallCapacity,
      availableTickets: overallCapacity,
      ticketTypes: overallTicketTypes,
      contactEmail: contactEmail || req.user?.email || '',
      contactPhone: contactPhone || '',
      bookingClosesAt: bookingClosesAt ? parseInstant(bookingClosesAt) : null,
      status: status || 'published',
      isPublished,
    });

    res.status(201).json(formatEventWithStatus(event));
  } catch (error) {
    res.status(['ValidationError', 'CastError'].includes(error.name) || error.status === 400 ? 400 : 503)
      .json({ message: 'Unable to process event request. Check event dates, times and field values.' });
  }
};

// @desc    Get upcoming published events (Customer Home Page)
// @route   GET /api/events/upcoming
// @access  Public
export const getAllEvents = async (req, res) => {
  try {
    const now = new Date(), { page, limit, skip } = pageQuery(req.query);
    const filter = { status: 'published', isPublished: true, approvalStatus: 'approved', isActive: { $ne: false },
      isCancelled: { $ne: true }, cancelledAt: null, startDateTime: { $gt: now }, endDateTime: { $gt: now } };
    if (req.query.search) filter.title = { $regex: literalSearch(req.query.search), $options: 'i' };
    if (req.query.category) filter.category = text(req.query.category, 'category', 100);
    if (req.query.location) filter.$or = [{ 'locations.name': { $regex: literalSearch(req.query.location), $options: 'i' } }, { location: { $regex: literalSearch(req.query.location), $options: 'i' } }];
    if (req.query.status && req.query.status !== 'upcoming') return res.status(400).json({ message: 'Public discovery supports upcoming events only.' });
    if (req.query.date) {
      if (typeof req.query.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(req.query.date) || !Number.isFinite(Date.parse(req.query.date)) || new Date(req.query.date).toISOString().slice(0,10) !== req.query.date) return res.status(400).json({ message: 'Invalid date.' });
      const from = new Date(req.query.date), to = new Date(+from + 86400000);
      filter.startDateTime = { $gte: new Date(Math.max(+from, +now)), $lt: to };
    }
    const [events, total] = await Promise.all([Event.find(filter).populate('tenantId', 'name').sort({ startDateTime: 1, _id: 1 }).skip(skip).limit(limit), Event.countDocuments(filter)]);
    return res.json(req.query.page ? { events: events.map((event) => formatEventWithStatus(event, now)), total, page, limit } : events.map((event) => formatEventWithStatus(event, now)));
  } catch (error) { return bookingErrorResponse(res, error); }
};
export const getUpcomingEvents = getAllEvents;

// @desc    Get location-based and tier-based availability for an event
// @route   GET /api/events/:eventId/availability
// @access  Public
export const getEventAvailability = async (req, res) => {
  try {
    const event = await Event.findOne({ _id: req.params.eventId, status: 'published', isPublished: true, approvalStatus: 'approved',
      isActive: { $ne: false }, isCancelled: { $ne: true }, cancelledAt: null });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const currentTime = new Date();
    const status = event.isCancelled || event.status === 'cancelled' ? 'CANCELLED' : calculateLifecycleStatus(event.startDateTime, event.endDateTime, currentTime);
    const bookingAllowed = currentTime < new Date(event.startDateTime) && event.availableTickets > 0 &&
      (!event.bookingClosesAt || currentTime < new Date(event.bookingClosesAt));

    const formatted = formatEventWithStatus(event, currentTime);

    const locationBreakdown = (formatted.locations || []).map((loc) => ({
      locationId: loc._id,
      name: loc.name,
      address: loc.address || '',
      date: loc.date,
      startTime: loc.startTime,
      endTime: loc.endTime,
      startDateTime: loc.startDateTime,
      endDateTime: loc.endDateTime,
      ticketTiers: (loc.ticketTiers || []).map((tier) => ({
        ticketTierId: tier._id,
        name: tier.name,
        price: tier.price,
        totalQuantity: tier.totalQuantity,
        soldQuantity: tier.soldQuantity || 0,
        availableQuantity: tier.availableQuantity,
        soldOut: tier.soldOut || tier.availableQuantity <= 0,
      })),
    }));

    res.status(200).json({
      eventId: event._id,
      eventTitle: event.title,
      eventStatus: status,
      bookingAllowed,
      startDateTime: event.startDateTime,
      endDateTime: event.endDateTime,
      locations: locationBreakdown,
    });
  } catch (error) {
    res.status(['ValidationError', 'CastError'].includes(error.name) || error.status === 400 ? 400 : 503)
      .json({ message: 'Unable to process event request. Check event dates, times and field values.' });
  }
};

// @desc    Get all events created by the logged-in organizer (Tenant Isolation)
// @route   GET /api/events/my-events
// @access  Private (Organizer)
export const getOrganizerEvents = async (req, res) => {
  try {
    const currentTime = new Date();
    const events = await Event.find({ tenantId: req.user._id }).sort({ createdAt: -1 });
    const formattedEvents = events.map((e) => formatEventWithStatus(e, currentTime));
    res.status(200).json(formattedEvents);
  } catch (error) {
    res.status(['ValidationError', 'CastError'].includes(error.name) || error.status === 400 ? 400 : 503)
      .json({ message: 'Unable to process event request. Check event dates, times and field values.' });
  }
};

// @desc    Get single event by ID
// @route   GET /api/events/:id
// @access  Public
export const getEventById = async (req, res) => {
  try {
    const event = await Event.findOne({ _id: req.params.id, status: 'published', isPublished: true, approvalStatus: 'approved',
      isActive: { $ne: false }, isCancelled: { $ne: true }, cancelledAt: null }).populate('tenantId', 'name email contactNumber subscriptionPlan');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const currentTime = new Date();
    res.status(200).json(formatEventWithStatus(event, currentTime));
  } catch (error) {
    res.status(['ValidationError', 'CastError'].includes(error.name) || error.status === 400 ? 400 : 503)
      .json({ message: 'Unable to process event request. Check event dates, times and field values.' });
  }
};

// @desc    Delete an event (Organizer can only delete their own event)
// @route   DELETE /api/events/:id
// @access  Private (Organizer)
export const updateEvent = async (req, res) => {
  try { return res.json(formatEventWithStatus(await manageEvent(req.params.id, req.user, req.body))); }
  catch (error) { return bookingErrorResponse(res, error); }
};
export const deleteEvent = async (req, res) => {
  try { return res.json({ message: 'Event cancelled. Paid bookings require verified admin refunds.', event: formatEventWithStatus(await manageEvent(req.params.id, req.user, req.body, 'cancel')) }); }
  catch (error) { return bookingErrorResponse(res, error); }
};

// @desc    Get categories (Public API)
// @route   GET /api/events/categories
// @access  Public
export const getCategoriesPublic = async (req, res) => {
  try {
    let categories = await Category.find({}).sort({ name: 1 });
    if (!categories || categories.length === 0) {
      const defaultCats = [
        { name: 'Music & Concerts', description: 'Live concerts, music festivals, and gigs' },
        { name: 'Conference', description: 'Professional and industry conferences' },
        { name: 'Workshop', description: 'Interactive training and learning workshops' },
        { name: 'Tech & IT', description: 'Technology, software, and hackathons' },
        { name: 'Sports & Fitness', description: 'Sporting events, tournaments, and fitness' },
        { name: 'Arts & Theatre', description: 'Drama, plays, art exhibitions, and cultural shows' },
        { name: 'Parties & Entertainment', description: 'Nightlife, parties, and DJ events' },
        { name: 'Business & Networking', description: 'Corporate events and networking meetups' },
        { name: 'Expos & Exhibitions', description: 'Trade shows, expos, and fairs' },
        { name: 'Seminars & Webinars', description: 'Educational seminars and webinars' },
        { name: 'Food & Drink', description: 'Food festivals, wine tasting, and culinary events' },
      ];
      categories = defaultCats;
    }
    res.status(200).json(categories);
  } catch (error) {
    res.status(['ValidationError', 'CastError'].includes(error.name) || error.status === 400 ? 400 : 503)
      .json({ message: 'Unable to process event request. Check event dates, times and field values.' });
  }
};
