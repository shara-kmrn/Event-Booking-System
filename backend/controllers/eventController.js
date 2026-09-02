import Event from '../models/event.js';

// @desc    Create a new event (Organizer only with Free-tier plan limit)
// @route   POST /api/events
// @access  Private (Organizer)
export const createEvent = async (req, res) => {
  try {
    const { title, description, bannerUrl, date, location, ticketPrice, totalCapacity } = req.body;

    // Multi-tenant Subscription Limit Check (Free tier = max 2 events)
    if (req.user.subscriptionPlan === 'free') {
      const eventCount = await Event.countDocuments({ tenantId: req.user._id });
      if (eventCount >= 2) {
        return res.status(403).json({
          message: 'Free tier limit reached (Max 2 events). Please upgrade to Pro to create more.',
        });
      }
    }

    const event = await Event.create({
      tenantId: req.user._id,
      title,
      description,
      bannerUrl,
      date,
      location,
      ticketPrice,
      totalCapacity,
      availableTickets: totalCapacity, // Initially all tickets are available
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
    const event = await Event.findById(req.params.id).populate('tenantId', 'name email');

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