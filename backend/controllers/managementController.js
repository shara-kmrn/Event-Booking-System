import User from '../models/User.js';
import Event from '../models/event.js';
import Complaint from '../models/complaints.js';
import { userResponse, PUBLIC_USER_FIELDS } from '../utils/userResponse.js';
import { BookingError, bookingErrorResponse, mongoId } from '../config/bookingSecurity.js';
import { text, literalSearch, pageQuery } from '../utils/phase3Validation.js';
import { notifyEvent } from '../services/notificationService.js';
import { manageEvent } from '../services/eventManagement.js';
export const listUsers = async (req, res) => {
  try {
    const filter = {}, { skip, limit } = pageQuery({ ...req.query, limit: req.query.limit ?? '100' });
    if (req.query.search) { const value = { $regex: literalSearch(req.query.search), $options: 'i' }; filter.$or = [{ name: value }, { email: value }]; }
    if (req.query.role) {
      if (!['customer','organizer','superadmin'].includes(req.query.role)) throw new BookingError(400, 'Invalid role.');
      filter.role = req.query.role;
    }
    if (req.query.status) {
      if (!['active','suspended'].includes(req.query.status)) throw new BookingError(400, 'Invalid account status.');
      filter.accountStatus = req.query.status === 'active' ? { $ne: 'suspended' } : 'suspended';
    }
    return res.json(await User.find(filter).select(PUBLIC_USER_FIELDS).sort({ createdAt: -1 }).skip(skip).limit(limit));
  } catch (error) { return bookingErrorResponse(res, error); }
};
export const setAccountStatus = async (req, res) => {
  try {
    if (!mongoId(req.params.id)) throw new BookingError(400, 'Invalid user ID.');
    const status = req.body?.accountStatus;
    if (!['active','suspended'].includes(status)) throw new BookingError(400, 'Invalid account status.');
    const updated = await User.findOneAndUpdate({ _id: req.params.id, role: { $ne: 'superadmin' } },
      { $set: { accountStatus: status }, $inc: { sessionVersion: 1 } }, { returnDocument: 'after', runValidators: true });
    if (!updated) throw new BookingError(409, 'Administrator accounts cannot be suspended through this action.');
    return res.json({ user: userResponse(updated), message: 'Account ' + status + '. Existing sessions revoked.' });
  } catch (error) { return bookingErrorResponse(res, error); }
};
export const moderateEvent = (approvalStatus) => async (req, res) => {
  try {
    if (!mongoId(req.params.id)) throw new BookingError(400, 'Invalid event ID.');
    const rejectionReason = approvalStatus === 'rejected' ? text(req.body?.reason, 'rejection reason', 1000, 5) : '';
    const event = await Event.findOneAndUpdate({ _id: req.params.id, approvalStatus: 'pending', isCancelled: { $ne: true }, endDateTime: { $gt: new Date() } },
      { $set: { approvalStatus, rejectionReason } }, { returnDocument: 'after', runValidators: true });
    if (!event) throw new BookingError(409, 'Only pending, active events can be reviewed.');
    await notifyEvent(event, approvalStatus);
    return res.json({ event, message: 'Event ' + approvalStatus + '.' });
  } catch (error) { return bookingErrorResponse(res, error); }
};
export const cancelEventAdmin = async (req, res) => {
  try { return res.json({ event: await manageEvent(req.params.id, req.user, req.body, 'cancel'), message: 'Event cancelled; process paid refunds separately.' }); }
  catch (error) { return bookingErrorResponse(res, error); }
};
export const respondComplaint = async (req, res) => {
  try {
    if (!mongoId(req.params.id)) throw new BookingError(400, 'Invalid complaint ID.');
    const status = req.body?.status ?? 'resolved';
    if (!['open','resolved'].includes(status)) throw new BookingError(400, 'Invalid complaint status.');
    const response = text(req.body?.response, 'response', 5000, 3);
    const complaint = await Complaint.findByIdAndUpdate(req.params.id, { $set: { status, response, respondedAt: new Date() } }, { returnDocument: 'after', runValidators: true });
    if (!complaint) throw new BookingError(404, 'Complaint not found.');
    return res.json({ complaint, message: 'Complaint updated.' });
  } catch (error) { return bookingErrorResponse(res, error); }
};
