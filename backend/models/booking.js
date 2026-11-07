import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      unique: true,
      index: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    locationName: { type: String, default: '' },
    ticketTierId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    ticketQuantity: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    ticketType: { type: String, default: 'General' },
    unitPrice: { type: Number, default: 0 },
    customerName: { type: String },
    customerEmail: { type: String },
    customerPhone: { type: String },
    requestKey: { type: String, select: false },
    requestFingerprint: { type: String, select: false },
    paymentVersion: { type: Number },
    notificationState: { type: String, select: false },
    currency: { type: String, default: 'usd' },
    amountCents: { type: Number, min: 0, validate: Number.isSafeInteger },
    subtotal: { type: Number, min: 0 },
    locationStartDateTime: { type: Date },
    locationEndDateTime: { type: Date },
    reservationState: { type: String, enum: ['NONE', 'NEW', 'HELD', 'CONSUMED', 'RELEASED'], default: 'NONE' },
    reservationExpiresAt: { type: Date, index: true },
    paymentFlow: { type: String, enum: ['checkout', 'intent'] },
    paymentParameters: { type: mongoose.Schema.Types.Mixed, select: false },
    stripeCheckoutSessionId: { type: String },
    paymentVerifiedAt: { type: Date },
    stripeRefundId: { type: String },
    externalRefundDetected: { type: Boolean, default: false },
    refundedAmount: { type: Number, min: 0, default: 0 },
    refundRequested: { type: Boolean, default: false },
    paymentReviewRequired: { type: Boolean, default: false },
    needsReconciliation: { type: Boolean, default: false },
    providerClosed: { type: Boolean, default: false },
    lastReconciledAt: { type: Date },
    checkedInAt: { type: Date },
    paymentMethod: { type: String, default: 'Stripe Payment Gateway' },
    stripePaymentIntentId: { type: String },
    totalAmount: { type: Number, required: true },
    platformFee: { type: Number, required: true }, // 5% platform fee
    organizerRevenue: { type: Number, required: true }, // 95% organizer revenue
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded', 'PENDING', 'PAID', 'FAILED', 'REFUNDED'],
      default: 'pending',
    },
    bookingStatus: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED', 'EXPIRED'],
      default: 'PENDING',
    },
    ticketStatus: {
      type: String,
      enum: ['PENDING', 'VALID', 'USED', 'CANCELLED'],
      default: 'PENDING',
    },
    qrToken: { type: String, unique: true, sparse: true },
    qrCodeString: { type: String, unique: true },
    isCheckedIn: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Partial indexes exclude legacy records and unbound pending payments.
bookingSchema.index({ customerId: 1, requestKey: 1 }, {
  unique: true, partialFilterExpression: { paymentVersion: 2, requestKey: { $type: 'string' } },
});
bookingSchema.index({ stripePaymentIntentId: 1 }, {
  unique: true, partialFilterExpression: { paymentVersion: 2, stripePaymentIntentId: { $type: 'string' } },
});
bookingSchema.index({ stripeCheckoutSessionId: 1 }, {
  unique: true, partialFilterExpression: { stripeCheckoutSessionId: { $type: 'string' } },
});
const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;