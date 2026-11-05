import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { getSecurityConfig, createCorsOptions } from './config/security.js';

import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import paymentRoutes, { mountStripeWebhooks } from './routes/paymentRoutes.js';
import Booking from './models/booking.js';
import StripeWebhookEvent from './models/StripeWebhookEvent.js';
import { validateBookingConfiguration } from './config/bookingSecurity.js';
import { startBookingMaintenance } from './services/bookingMaintenance.js';
import ticketRoutes from './routes/ticketRoutes.js';

let security;
try { security = getSecurityConfig(); validateBookingConfiguration(); }
catch (error) {
  console.error(`Startup configuration error: ${error.message}`);
  process.exit(1);
}
if (process.env.NODE_ENV !== 'production' && Buffer.byteLength(security.secret) < 32) {
  console.warn('Use a random JWT_SECRET of at least 32 bytes before production.');
}
if (!process.env.SMTP_HOST || !process.env.FROM_EMAIL) {
  console.warn('SMTP is not configured. Email-dependent authentication will return HTTP 503 until configured.');
}
await connectDB();
try {
  await Promise.all([Booking.init(), StripeWebhookEvent.init()]);
  // init() can skip index creation when autoIndex is disabled. Explicitly
  // ensure critical indexes without dropping or synchronizing existing indexes.
  await Promise.all([Booking.createIndexes(), StripeWebhookEvent.createIndexes()]);
  console.log('Critical booking indexes initialized successfully.');
} catch (error) {
  console.error('Booking index initialization failed. Startup stopped safely.', {
    name: error.name,
    code: error.code,
    codeName: error.codeName,
    message: error.message,
    keyPattern: error.keyPattern,
    keyValue: error.keyValue,
  });
  if (error.code === 11000) {
    console.error('Existing data violates a required unique index. Review the conflicting records before an explicitly approved migration; no records or indexes were removed.');
  }
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', security.trustProxyHops);

app.use(cors(createCorsOptions(security)));

mountStripeWebhooks(app);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'Backend is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/organizer', analyticsRoutes);


app.use((req, res) => res.status(404).json({ message: 'Resource not found.' }));

// Never return raw parser, CORS, or framework errors to clients.
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = [400, 403, 413].includes(error.status) ? error.status : 500;
  return res.status(status).json({ message: status === 403 ? 'Origin not allowed.' :
    status === 400 ? 'Invalid request body.' : status === 413 ? 'Request body is too large.' : 'Unable to process request.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startBookingMaintenance();
});