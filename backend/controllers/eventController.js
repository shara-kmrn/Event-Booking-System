import Event from '../models/event.js';
import Category from '../models/category.js';

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
      startTime,
      endTime,
      location,
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

    let processedTicketTypes = [];
    let calculatedCapacity = Number(totalCapacity || totalTickets || 0);
    let startingPrice = Number(ticketPrice || 0);

    if (Array.isArray(ticketTypes) && ticketTypes.length > 0) {
      processedTicketTypes = ticketTypes.map((t) => ({
        name: t.name || 'General',
        price: Number(t.price || 0),
        quantity: Number(t.quantity || t.totalTickets || 0),
        availableQuantity: Number(t.quantity || t.totalTickets || 0),
        expiryDate: t.expiryDate ? new Date(t.expiryDate) : null,
      }));
      calculatedCapacity = processedTicketTypes.reduce((sum, t) => sum + t.quantity, 0);
      startingPrice = Math.min(...processedTicketTypes.map((t) => t.price));
    } else {
      processedTicketTypes = [
        {
          name: 'General',
          price: startingPrice,
          quantity: calculatedCapacity,
          availableQuantity: calculatedCapacity,
          expiryDate: null,
        },
      ];
    }

    // Process schedules
    let processedSchedules = [];
    if (Array.isArray(schedules) && schedules.length > 0) {
      processedSchedules = schedules.map((s) => ({
        location: s.location || location || 'Main Venue',
        date: s.date ? new Date(s.date) : (date ? new Date(date) : new Date()),
        startTime: s.startTime || startTime || '07:00 PM',
        endTime: s.endTime || endTime || '11:00 PM',
      }));
    } else {
      processedSchedules = [
        {
          location: location || 'Main Venue',
          date: date ? new Date(date) : new Date(),
          startTime: startTime || '07:00 PM',
          endTime: endTime || '11:00 PM',
        },
      ];
    }

    const primarySchedule = processedSchedules[0];
    const isPublished = status === 'published';

    const event = await Event.create({
      tenantId: req.user._id,
      title,
      description,
      category: category || 'Music & Concerts',
      bannerUrl: bannerUrl || '',
      date: primarySchedule.date,
      startTime: primarySchedule.startTime,
      endTime: primarySchedule.endTime,
      location: primarySchedule.location,
      schedules: processedSchedules,
      ticketPrice: startingPrice,
      totalCapacity: calculatedCapacity,
      availableTickets: calculatedCapacity,
      ticketTypes: processedTicketTypes,
      contactEmail: contactEmail || req.user?.email || '',
      contactPhone: contactPhone || '',
      status: status || 'published',
      isPublished,
    });

    res.status(201).json(event);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all published events (Public / Customers)
// @route   GET /api/events
// @access  Public
export const getAllEvents = async (req, res) => {
  try {
    const events = await Event.find({ isPublished: true })
      .populate('tenantId', 'name email')
      .sort({ date: 1 });

    res.status(200).json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all events created by the logged-in organizer (Tenant Isolation)
// @route   GET /api/events/my-events
// @access  Private (Organizer)
export const getOrganizerEvents = async (req, res) => {
  try {
    const events = await Event.find({ tenantId: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json(events);
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

    res.status(200).json(event);
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