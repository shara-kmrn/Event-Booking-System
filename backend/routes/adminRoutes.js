import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  getAllUsers,
  updateUserRole,
  updateOrganizerPlan,
  deleteUser,
  getAllEventsAdmin,
  approveEvent,
  rejectEvent,
  getCategories,
  createCategory,
  deleteCategory,
  getVenues,
  createVenue,
  deleteVenue,
  getAllTransactions,
  processRefund,
  getComplaints,
  resolveComplaint,
} from '../controllers/adminController.js';

const router = express.Router();

// All routes are protected and strictly accessible ONLY by superadmin
router.use(protect, authorize('superadmin'));

// User & Organizer Management
router.get('/users', getAllUsers);
router.put('/users/:id/role', updateUserRole);
router.put('/organizers/:id/plan', updateOrganizerPlan);
router.delete('/users/:id', deleteUser);

// Event Approvals & Moderation
router.get('/events', getAllEventsAdmin);
router.put('/events/:id/approve', approveEvent);
router.put('/events/:id/reject', rejectEvent);

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
router.put('/complaints/:id/resolve', resolveComplaint);

export default router;
