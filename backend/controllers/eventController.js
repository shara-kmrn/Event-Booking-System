import Event from '../models/event.js';
import Category from '../models/category.js';
import { parseDateTime, calculateLifecycleStatus } from '../utils/dateUtils.js';

// Helper to format event object with dynamic lifecycle status
const formatEventWithStatus = (eventDoc, currentTime = new Date()) => {
  const event = eventDoc.toObject ? eventDoc.toObject() : { ...eventDoc };
  const status = calculateLifecycleStatus(event.startDateTime, event.endDateTime, currentTime);
  const bookingAllowed = currentTime < new Date(event.startDateTime);

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
      status = 'published',
    } = req.body;

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
    const primaryStartDT = reqStartDateTime ? new Date(reqStartDateTime) : parseDateTime(primaryDate, startTime);
    const primaryEndDT = reqEndDateTime ? new Date(reqEndDateTime) : parseDateTime(primaryDate, endTime);

    // Ensure endDateTime is after startDateTime
    if (primaryEndDT <= primaryStartDT) {
      primaryEndDT.setTime(primaryStartDT.getTime() + 4 * 60 * 60 * 1000); // default +4h
    }

    // Process Location-based Ticket Tiers
    let processedLocations = [];
    let overallCapacity = 0;
    let overallTicketTypes = [];
    let startingPrice = Number(ticketPrice || 0);

    if (Array.isArray(reqLocations) && reqLocations.length > 0) {
      processedLocations = reqLocations.map((loc) => {
        const locDate = loc.date ? new Date(loc.date) : primaryDate;
        const locStartDT = loc.startDateTime ? new Date(loc.startDateTime) : parseDateTime(locDate, loc.startTime || startTime);
        const locEndDT = loc.endDateTime ? new Date(loc.endDateTime) : parseDateTime(locDate, loc.endTime || endTime);

        const tiers = (loc.ticketTiers || loc.ticketTypes || []).map((t) => {
          const totalQty = Number(t.totalQuantity || t.quantity || 0);
          const soldQty = Number(t.soldQuantity || 0);
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

    const primaryLocation = processedLocations[0];
    const isPublished = status === 'published';

    const event = await Event.create({
      tenantId: req.user._id,
      title,
      description,
      category: category || 'Music & Concerts',
      bannerUrl: bannerUrl || '',
      startDateTime: primaryStartDT,
      endDateTime: primaryEndDT,
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
      status: status || 'published',
      isPublished,
    });

    res.status(201).json(formatEventWithStatus(event));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get upcoming published events (Customer Home Page)
// @route   GET /api/events/upcoming
// @access  Public
export const getUpcomingEvents = async (req, res) => {
  try {
    const currentTime = new Date();
    // Filter events where startDateTime > currentTime and isPublished is true
    const events = await Event.find({
      isPublished: true,
      startDateTime: { $gt: currentTime },
    })
      .populate('tenantId', 'name email')
      .sort({ startDateTime: 1 });

    const formattedEvents = events.map((e) => formatEventWithStatus(e, currentTime));
    res.status(200).json(formattedEvents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all published events (Public / Customers)
// @route   GET /api/events
// @access  Public
export const getAllEvents = async (req, res) => {
  try {
    const currentTime = new Date();
    const events = await Event.find({ isPublished: true })
      .populate('tenantId', 'name email')
      .sort({ startDateTime: 1 });

    const formattedEvents = events.map((e) => formatEventWithStatus(e, currentTime));
    res.status(200).json(formattedEvents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get location-based and tier-based availability for an event
// @route   GET /api/events/:eventId/availability
// @access  Public
export const getEventAvailability = async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const currentTime = new Date();
    const status = calculateLifecycleStatus(event.startDateTime, event.endDateTime, currentTime);
    const bookingAllowed = currentTime < new Date(event.startDateTime);

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
    res.status(500).json({ message: error.message });
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
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single event by ID
// @route   GET /api/events/:id
// @access  Public
export const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate('tenantId', 'name email contactNumber subscriptionPlan');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const currentTime = new Date();
    res.status(200).json(formatEventWithStatus(event, currentTime));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete an event (Organizer can only delete their own event)
// @route   DELETE /api/events/:id
// @access  Private (Organizer)
export const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Verify tenant ownership
    if (event.tenantId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this event' });
    }

    await event.deleteOne();
    res.status(200).json({ message: 'Event removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
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
      try {
        categories = await Category.insertMany(defaultCats);
      } catch (e) {
        categories = defaultCats;
      }
    }
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
