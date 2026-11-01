import crypto from 'crypto';
import Booking from '../models/booking.js';
import Event from '../models/event.js';

// @desc    Book tickets for an event with location, ticket tier, and atomic concurrency lock
// @route   POST /api/bookings
// @access  Private (Customer / Authenticated User)
export const createBooking = async (req, res) => {
  try {
    const {
      eventId,
      locationId,
      ticketTierId,
      ticketQuantity,
      quantity: reqQuantity,
      ticketType,
      customerName,
      customerEmail,
      customerPhone,
      paymentMethod,
      stripePaymentIntentId,
    } = req.body;

    const quantity = Number(ticketQuantity || reqQuantity);
    if (!quantity || quantity < 1) {
      return res.status(400).json({ message: 'Invalid ticket quantity' });
    }

    // 1. Find Event
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    // 2. Server Time Validation - Ensure Event Has Not Started
    const currentTime = new Date();
    if (currentTime >= new Date(event.startDateTime)) {
      return res.status(400).json({
        message: 'Booking for this event is closed because the event has already started.',
      });
    }

    // 3. Match Location
    let locations = event.locations && event.locations.length > 0 ? event.locations : [];
    let targetLocation = null;

    if (locationId && locations.length > 0) {
      targetLocation = locations.find(
        (loc) => loc._id?.toString() === locationId || loc.name === locationId
      );
    }

    if (!targetLocation && locations.length > 0) {
      targetLocation = locations[0];
    }

    if (!targetLocation) {
      targetLocation = {
        _id: event._id,
        name: event.location || 'Main Venue',
        ticketTiers: event.ticketTypes || [],
      };
    }

    // 4. Match Ticket Tier within selected location
    let tiers = targetLocation.ticketTiers && targetLocation.ticketTiers.length > 0
      ? targetLocation.ticketTiers
      : (event.ticketTypes || []);

    let selectedTier = null;
    if (ticketTierId) {
      selectedTier = tiers.find(
        (t) => t._id?.toString() === ticketTierId || t.name === ticketTierId || t.name === ticketType
      );
    }

    if (!selectedTier && ticketType) {
      selectedTier = tiers.find((t) => t.name === ticketType);
    }

    if (!selectedTier && tiers.length > 0) {
      selectedTier = tiers[0];
    }

    if (!selectedTier) {
      return res.status(400).json({ message: 'This ticket type is sold out.' });
    }

    // 5. Calculate available quantity
    const totalQty = Number(selectedTier.totalQuantity || selectedTier.quantity || 0);
    const soldQty = Number(selectedTier.soldQuantity || 0);
    const availableQty = Math.max(0, selectedTier.availableQuantity ?? (totalQty - soldQty));

    if (availableQty <= 0) {
      return res.status(400).json({ message: 'This ticket type is sold out.' });
    }

    if (quantity > availableQty) {
      return res.status(400).json({
        message: `Only ${availableQty} tickets are available for this ticket type.`,
      });
    }

    // 6. Atomic Concurrency Lock to Prevent Overbooking
    let updatedEvent = null;

    if (event.locations && event.locations.length > 0 && selectedTier._id) {
      updatedEvent = await Event.findOneAndUpdate(
        {
          _id: event._id,
          startDateTime: { $gt: currentTime },
          'locations._id': targetLocation._id,
          'locations.ticketTiers._id': selectedTier._id,
          'locations.ticketTiers.availableQuantity': { $gte: quantity },
        },
        {
          $inc: {
            'locations.$[loc].ticketTiers.$[tier].soldQuantity': quantity,
            'locations.$[loc].ticketTiers.$[tier].availableQuantity': -quantity,
            availableTickets: -quantity,
          },
        },
        {
          arrayFilters: [
            { 'loc._id': targetLocation._id },
            { 'tier._id': selectedTier._id, 'tier.availableQuantity': { $gte: quantity } },
          ],
          new: true,
        }
      );
    }

    if (!updatedEvent) {
      // Fallback for top-level atomic decrement
      updatedEvent = await Event.findOneAndUpdate(
        {
          _id: event._id,
          startDateTime: { $gt: currentTime },
          availableTickets: { $gte: quantity },
        },
        {
          $inc: { availableTickets: -quantity },
        },
        { new: true }
      );
    }

    if (!updatedEvent) {
      return res.status(400).json({
        message: 'Sorry, the requested number of tickets is no longer available.',
      });
    }

    // 7. Calculate Financials (5% platform fee, 95% organizer revenue)
    const unitPrice = selectedTier.price || event.ticketPrice || 0;
    const totalAmount = unitPrice * quantity;
    const platformFee = Math.round(totalAmount * 0.05 * 100) / 100;
    const organizerRevenue = Math.round((totalAmount - platformFee) * 100) / 100;

    // 8. Generate Secure Tokens
    const bookingId = `BKG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const qrToken = `TKT-${crypto.randomBytes(6).toString('hex').toUpperCase()}-${Date.now()}`;

    // 9. Create Booking Record
    const booking = await Booking.create({
      bookingId,
      eventId: event._id,
      tenantId: event.tenantId,
      customerId: req.user._id,
      locationId: targetLocation._id,
      locationName: targetLocation.name,
      ticketTierId: selectedTier._id,
      ticketType: selectedTier.name,
      ticketQuantity: quantity,
      unitPrice,
      totalAmount,
      platformFee,
      organizerRevenue,
      customerName: customerName || req.user.name,
      customerEmail: customerEmail || req.user.email,
      customerPhone: customerPhone || req.user.contactNumber || '',
      paymentMethod: paymentMethod || 'Stripe Payment Gateway',
      stripePaymentIntentId: stripePaymentIntentId || '',
      paymentStatus: 'paid',
      bookingStatus: 'CONFIRMED',
      ticketStatus: 'VALID',
      qrToken,
      qrCodeString: qrToken,
      isCheckedIn: false,
    });

    res.status(201).json({
      message: 'Booking confirmed successfully',
      booking,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get bookings of the logged-in customer (Separated into Upcoming vs Past)
// @route   GET /api/bookings/my-bookings
// @access  Private (Customer)
export const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ customerId: req.user._id })
      .populate({
        path: 'eventId',
        select: 'title startDateTime endDateTime date startTime endTime location bannerUrl ticketPrice tenantId contactEmail contactPhone category',
        populate: {
          path: 'tenantId',
          select: 'name email',
        },
      })
      .sort({ createdAt: -1 });

    const currentTime = new Date();
    const formattedBookings = bookings.map((b) => {
      const bObj = b.toObject();
      const evt = bObj.eventId;
      const isUpcoming = evt?.startDateTime ? new Date(evt.startDateTime) > currentTime : true;
      return {
        ...bObj,
        isUpcoming,
        eventStatus: evt?.startDateTime
          ? new Date(evt.startDateTime) > currentTime
            ? 'UPCOMING'
            : new Date(evt.endDateTime) > currentTime
            ? 'ONGOING'
            : 'COMPLETED'
          : 'UPCOMING',
      };
    });

    res.status(200).json(formattedBookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single booking by ID
// @route   GET /api/bookings/:bookingId
// @access  Private (Customer / Organizer)
export const getBookingById = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(bookingId);

    const booking = await Booking.findOne({
      $or: [{ bookingId }, ...(isMongoId ? [{ _id: bookingId }] : [])],
    }).populate('eventId customerId tenantId');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    res.status(200).json(booking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify QR ticket at event entrance gate
// @route   POST /api/bookings/verify-ticket or /api/tickets/verify
// @access  Private (Organizer only)
export const verifyTicket = async (req, res) => {
  try {
    const token = req.body.qrCodeString || req.body.ticketToken || req.body.qrToken || req.body.token;

    if (!token) {
      return res.status(400).json({ valid: false, message: 'Ticket token or QR code string is required' });
    }

    const isMongoId = /^[0-9a-fA-F]{24}$/.test(token);
    const booking = await Booking.findOne({
      $or: [{ qrToken: token }, { qrCodeString: token }, { bookingId: token }, ...(isMongoId ? [{ _id: token }] : [])],
    })
      .populate('eventId', 'title startDateTime endDateTime date location')
      .populate('customerId', 'name email');

    if (!booking) {
      return res.status(404).json({ valid: false, message: 'Invalid Ticket' });
    }

    // Verify Organizer Ownership (Tenant Check)
    if (booking.tenantId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ valid: false, message: 'This ticket belongs to another event / organizer' });
    }

    // Check payment status
    const payStatus = (booking.paymentStatus || '').toLowerCase();
    if (payStatus !== 'paid' && payStatus !== 'confirmed') {
      return res.status(400).json({ valid: false, message: 'Invalid Ticket - Payment Not Confirmed' });
    }

    // Check ticket usage status
    if (booking.isCheckedIn || booking.ticketStatus === 'USED') {
      return res.status(400).json({
        valid: false,
        message: 'Ticket Already Used',
        booking,
        event: booking.eventId,
        user: booking.customerId,
        quantity: booking.ticketQuantity,
      });
    }

    if (booking.ticketStatus === 'CANCELLED') {
      return res.status(400).json({ valid: false, message: 'Invalid Ticket - Cancelled' });
    }

    // Mark as checked-in
    booking.isCheckedIn = true;
    booking.ticketStatus = 'USED';
    await booking.save();

    res.status(200).json({
      valid: true,
      message: 'Ticket Valid - Entry Allowed',
      attendee: booking.customerId?.name || booking.customerName || 'Customer',
      user: booking.customerId,
      event: booking.eventId,
      ticketsCount: booking.ticketQuantity,
      quantity: booking.ticketQuantity,
      locationName: booking.locationName,
      ticketType: booking.ticketType,
    });
  } catch (error) {
    res.status(500).json({ valid: false, message: error.message });
  }
};