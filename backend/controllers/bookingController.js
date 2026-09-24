import crypto from 'crypto';
import Booking from '../models/booking.js';
import Event from '../models/event.js';

// @desc    Book tickets for an event (Customer)
// @route   POST /api/bookings
// @access  Private (Customer / Authenticated User)
export const createBooking = async (req, res) => {
  try {
    const {
      eventId,
      ticketQuantity,
      ticketType,
      customerName,
      customerEmail,
      customerPhone,
      paymentMethod,
      stripePaymentIntentId,
    } = req.body;
    const quantity = Number(ticketQuantity);

    if (!quantity || quantity < 1) {
      return res.status(400).json({ message: 'Invalid ticket quantity' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // 1. Capacity Check overall
    if (event.availableTickets < quantity) {
      return res.status(400).json({
        message: `Not enough tickets available. Only ${event.availableTickets} tickets remaining.`,
      });
    }

    // Check specific ticket tier if ticketType provided
    let unitPrice = event.ticketPrice;
    let selectedTierName = ticketType || 'General';

    if (Array.isArray(event.ticketTypes) && event.ticketTypes.length > 0) {
      const tier = event.ticketTypes.find(
        (t) => t.name === ticketType || t._id?.toString() === ticketType
      );
      if (tier) {
        if (tier.availableQuantity < quantity) {
          return res.status(400).json({
            message: `Not enough tickets available for ${tier.name}. Only ${tier.availableQuantity} left.`,
          });
        }
        unitPrice = tier.price;
        selectedTierName = tier.name;
        tier.availableQuantity -= quantity;
      }
    }

    // 2. Financial Calculations (5% Platform Fee Split)
    const totalAmount = unitPrice * quantity;
    const platformFee = Math.round(totalAmount * 0.05 * 100) / 100; // 5% fee
    const organizerRevenue = Math.round((totalAmount - platformFee) * 100) / 100; // 95% revenue

    // 3. Generate Secure Unique Verification Hash for QR Code
    const qrCodeString = `TKT-${crypto.randomBytes(6).toString('hex').toUpperCase()}-${Date.now()}`;

    // 4. Create Booking Record
    const booking = await Booking.create({
      eventId: event._id,
      tenantId: event.tenantId, // Isolated to Event Organizer
      customerId: req.user._id,
      ticketQuantity: quantity,
      ticketType: selectedTierName,
      customerName: customerName || req.user.name,
      customerEmail: customerEmail || req.user.email,
      customerPhone: customerPhone || req.user.contactNumber || '',
      paymentMethod: paymentMethod || 'Stripe Payment Gateway',
      stripePaymentIntentId: stripePaymentIntentId || '',
      totalAmount,
      platformFee,
      organizerRevenue,
      paymentStatus: 'paid', // MVP focus: marked as paid directly
      qrCodeString,
    });

    // 5. Atomic Update: Decrease available tickets in the Event
    event.availableTickets -= quantity;
    await event.save();

    res.status(201).json({
      message: 'Booking confirmed successfully',
      booking,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get bookings of the logged-in customer
// @route   GET /api/bookings/my-bookings
// @access  Private (Customer)
export const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ customerId: req.user._id })
      .populate({
        path: 'eventId',
        select: 'title date startTime endTime location bannerUrl ticketPrice tenantId contactEmail contactPhone category',
        populate: {
          path: 'tenantId',
          select: 'name email',
        },
      })
      .sort({ createdAt: -1 });

    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify QR ticket at event entrance gate
// @route   POST /api/bookings/verify-ticket
// @access  Private (Organizer only)
export const verifyTicket = async (req, res) => {
  try {
    const { qrCodeString } = req.body;

    const booking = await Booking.findOne({ qrCodeString })
      .populate('eventId', 'title date location')
      .populate('customerId', 'name email');

    if (!booking) {
      return res.status(404).json({ valid: false, message: 'Invalid ticket / Not found' });
    }

    // Verify Organizer Ownership (Tenant Check)
    if (booking.tenantId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ valid: false, message: 'This ticket does not belong to your event' });
    }

    if (booking.isCheckedIn) {
      return res.status(400).json({
        valid: false,
        message: 'Ticket has ALREADY BEEN USED for entry',
        booking,
      });
    }

    // Mark as checked-in
    booking.isCheckedIn = true;
    await booking.save();

    res.status(200).json({
      valid: true,
      message: 'Ticket verified successfully. Entry allowed!',
      attendee: booking.customerId.name,
      event: booking.eventId.title,
      ticketsCount: booking.ticketQuantity,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};