import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { stripAuthFields } from '../utils/userResponse.js';

const privateString = () => ({ type: String, select: false });
const privateDate = () => ({ type: Date, select: false });
const privateCount = () => ({ type: Number, default: 0, min: 0, select: false });
const userSchema = new mongoose.Schema({
  firstName: { type: String, trim: true },
  lastName: { type: String, trim: true },
  name: { type: String, required: true, trim: true },
  contactNumber: { type: String, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  verificationMethod: { type: String, enum: ['email', 'sms'], default: 'email' },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['superadmin', 'organizer', 'customer'], default: 'customer' },
  isVerified: { type: Boolean, default: false },
  // Legacy plaintext fields are hidden and never accepted; resend replaces them.
  otp: privateString(),
  otpHash: privateString(),
  otpExpires: privateDate(),
  otpAttempts: privateCount(),
  otpLastSentAt: privateDate(),
  otpSendWindowStart: privateDate(),
  otpSendCount: privateCount(),
  resetPasswordOtp: privateString(),
  resetPasswordOtpHash: privateString(),
  resetPasswordExpires: privateDate(),
  resetPasswordAttempts: privateCount(),
  resetPasswordLastSentAt: privateDate(),
  resetPasswordSendWindowStart: privateDate(),
  resetPasswordSendCount: privateCount(),
  sessionVersion: privateCount(),
  accountStatus: { type: String, enum: ['active', 'suspended'], default: 'active' },
  subscriptionPlan: { type: String, enum: ['free', 'pro'], default: 'free' },
}, {
  timestamps: true,
  toJSON: { transform: stripAuthFields },
  toObject: { transform: stripAuthFields },
});

userSchema.pre('save', async function () {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model('User', userSchema);
