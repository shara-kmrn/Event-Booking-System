import express from 'express';
import {
  createEvent,
  getAllEvents,
  getOrganizerEvents,
  getEventById,
  deleteEvent,
} from '../controllers/eventController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public Routes
router.get('/', getAllEvents);
router.get('/:id', getEventById);

// Protected Organizer Routes
router.post('/', protect, authorize('organizer'), createEvent);
router.get('/my/tenant-events', protect, authorize('organizer'), getOrganizerEvents);
router.delete('/:id', protect, authorize('organizer'), deleteEvent);

export default router;