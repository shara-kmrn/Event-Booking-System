import express from 'express';
import { createBooking, getMyBookings, getBookingById, confirmBooking, cancelBooking, verifyTicket } from '../controllers/bookingController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

import { submitComplaint, myComplaints } from '../controllers/customerController.js';
const router = express.Router();
router.get('/complaints', protect, authorize('customer'), myComplaints);
router.post('/complaints', protect, authorize('customer'), submitComplaint);
router.post('/', protect, authorize('customer'), createBooking);
router.get('/my-bookings', protect, authorize('customer'), getMyBookings);
router.post('/verify-ticket', protect, authorize('organizer'), verifyTicket);
router.post('/:bookingId/confirm', protect, authorize('customer'), confirmBooking);
router.post('/:bookingId/cancel', protect, authorize('customer'), cancelBooking);
router.get('/:bookingId', protect, getBookingById);
export default router;
