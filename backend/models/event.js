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
    category: {
      type: String,
      default: 'Music & Concerts',
    },
    bannerUrl: { type: String, default: '' },
    date: { type: Date, required: true },
    startTime: { type: String, default: '07:00 PM' },
    endTime: { type: String, default: '11:00 PM' },
    location: { type: String, required: true },
    ticketPrice: { type: Number, required: true, min: 0 },
    totalCapacity: { type: Number, required: true, min: 1 },
    availableTickets: { type: Number, required: true, min: 0 },
    ticketTypes: [
      {
        name: { type: String, required: true },
        price: { type: Number, required: true, min: 0 },
        quantity: { type: Number, required: true, min: 0 },
        availableQuantity: { type: Number, required: true, min: 0 },
      },
    ],
    contactEmail: { type: String, default: '' },
    contactPhone: { type: String, default: '' },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'published',
    },
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