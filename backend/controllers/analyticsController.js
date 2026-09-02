import mongoose from 'mongoose';
import Booking from '../models/booking.js';
import User from '../models/User.js';
import Event from '../models/event.js';

// @desc    Get metrics for logged-in Organizer
// @route   GET /api/analytics/organizer
// @access  Private (Organizer only)
export const getOrganizerStats = async (req, res) => {
  try {
    const tenantId = req.user._id;

    const stats = await Booking.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), paymentStatus: 'paid' } },
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
      { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), paymentStatus: 'paid' } },
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

// @desc    Get Platform-wide stats for Super Admin
// @route   GET /api/analytics/admin
// @access  Private (Super Admin only)
export const getAdminStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalOrganizers = await User.countDocuments({ role: 'organizer' });
    const totalEvents = await Event.countDocuments();

    const revenueMetrics = await Booking.aggregate([
      { $match: { paymentStatus: 'paid' } },
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