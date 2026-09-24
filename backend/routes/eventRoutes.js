import express from 'express';
import {
  createEvent,
  getAllEvents,
  getOrganizerEvents,
  getEventById,
  deleteEvent,
  getCategoriesPublic,
} from '../controllers/eventController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Protected Organizer Routes
router.get('/organizer', protect, authorize('organizer'), getOrganizerEvents);
router.get('/my/tenant-events', protect, authorize('organizer'), getOrganizerEvents);
router.post('/', protect, authorize('organizer'), createEvent);
router.delete('/:id', protect, authorize('organizer'), deleteEvent);

// Public Routes
router.get('/categories', getCategoriesPublic);
router.get('/', getAllEvents);
router.get('/:id', getEventById);

export default router;