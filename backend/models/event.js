import mongoose from 'mongoose';

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
    bannerUrl: { type: String, default: '' },
    date: { type: Date, required: true },
    location: { type: String, required: true },
    ticketPrice: { type: Number, required: true, min: 0 },
    totalCapacity: { type: Number, required: true, min: 1 },
    availableTickets: { type: Number, required: true, min: 0 },
    isPublished: { type: Boolean, default: true },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    }
  },
  { timestamps: true }
);

const Event = mongoose.model('Event', eventSchema);
export default Event;