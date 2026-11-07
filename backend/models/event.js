import mongoose from 'mongoose';

const ticketTierSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  totalQuantity: { type: Number, required: true, min: 0 },
  reservedQuantity: { type: Number, default: 0, min: 0 },
  soldQuantity: { type: Number, default: 0, min: 0 },
  availableQuantity: { type: Number, required: true, min: 0 },
  expiryDate: { type: Date, default: null },
});

const locationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  address: { type: String, default: '' },
  date: { type: Date },
  startTime: { type: String, default: '07:00 PM' },
  endTime: { type: String, default: '11:00 PM' },
  startDateTime: { type: Date },
  endDateTime: { type: Date },
  ticketTiers: [ticketTierSchema],
});

const eventSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true, // Query performance for tenant isolation
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: {
      type: String,
      default: 'Music & Concerts',
    },
    bannerUrl: { type: String, default: '' },
    startDateTime: { type: Date, required: true, index: true },
    endDateTime: { type: Date, required: true, index: true },
    date: { type: Date, required: true },
    startTime: { type: String, default: '07:00 PM' },
    endTime: { type: String, default: '11:00 PM' },
    location: { type: String, required: true },
    locations: [locationSchema],
    schedules: [
      {
        location: { type: String, required: true },
        date: { type: Date, required: true },
        startTime: { type: String, default: '07:00 PM' },
        endTime: { type: String, default: '11:00 PM' },
      },
    ],
    ticketPrice: { type: Number, required: true, min: 0 },
    totalCapacity: { type: Number, required: true, min: 1 },
    availableTickets: { type: Number, required: true, min: 0 },
    ticketTypes: [ticketTierSchema],
    contactEmail: { type: String, default: '' },
    contactPhone: { type: String, default: '' },
    status: {
      type: String,
      enum: ['draft', 'published', 'cancelled'],
      default: 'published',
    },
    isPublished: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    isCancelled: { type: Boolean, default: false },
    cancelledAt: { type: Date, default: null },
    bookingClosesAt: { type: Date, default: null },
    // Inventory and its reservation journal change in the same MongoDB document.
    // Hidden from public/organizer responses; retained for crash recovery and idempotency.
    reservationJournal: { type: [new mongoose.Schema({
      booking: { type: mongoose.Schema.Types.ObjectId, required: true },
      location: { type: mongoose.Schema.Types.ObjectId, required: true },
      tier: { type: mongoose.Schema.Types.ObjectId, required: true },
      quantity: { type: Number, required: true },
      expiresAt: { type: Date, required: true },
      status: { type: String, enum: ['HELD', 'CONSUMED', 'RELEASED'], required: true },
      terminalStatus: { type: String, enum: ['FAILED', 'CANCELLED', 'EXPIRED'] },
      paymentIntentId: { type: String },
      verifiedAt: { type: Date },
    }, { _id: false })], default: [], select: false },
    cancellationReason: { type: String, default: '' },
    rejectionReason: { type: String, default: '' },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

// Method to get dynamic lifecycle status
eventSchema.methods.getLifecycleStatus = function (currentTime = new Date()) {
  const now = new Date(currentTime);
  if (now < this.startDateTime) {
    return 'UPCOMING';
  } else if (now >= this.startDateTime && now < this.endDateTime) {
    return 'ONGOING';
  } else {
    return 'COMPLETED';
  }
};

const Event = mongoose.model('Event', eventSchema);
export default Event;