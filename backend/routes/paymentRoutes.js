import express from 'express';
import { createPaymentIntent, createCheckoutSession, handleStripeWebhook } from '../controllers/paymentController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();
router.post('/create-payment-intent', protect, authorize('customer'), createPaymentIntent);
router.post('/create-checkout-session', protect, authorize('customer'), createCheckoutSession);

// Mount after CORS and BEFORE every JSON/urlencoded body parser.
export const mountStripeWebhooks = (app) => app.post(
  ['/api/payment/webhook', '/api/payments/webhook'],
  express.raw({ type: 'application/json', limit: '1mb' }), handleStripeWebhook,
);
export default router;
