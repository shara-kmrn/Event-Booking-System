import 'dotenv/config';

export class BookingError extends Error {
  constructor(status, message, code = 'BOOKING_REJECTED') {
    super(message); this.status = status; this.code = code;
  }
}
const integer = (name, fallback, min, max) => {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid configuration: ${name}.`);
  return value;
};
export const bookingConfig = () => ({
  reservationMinutes: integer('BOOKING_RESERVATION_MINUTES', 30, 1, 60),
  maxTickets: integer('BOOKING_MAX_TICKETS', 100, 1, 1000),
  journalLimit: integer('BOOKING_JOURNAL_LIMIT', 5000, 100, 10000),
  timezoneOffsetMinutes: integer('EVENT_TIMEZONE_OFFSET_MINUTES', 330, -840, 840),
  maintenanceSeconds: integer('BOOKING_MAINTENANCE_SECONDS', 30, 10, 300),
});
export const requireStripeConfig = () => {
  if (!/^sk_(test|live)_/.test(process.env.STRIPE_SECRET_KEY || '') ||
      !/^whsec_/.test(process.env.STRIPE_WEBHOOK_SECRET || '')) {
    throw new BookingError(503, 'Payments are unavailable. Stripe configuration is required.', 'PAYMENT_CONFIGURATION');
  }
};
export const validateBookingConfiguration = () => {
  bookingConfig();

  const hasStripeKey = Boolean(process.env.STRIPE_SECRET_KEY);
  const hasWebhookSecret = Boolean(process.env.STRIPE_WEBHOOK_SECRET);

  if (hasStripeKey || hasWebhookSecret) {
    requireStripeConfig();
  } else {
    console.warn(
      'Stripe is not configured. Payment features are unavailable.'
    );
  }
};
export const bookingErrorResponse = (res, error) => res.status(error instanceof BookingError ? error.status : 503).json({
  message: error instanceof BookingError ? error.message : 'Booking service is temporarily unavailable. Please retry with the same request.',
  code: error instanceof BookingError ? error.code : 'BOOKING_UNAVAILABLE',
});
export const mongoId = (value) => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
