import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  _id: String, to: { type: String, required: true, select: false }, subject: String, html: { type: String, select: false },
  status: { type: String, enum: ['pending','sending','sent','uncertain','suppressed'], default: 'pending' },
  sentAt: Date, attempts: { type: Number, default: 0 },
}, { timestamps: true, versionKey: false });
schema.index({ status: 1, createdAt: 1 });
export default mongoose.model('Notification', schema);
