import express from 'express';
import {
  getEventBookingsForOrganizer,
  getEventStatsForOrganizer,
} from '../controllers/analyticsController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

import { organizerDashboard, adminDashboard } from '../controllers/dashboardController.js';
const router = express.Router();

router.get('/organizer', protect, authorize('organizer'), organizerDashboard);
router.get('/admin', protect, authorize('superadmin'), adminDashboard);
router.get('/events/:eventId/bookings', protect, authorize('organizer'), getEventBookingsForOrganizer);
router.get('/events/:eventId/statistics', protect, authorize('organizer'), getEventStatsForOrganizer);

export default router;