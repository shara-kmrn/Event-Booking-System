import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  _id: { type: String },
  type: { type: String, required: true },
  status: { type: String, enum: ['PROCESSING', 'PROCESSED', 'RETRY'], required: true },
  leaseToken: { type: String },
  leaseUntil: { type: Date },
  processedAt: { type: Date },
}, { timestamps: true, versionKey: false });
// Retain processed IDs: late replays must not recreate transactions.
export default mongoose.model('StripeWebhookEvent', schema);
