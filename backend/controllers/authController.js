import { profileFields } from '../utils/phase3Validation.js';
import { bookingErrorResponse } from '../config/bookingSecurity.js';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { generateToken } from '../utils/authTokens.js';
import { userResponse } from '../utils/userResponse.js';
import { normalizeEmail, validEmail, validPassword, passwordMessage, validLoginPassword,
  normalizeOtp, validOtp, validName } from '../utils/authValidation.js';
import { assertEmailConfigured } from '../utils/sendEmail.js';
import { issueOtp, reserveOtpAttempt, matchingOtp, consumeOtpFilter, clearOtpFields } from '../utils/authOtp.js';

const invalidCode = (res) => res.status(400).json({ message: 'Invalid or expired code. Request a new code if needed.' });
const authError = (res, error) => res.status(error.status === 503 ? 503 : 500).json({
  message: error.status === 503 ? 'Email delivery is unavailable. Please try again later or contact support.' :
    'Unable to complete authentication. Please try again later.',
});
const registrationResponse = (res, email) => res.status(201).json({
  message: 'If this account is eligible, a verification email will be sent. Otherwise, sign in or reset your password.',
  email, requiresVerification: true,
});
const deliveryResponse = (res) => res.json({
  message: 'If this account is eligible, an email will be sent. Check your inbox or try again later.',
});

export const registerUser = async (req, res) => {
  try {
    const body = req.body || {};
    const email = normalizeEmail(body.email);
    const name = typeof body.name === 'string' ? body.name.trim() :
      [body.firstName, body.lastName].filter((part) => typeof part === 'string').join(' ').trim();
    if (!validName(name)) return res.status(400).json({ message: 'Name must contain between 2 and 100 characters.' });
    if (!validEmail(email)) return res.status(400).json({ message: 'A valid email address is required.' });
    if (!validPassword(body.password)) return res.status(400).json({ message: passwordMessage });
    if (body.role !== undefined && !['customer', 'organizer'].includes(body.role)) {
      return res.status(400).json({ message: 'Invalid registration role.' });
    }
    for (const field of ['firstName', 'lastName']) {
      if (body[field] !== undefined && (typeof body[field] !== 'string' || body[field].trim().length > 60 ||
          /[\u0000-\u001f\u007f]/.test(body[field]))) { // eslint-disable-line no-control-regex -- Reject control characters in names.
        return res.status(400).json({ message: 'Invalid name.' });
      }
    }
    if (body.contactNumber !== undefined && (typeof body.contactNumber !== 'string' ||
        (body.contactNumber && !/^[+()0-9\s-]{7,32}$/.test(body.contactNumber)))) {
      return res.status(400).json({ message: 'Invalid contact number.' });
    }
    if (body.verificationMethod !== undefined && body.verificationMethod !== 'email') {
      return res.status(400).json({ message: 'Email verification is required.' });
    }
    assertEmailConfigured();
    const existing = await User.findOne({ email });
    if (existing) {
      if (!existing.isVerified) await issueOtp(existing, 'verification');
      return registrationResponse(res, email);
    }
    const user = await User.create({
      firstName: body.firstName?.trim(), lastName: body.lastName?.trim(), name,
      contactNumber: body.contactNumber?.trim(), email, password: body.password,
      verificationMethod: 'email', role: body.role || 'customer', isVerified: false,
    });
    await issueOtp(user, 'verification');
    return registrationResponse(res, email);
  } catch (error) {
    if (error.code === 11000) return registrationResponse(res, normalizeEmail(req.body?.email));
    return authError(res, error);
  }
};

export const verifyOTP = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!validEmail(email) || !validOtp(req.body?.otp)) return invalidCode(res);
    const user = await reserveOtpAttempt(email, 'verification');
    if (!matchingOtp(user, email, 'verification', normalizeOtp(req.body.otp))) return invalidCode(res);
    const verified = await User.findOneAndUpdate(consumeOtpFilter(user, 'verification'), {
      $set: { isVerified: true }, $unset: clearOtpFields('verification'),
    }, { returnDocument: 'after' }).select('+sessionVersion');
    if (!verified) return invalidCode(res);
    return res.json({ message: 'Email successfully verified!', ...userResponse(verified), token: generateToken(verified) });
  } catch (error) { return authError(res, error); }
};

export const resendOTP = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!validEmail(email)) return res.status(400).json({ message: 'A valid email address is required.' });
    assertEmailConfigured();
    const user = await User.findOne({ email, isVerified: false });
    if (user) await issueOtp(user, 'verification');
    return deliveryResponse(res);
  } catch (error) { return authError(res, error); }
};

export const loginUser = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!validEmail(email) || !validLoginPassword(req.body?.password)) {
      return res.status(400).json({ message: 'Valid email and password are required.' });
    }
    const user = await User.findOne({ email }).select('+password +sessionVersion');
    if (!user || !(await user.matchPassword(req.body.password)) || user.accountStatus === 'suspended') {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    if (!user.isVerified) {
      await issueOtp(user, 'verification');
      return res.status(403).json({
        message: 'Please verify your email. Check your inbox or request a new code.',
        email, requiresVerification: true,
      });
    }
    return res.json({ ...userResponse(user), token: generateToken(user) });
  } catch (error) { return authError(res, error); }
};

export const getUserProfile = async (req, res) => res.json(userResponse(req.user));

export const forgotPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!validEmail(email)) return res.status(400).json({ message: 'A valid email address is required.' });
    assertEmailConfigured();
    const user = await User.findOne({ email });
    if (user) await issueOtp(user, 'reset');
    return deliveryResponse(res);
  } catch (error) { return authError(res, error); }
};

export const resetPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!validEmail(email) || !validOtp(req.body?.otp)) return invalidCode(res);
    if (!validPassword(req.body?.newPassword)) return res.status(400).json({ message: passwordMessage });
    const user = await reserveOtpAttempt(email, 'reset');
    if (!matchingOtp(user, email, 'reset', normalizeOtp(req.body.otp))) return invalidCode(res);
    const password = await bcrypt.hash(req.body.newPassword, 10);
    // Hash explicitly because query updates do not execute the model's save hook.
    const updated = await User.findOneAndUpdate(consumeOtpFilter(user, 'reset'), {
      $set: { password }, $inc: { sessionVersion: 1 },
      $unset: { ...clearOtpFields('reset'), ...clearOtpFields('verification') },
    }, { returnDocument: 'after' });
    if (!updated) return invalidCode(res);
    return res.json({ message: 'Password reset successfully! Please log in with your new password.' });
  } catch (error) { return authError(res, error); }
};

export const updateUserProfile = async (req, res) => {
  try {
    const updated = await User.findByIdAndUpdate(req.user._id, { $set: profileFields(req.body) }, { returnDocument: 'after', runValidators: true });
    return res.json(userResponse(updated));
  } catch (error) { return bookingErrorResponse(res, error); }
};
