import express from 'express';
import { getOrganizerStats, getAdminStats } from '../controllers/analyticsController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/organizer', protect, authorize('organizer'), getOrganizerStats);
router.get('/admin', protect, authorize('superadmin'), getAdminStats);

export default router;