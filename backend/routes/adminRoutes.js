import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  updateUserRole,
  updateOrganizerPlan,
  getAllEventsAdmin,
  getCategories,
  createCategory,
  deleteCategory,
  getVenues,
  createVenue,
  deleteVenue,
  getAllTransactions,
  processRefund,
  getComplaints,
} from '../controllers/adminController.js';

import { listUsers, setAccountStatus, moderateEvent, cancelEventAdmin, respondComplaint } from '../controllers/managementController.js';
const router = express.Router();

// All routes are protected and strictly accessible ONLY by superadmin
router.use(protect, authorize('superadmin'));

// User & Organizer Management
router.get('/users', listUsers);
router.put('/users/:id/role', updateUserRole);
router.put('/organizers/:id/plan', updateOrganizerPlan);
router.put('/users/:id/status', setAccountStatus);

// Event Approvals & Moderation
router.get('/events', getAllEventsAdmin);
router.put('/events/:id/approve', moderateEvent('approved'));
router.put('/events/:id/reject', moderateEvent('rejected'));
router.post('/events/:id/cancel', cancelEventAdmin);

// Category Management
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.delete('/categories/:id', deleteCategory);

// Venue Management
router.get('/venues', getVenues);
router.post('/venues', createVenue);
router.delete('/venues/:id', deleteVenue);

// Transactions & Refund Processing
router.get('/transactions', getAllTransactions);
router.put('/transactions/:id/refund', processRefund);

// Complaints & Support
router.get('/complaints', getComplaints);
router.put('/complaints/:id/resolve', respondComplaint);

export default router;
