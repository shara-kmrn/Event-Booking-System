import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
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
    },
    ticketQuantity: { type: Number, required: true, min: 1 },
    totalAmount: { type: Number, required: true },
    platformFee: { type: Number, required: true }, // e.g. 5% platform fee
    organizerRevenue: { type: Number, required: true }, // 95% organizer revenue
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
    },
    qrCodeString: { type: String, unique: true },
    isCheckedIn: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;