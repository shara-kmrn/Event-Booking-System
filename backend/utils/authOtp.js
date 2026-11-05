import crypto from 'crypto';
import User from '../models/User.js';
import sendEmail, { assertEmailConfigured } from './sendEmail.js';
import { getSecurityConfig } from '../config/security.js';
import { escapeHtml } from './authValidation.js';

export const otpFields = (purpose) => purpose === 'verification' ? {
  hash: 'otpHash', expires: 'otpExpires', attempts: 'otpAttempts', sent: 'otpLastSentAt',
  window: 'otpSendWindowStart', count: 'otpSendCount', legacy: 'otp',
} : {
  hash: 'resetPasswordOtpHash', expires: 'resetPasswordExpires', attempts: 'resetPasswordAttempts',
  sent: 'resetPasswordLastSentAt', window: 'resetPasswordSendWindowStart',
  count: 'resetPasswordSendCount', legacy: 'resetPasswordOtp',
};
export const hashOtp = (email, purpose, otp) => crypto.createHmac('sha256', getSecurityConfig().secret)
  .update(`${purpose}:${email}:${otp}`).digest('hex');

// Claim a send slot atomically so login/register/resend cannot bypass cooldowns.
export const issueOtp = async (user, purpose) => {
  assertEmailConfigured();
  const config = getSecurityConfig();
  const fields = otpFields(purpose);
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 3600000);
  const cooldown = new Date(now.getTime() - config.otpCooldownSeconds * 1000);
  const otp = crypto.randomInt(100000, 1000000).toString();
  const hash = hashOtp(user.email, purpose, otp);
  const freshWindow = { $lte: [{ $ifNull: [`$${fields.window}`, new Date(0)] }, hourAgo] };
  const claimed = await User.findOneAndUpdate({
    _id: user._id,
    ...(purpose === 'verification' ? { isVerified: false } : {}),
    $and: [
      { $or: [{ [fields.sent]: { $exists: false } }, { [fields.sent]: { $lte: cooldown } }] },
      { $or: [{ [fields.window]: { $exists: false } }, { [fields.window]: { $lte: hourAgo } },
        { [fields.count]: { $lt: config.otpMaxSendsPerHour } }] },
    ],
  }, [{ $set: {
    [fields.hash]: hash,
    [fields.expires]: new Date(now.getTime() + config.otpTtlSeconds * 1000),
    [fields.attempts]: 0,
    [fields.sent]: now,
    [fields.window]: { $cond: [freshWindow, now, `$${fields.window}`] },
    [fields.count]: { $cond: [freshWindow, 1, { $add: [{ $ifNull: [`$${fields.count}`, 0] }, 1] }] },
  } }, { $unset: fields.legacy }], { returnDocument: 'after', updatePipeline: true });
  if (!claimed) return false;
  try {
    const action = purpose === 'verification' ? 'Verify your email address' : 'Reset your password';
    await sendEmail({
      to: user.email, subject: `Eventra - ${action}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:500px;padding:24px"><h1>Eventra</h1>
        <h2>${action}</h2><p>Hello ${escapeHtml(user.name)},</p>
        <p>Your one-time code is <strong style="letter-spacing:4px">${otp}</strong>.</p>
        <p>This code expires in ${config.otpTtlSeconds / 60} minutes. If you did not request it, ignore this email.</p></div>`,
    });
    return true;
  } catch (error) {
    // Do not leave a usable, undelivered code. Keep the hourly counter.
    await User.updateOne({ _id: user._id, [fields.hash]: hash },
      { $unset: { [fields.hash]: '', [fields.expires]: '', [fields.sent]: '' } });
    throw error;
  }
};

export const reserveOtpAttempt = async (email, purpose) => {
  const fields = otpFields(purpose);
  return User.findOneAndUpdate({
    email, ...(purpose === 'verification' ? { isVerified: false } : {}),
    [fields.hash]: { $exists: true },
    [fields.expires]: { $gt: new Date() },
    [fields.attempts]: { $lt: getSecurityConfig().otpMaxAttempts },
  }, { $inc: { [fields.attempts]: 1 } }, { returnDocument: 'after' })
    .select(`+${fields.hash} +${fields.expires} +${fields.attempts} +sessionVersion`);
};

export const matchingOtp = (user, email, purpose, otp) => {
  const stored = user?.[otpFields(purpose).hash];
  if (typeof stored !== 'string' || !/^[a-f0-9]{64}$/.test(stored)) return false;
  return crypto.timingSafeEqual(Buffer.from(stored, 'hex'), Buffer.from(hashOtp(email, purpose, otp), 'hex'));
};

export const consumeOtpFilter = (user, purpose) => {
  const fields = otpFields(purpose);
  return {
    _id: user._id,
    [fields.hash]: user[fields.hash],
    [fields.expires]: { $gt: new Date() },
    [fields.attempts]: { $lte: getSecurityConfig().otpMaxAttempts },
    ...(purpose === 'verification' ? { isVerified: false } : {}),
  };
};
export const clearOtpFields = (purpose) => {
  const fields = otpFields(purpose);
  return { [fields.hash]: '', [fields.expires]: '', [fields.attempts]: '', [fields.legacy]: '' };
};
