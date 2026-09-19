import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  getUsers,
  updateUserRole,
  updateUserStatus,
  deleteUser,
  getOrganizers,
  approveOrganizer,
  rejectOrganizer,
  updateOrganizerPlan,
  getPayouts,
  processPayout,
  rejectPayout,
  getEvents,
  approveEvent,
  rejectEvent,
  getCategories,
  createCategory,
  deleteCategory,
  getVenues,
  createVenue,
  deleteVenue,
  getTransactions,
  refundTransaction,
  getComplaints,
  resolveComplaint,
} from '../controllers/adminController.js';

const router = express.Router();

// All admin routes require token authentication & superadmin / admin role
router.use(protect);
router.use(authorize('superadmin', 'admin'));

// User Management
router.get('/users', getUsers);
router.put('/users/:id/role', updateUserRole);
router.put('/users/:id/status', updateUserStatus);
router.delete('/users/:id', deleteUser);

// SaaS Organizer Management & Verification
router.get('/organizers', getOrganizers);
router.put('/organizers/:id/approve', approveOrganizer);
router.put('/organizers/:id/reject', rejectOrganizer);
router.put('/organizers/:id/plan', updateOrganizerPlan);

// Payout Requests Management
router.get('/payouts', getPayouts);
router.put('/payouts/:id/process', processPayout);
router.put('/payouts/:id/reject', rejectPayout);

// Event Moderation
router.get('/events', getEvents);
router.put('/events/:id/approve', approveEvent);
router.put('/events/:id/reject', rejectEvent);

// Category & Venue Management
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.delete('/categories/:id', deleteCategory);

router.get('/venues', getVenues);
router.post('/venues', createVenue);
router.delete('/venues/:id', deleteVenue);

// Payments & Refunds
router.get('/transactions', getTransactions);
router.put('/transactions/:id/refund', refundTransaction);

// Complaints & Support
router.get('/complaints', getComplaints);
router.put('/complaints/:id/resolve', resolveComplaint);

export default router;
