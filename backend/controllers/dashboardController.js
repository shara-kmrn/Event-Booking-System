import mongoose from 'mongoose';
import Booking from '../models/booking.js';
import Event from '../models/event.js';
import User from '../models/User.js';
import { bookingResponse } from '../utils/bookingResponse.js';
import { bookingErrorResponse } from '../config/bookingSecurity.js';
export const verifiedSales = { paymentVersion: 2, paymentStatus: 'paid', bookingStatus: 'CONFIRMED',
  paymentVerifiedAt: { $type: 'date' }, refundRequested: { $ne: true }, paymentReviewRequired: { $ne: true } };
const lifecycle = (event, now) => event.isCancelled || event.status === 'cancelled' ? 'cancelled' :
  new Date(event.startDateTime) > now ? 'upcoming' : new Date(event.endDateTime) > now ? 'ongoing' : 'completed';
export const organizerDashboard = async (req, res) => {
  try {
    const tenantId = new mongoose.Types.ObjectId(req.user._id);
    const events = await Event.find({ tenantId }).select('title startDateTime endDateTime status isCancelled availableTickets');
    const filter = { ...verifiedSales, tenantId, eventId: { $in: events.map((event) => event._id) } };
    const sales = await Booking.aggregate([{ $match: filter }, { $group: { _id: '$eventId', ticketsSold: { $sum: '$ticketQuantity' },
      revenue: { $sum: '$organizerRevenue' }, bookings: { $sum: 1 } } }]);
    const summary = { totalEvents: events.length, upcoming: 0, ongoing: 0, completed: 0, cancelled: 0,
      availableTickets: 0, totalRevenue: 0, totalTicketsSold: 0, totalBookingsCount: 0 };
    const now = new Date();
    const eventBreakdown = events.map((event) => {
      const status = lifecycle(event, now); summary[status]++;
      if (status === 'upcoming') summary.availableTickets += event.availableTickets;
      const row = sales.find((sale) => String(sale._id) === String(event._id));
      summary.totalRevenue += row?.revenue || 0; summary.totalTicketsSold += row?.ticketsSold || 0;
      summary.totalBookingsCount += row?.bookings || 0;
      return { eventId: event._id, eventTitle: event.title, status, availableTickets: event.availableTickets,
        ticketsSold: row?.ticketsSold || 0, revenue: row?.revenue || 0 };
    });
    const recent = await Booking.find({ tenantId, eventId: { $in: events.map((event) => event._id) } })
      .populate('eventId', 'title').sort({ createdAt: -1 }).limit(10);
    return res.json({ summary, eventBreakdown, recentBookings: recent.map((booking) => bookingResponse(booking, { includePass: false, includeCustomer: false })) });
  } catch (error) { return bookingErrorResponse(res, error); }
};
export const adminDashboard = async (req, res) => {
  try {
    const [totalUsers, totalCustomers, totalOrganizers, totalEvents, pendingEvents, approvedEvents, rejectedEvents, sales, recent] = await Promise.all([
      User.countDocuments(), User.countDocuments({ role: 'customer' }), User.countDocuments({ role: 'organizer' }), Event.countDocuments(),
      Event.countDocuments({ approvalStatus: 'pending' }), Event.countDocuments({ approvalStatus: 'approved' }), Event.countDocuments({ approvalStatus: 'rejected' }),
      Booking.aggregate([{ $match: verifiedSales }, { $group: { _id: null, totalPlatformEarnings: { $sum: '$platformFee' },
        totalGrossVolume: { $sum: '$totalAmount' }, totalTicketsIssued: { $sum: '$ticketQuantity' }, totalActivePaidTransactions: { $sum: 1 } } }]),
      Booking.find({ paymentVersion: 2, paymentVerifiedAt: { $type: 'date' } }).populate('eventId', 'title').sort({ createdAt: -1 }).limit(10),
    ]);
    const totalVerifiedTransactions = await Booking.countDocuments({ paymentVersion: 2, paymentVerifiedAt: { $type: 'date' }, paymentStatus: { $in: ['paid', 'refunded'] } });
    return res.json({ overview: { totalUsers, totalCustomers, totalOrganizers, totalEvents, pendingEvents, approvedEvents, rejectedEvents },
      financials: { ...(sales[0] || { totalPlatformEarnings: 0, totalGrossVolume: 0, totalTicketsIssued: 0, totalActivePaidTransactions: 0 }), totalVerifiedTransactions },
      recentTransactions: recent.map((booking) => bookingResponse(booking, { includePass: false, includeCustomer: false })) });
  } catch (error) { return bookingErrorResponse(res, error); }
};
