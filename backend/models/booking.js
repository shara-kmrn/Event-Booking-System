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
    ticketQuantity: { type: Number, required: true, min: 1 },
    ticketType: { type: String, default: 'General' },
    unitPrice: { type: Number, default: 0 },
    customerName: { type: String },
    customerEmail: { type: String },
    customerPhone: { type: String },
    paymentMethod: { type: String, default: 'Stripe Payment Gateway' },
    stripePaymentIntentId: { type: String },
    totalAmount: { type: Number, required: true },
    platformFee: { type: Number, required: true }, // 5% platform fee
    organizerRevenue: { type: Number, required: true }, // 95% organizer revenue
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded', 'PENDING', 'PAID', 'FAILED', 'REFUNDED'],
      default: 'paid',
    },
    bookingStatus: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'CANCELLED'],
      default: 'CONFIRMED',
    },
    ticketStatus: {
      type: String,
      enum: ['VALID', 'USED', 'CANCELLED'],
      default: 'VALID',
    },
    qrToken: { type: String, unique: true, sparse: true },
    qrCodeString: { type: String, unique: true },
    isCheckedIn: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;