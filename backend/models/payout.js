import mongoose from 'mongoose';

const payoutSchema = new mongoose.Schema(
  {
    organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    bankName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    accountHolder: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'processed', 'rejected'],
      default: 'pending',
    },
    referenceNumber: { type: String },
    notes: { type: String },
  },
  { timestamps: true }
);

const Payout = mongoose.model('Payout', payoutSchema);
export default Payout;
