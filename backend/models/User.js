import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    contactNumber: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    verificationMethod: {
      type: String,
      enum: ['email', 'sms'],
      default: 'email',
    },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['superadmin', 'organizer', 'customer'],
      default: 'customer',
    },
    // SaaS Multi-tenancy fields (organizers සඳහා)
    subscriptionPlan: {
      type: String,
      enum: ['free', 'pro'],
      default: 'free',
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  
});

// Compare password method
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
