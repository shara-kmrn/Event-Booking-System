import express from 'express';
import { createBooking, getMyBookings, getBookingById, verifyTicket } from '../controllers/bookingController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Customer actions
router.post('/', protect, createBooking);
router.get('/my-bookings', protect, getMyBookings);
router.get('/:bookingId', protect, getBookingById);

// Gate check-in & ticket verification (Organizer only)
router.post('/verify-ticket', protect, authorize('organizer'), verifyTicket);

export default router;