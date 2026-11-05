import Complaint from '../models/complaints.js';
import Booking from '../models/booking.js';
import Event from '../models/event.js';
import { bookingErrorResponse, BookingError, mongoId } from '../config/bookingSecurity.js';
import { text, pageQuery } from '../utils/phase3Validation.js';
export const submitComplaint = async (req, res) => {
  try {
    const subject = text(req.body?.subject, 'subject', 150, 3);
    const message = text(req.body?.message ?? req.body?.description, 'description', 5000, 10);
    return res.status(201).json(await Complaint.create({ user: req.user._id, subject, message }));
  } catch (error) { return bookingErrorResponse(res, error); }
};
export const myComplaints = async (req, res) => {
  try { return res.json(await Complaint.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(200)); }
  catch (error) { return bookingErrorResponse(res, error); }
};
export const checkInHistory = async (req, res) => {
  try {
    const { skip, limit } = pageQuery(req.query);
    const filter = {};
    if (req.user.role === 'organizer') {
      filter.tenantId = req.user._id;
      filter.eventId = { $in: await Event.find({ tenantId: req.user._id }).distinct('_id') };
    }
    if (req.query.eventId) {
      if (!mongoId(req.query.eventId)) throw new BookingError(400, 'Invalid event ID.');
      if (req.user.role === 'organizer' && !await Event.exists({ _id: req.query.eventId, tenantId: req.user._id })) throw new BookingError(404, 'Event not found.');
      filter.eventId = req.query.eventId;
    }
    if (req.query.status !== undefined) {
      if (!['used', 'unused'].includes(req.query.status)) throw new BookingError(400, 'Invalid check-in status.');
      filter.isCheckedIn = req.query.status === 'used';
    }
    const records = await Booking.find(filter).select('bookingId eventId ticketQuantity ticketType ticketStatus isCheckedIn checkedInAt bookingStatus')
      .populate('eventId', 'title').sort({ checkedInAt: -1, createdAt: -1 }).skip(skip).limit(limit);
    return res.json({ records, total: await Booking.countDocuments(filter) });
  } catch (error) { return bookingErrorResponse(res, error); }
};
