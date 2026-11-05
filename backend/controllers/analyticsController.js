import mongoose from 'mongoose';
import Booking from '../models/booking.js';
import User from '../models/User.js';
import Event from '../models/event.js';
import { bookingResponse } from '../utils/bookingResponse.js';

// @desc    Get metrics for logged-in Organizer
// @route   GET /api/analytics/organizer
// @access  Private (Organizer only)
export const getOrganizerStats = async (req, res) => {
  try {
    const tenantId = req.user._id;

    const stats = await Booking.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), paymentStatus: 'paid', bookingStatus: 'CONFIRMED', paymentVersion: 2, paymentVerifiedAt: { $type: 'date' }, refundRequested: { $ne: true }, paymentReviewRequired: { $ne: true } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$organizerRevenue' },
          totalTicketsSold: { $sum: '$ticketQuantity' },
          totalBookingsCount: { $sum: 1 },
        },
      },
    ]);

    // Per-event sales breakdown
    const eventBreakdown = await Booking.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), paymentStatus: 'paid', bookingStatus: 'CONFIRMED', paymentVersion: 2, paymentVerifiedAt: { $type: 'date' }, refundRequested: { $ne: true }, paymentReviewRequired: { $ne: true } } },
      {
        $group: {
          _id: '$eventId',
          ticketsSold: { $sum: '$ticketQuantity' },
          revenue: { $sum: '$organizerRevenue' },
        },
      },
      {
        $lookup: {
          from: 'events',
          localField: '_id',
          foreignField: '_id',
          as: 'eventDetails',
        },
      },
      { $unwind: '$eventDetails' },
      {
        $project: {
          eventId: '$_id',
          eventTitle: '$eventDetails.title',
          ticketsSold: 1,
          revenue: 1,
          _id: 0,
        },
      },
    ]);

    res.status(200).json({
      summary: stats[0] || { totalRevenue: 0, totalTicketsSold: 0, totalBookingsCount: 0 },
      eventBreakdown,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get bookings for a specific event (Organizer)
// @route   GET /api/organizer/events/:eventId/bookings
// @access  Private (Organizer)
export const getEventBookingsForOrganizer = async (req, res) => {
  try {
    const { eventId } = req.params;
    if (!mongoose.isValidObjectId(eventId) || !(await Event.exists({ _id: eventId, tenantId: req.user._id }))) {
      return res.status(404).json({ message: 'Event not found.' });
    }
    const bookings = await Booking.find({
      eventId,
      tenantId: req.user._id,
    })
      .populate('customerId', 'name email contactNumber')
      .sort({ createdAt: -1 });

    res.status(200).json(bookings.map((booking) => bookingResponse(booking, { includePass: false })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get detailed statistics for a specific event (Organizer)
// @route   GET /api/organizer/events/:eventId/statistics
// @access  Private (Organizer)
export const getEventStatsForOrganizer = async (req, res) => {
  try {
    const { eventId } = req.params;
    if (!mongoose.isValidObjectId(eventId)) return res.status(400).json({ message: 'Invalid event ID.' });
    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    if (event.tenantId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized.' });
    }

    const bookings = await Booking.find({
      eventId: event._id,
      paymentStatus: 'paid', bookingStatus: 'CONFIRMED', paymentVersion: 2, paymentVerifiedAt: { $type: 'date' }, refundRequested: { $ne: true }, paymentReviewRequired: { $ne: true },
    });

    const totalTicketsSold = bookings.reduce((sum, b) => sum + (b.ticketQuantity || 0), 0);
    const totalRevenue = bookings.reduce((sum, b) => sum + (b.organizerRevenue || 0), 0);
    const checkedInCount = bookings.filter((b) => b.isCheckedIn || b.ticketStatus === 'USED').reduce((sum, booking) => sum + booking.ticketQuantity, 0);

    const currentTime = new Date();
    const status = event.isCancelled || event.status === 'cancelled' ? 'CANCELLED' : currentTime < new Date(event.startDateTime)
      ? 'UPCOMING'
      : currentTime < new Date(event.endDateTime)
      ? 'ONGOING'
      : 'COMPLETED';

    const locationBreakdown = (event.locations || []).map((loc) => ({
      locationName: loc.name,
      totalCapacity: loc.ticketTiers.reduce((s, t) => s + t.totalQuantity, 0),
      ticketsSold: loc.ticketTiers.reduce((s, t) => s + (t.soldQuantity || 0), 0),
      ticketsAvailable: loc.ticketTiers.reduce((s, t) => s + Math.max(0, t.availableQuantity ?? (t.totalQuantity - (t.soldQuantity || 0))), 0),
      ticketTiers: loc.ticketTiers.map((t) => ({
        name: t.name,
        price: t.price,
        totalQuantity: t.totalQuantity,
        soldQuantity: t.soldQuantity || 0,
        availableQuantity: Math.max(0, t.availableQuantity ?? (t.totalQuantity - (t.soldQuantity || 0))),
        soldOut: (t.availableQuantity ?? (t.totalQuantity - (t.soldQuantity || 0))) <= 0,
      })),
    }));

    res.status(200).json({
      eventId: event._id,
      title: event.title,
      eventStatus: status,
      totalTickets: event.totalCapacity,
      ticketsSold: totalTicketsSold,
      availableTickets: event.availableTickets,
      revenue: totalRevenue,
      checkedInTickets: checkedInCount,
      locations: locationBreakdown,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Platform-wide stats for Super Admin
// @route   GET /api/analytics/admin
// @access  Private (Super Admin only)
export const getAdminStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalOrganizers = await User.countDocuments({ role: 'organizer' });
    const totalEvents = await Event.countDocuments();

    const revenueMetrics = await Booking.aggregate([
      { $match: { paymentStatus: 'paid', bookingStatus: 'CONFIRMED', paymentVersion: 2, paymentVerifiedAt: { $type: 'date' }, refundRequested: { $ne: true }, paymentReviewRequired: { $ne: true } } },
      {
        $group: {
          _id: null,
          totalPlatformEarnings: { $sum: '$platformFee' }, // 5% Cut
          totalGrossVolume: { $sum: '$totalAmount' },
          totalTicketsIssued: { $sum: '$ticketQuantity' },
        },
      },
    ]);

    res.status(200).json({
      overview: {
        totalUsers,
        totalOrganizers,
        totalEvents,
      },
      financials: revenueMetrics[0] || {
        totalPlatformEarnings: 0,
        totalGrossVolume: 0,
        totalTicketsIssued: 0,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};