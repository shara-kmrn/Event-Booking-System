import express from 'express';
import {
  updateUserProfile,
  registerUser,
  loginUser,
  getUserProfile,
  verifyOTP,
  resendOTP,
  forgotPassword,
  resetPassword,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authRateLimit } from '../middleware/authRateLimit.js';

const router = express.Router();

router.post('/register', authRateLimit('register'), registerUser);
router.post('/verify-otp', authRateLimit('verify'), verifyOTP);
router.post('/resend-otp', authRateLimit('resend'), resendOTP);
router.post('/login', authRateLimit('login'), loginUser);
router.post('/forgot-password', authRateLimit('forgot'), forgotPassword);
router.post('/reset-password', authRateLimit('reset'), resetPassword);
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);

export default router;