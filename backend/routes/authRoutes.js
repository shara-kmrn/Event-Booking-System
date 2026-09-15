import express from 'express';
import { registerUser, loginUser, getUserProfile, verifyOTP, resendOTP } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/login', loginUser);
router.get('/profile', protect, getUserProfile);

export default router;