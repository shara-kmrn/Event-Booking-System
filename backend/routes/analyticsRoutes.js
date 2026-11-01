import express from 'express';
import {
  getOrganizerStats,
  getAdminStats,
  getEventBookingsForOrganizer,
  getEventStatsForOrganizer,
} from '../controllers/analyticsController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/organizer', protect, authorize('organizer'), getOrganizerStats);
router.get('/admin', protect, authorize('superadmin'), getAdminStats);
router.get('/events/:eventId/bookings', protect, authorize('organizer'), getEventBookingsForOrganizer);
router.get('/events/:eventId/statistics', protect, authorize('organizer'), getEventStatsForOrganizer);

export default router;