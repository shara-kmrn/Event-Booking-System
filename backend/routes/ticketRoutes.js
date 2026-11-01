import express from 'express';
import { verifyTicket } from '../controllers/bookingController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Gate ticket verification & check-in (Organizer only)
router.post('/verify', protect, authorize('organizer'), verifyTicket);
router.post('/check-in', protect, authorize('organizer'), verifyTicket);

export default router;
