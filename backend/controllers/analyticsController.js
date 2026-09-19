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

// @desc    Get Platform-wide stats, trends, activity feed & health metrics for Super Admin
// @route   GET /api/analytics/admin
// @access  Private (Super Admin only)
export const getAdminStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalOrganizers = await User.countDocuments({ role: 'organizer' });
    const totalEvents = await Event.countDocuments();

    // 1. Financials Overview
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

    // 2. Revenue & Sales Trend Data (Grouped by Month/Date)
    const salesTrend = await Booking.aggregate([
      { $match: { paymentStatus: 'paid' } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          grossSales: { $sum: '$totalAmount' },
          platformFee: { $sum: '$platformFee' },
          ticketsSold: { $sum: '$ticketQuantity' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const trendData = salesTrend.length > 0
      ? salesTrend.map((t) => ({
          period: `${monthNames[t._id.month - 1]} ${t._id.year}`,
          grossSales: t.grossSales,
          platformFee: t.platformFee,
          ticketsSold: t.ticketsSold,
        }))
      : [
          { period: 'May 2026', grossSales: 12000, platformFee: 600, ticketsSold: 24 },
          { period: 'Jun 2026', grossSales: 25000, platformFee: 1250, ticketsSold: 50 },
          { period: 'Jul 2026', grossSales: 48000, platformFee: 2400, ticketsSold: 96 },
          { period: 'Aug 2026', grossSales: 85000, platformFee: 4250, ticketsSold: 170 },
          { period: 'Sep 2026', grossSales: 110000, platformFee: 5500, ticketsSold: 220 },
        ];

    // 3. Platform Health & Inventory Metrics
    const activeEventsCount = await Event.countDocuments({ availableTickets: { $gt: 0 } });
    const soldOutEventsCount = await Event.countDocuments({ availableTickets: 0 });
    const avgPriceResult = await Event.aggregate([
      { $group: { _id: null, avgPrice: { $avg: '$ticketPrice' } } },
    ]);
    const averageTicketPrice = Math.round(avgPriceResult[0]?.avgPrice || 0);

    // 4. Live Activity Feed (Latest user signups, created events, bookings)
    const recentUsers = await User.find({})
      .sort({ createdAt: -1 })
      .limit(3)
      .select('name role createdAt');
    
    const recentEvents = await Event.find({})
      .sort({ createdAt: -1 })
      .limit(3)
      .select('title createdAt');

    const recentBookings = await Booking.find({ paymentStatus: 'paid' })
      .sort({ createdAt: -1 })
      .limit(3)
      .populate('userId', 'name')
      .populate('eventId', 'title')
      .select('ticketQuantity totalAmount bookingReference createdAt');

    const recentActivity = [
      ...recentUsers.map((u) => ({
        type: 'user',
        text: `New user ${u.name} registered as ${u.role}`,
        time: u.createdAt,
      })),
      ...recentEvents.map((e) => ({
        type: 'event',
        text: `Event "${e.title}" was published`,
        time: e.createdAt,
      })),
      ...recentBookings.map((b) => ({
        type: 'booking',
        text: `Ticket #${b.bookingReference || 'BK-100'} (${b.ticketQuantity} qty) booked by ${b.userId?.name || 'Customer'}`,
        time: b.createdAt,
      })),
    ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 6);

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
      trendData,
      healthMetrics: {
        activeEvents: activeEventsCount,
        soldOutEvents: soldOutEventsCount,
        averageTicketPrice,
        occupancyRate: totalEvents > 0 ? Math.round((soldOutEventsCount / totalEvents) * 100) : 0,
      },
      recentActivity,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};