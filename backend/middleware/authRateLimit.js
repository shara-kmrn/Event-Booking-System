import crypto from 'crypto';
import AuthRateLimit from '../models/AuthRateLimit.js';
import { getSecurityConfig } from '../config/security.js';
import { normalizeEmail, validEmail } from '../utils/authValidation.js';

// MongoDB counters are shared across processes and expire through a TTL index.
export const consumeRateLimit = async (key, max, windowSeconds) => {
  const config = getSecurityConfig();
  const id = crypto.createHmac('sha256', config.secret).update(key).digest('hex');
  const now = new Date();
  const expired = { $lte: [{ $ifNull: ['$expiresAt', new Date(0)] }, now] };
  const update = [{ $set: {
    count: { $cond: [expired, 1, { $add: [{ $ifNull: ['$count', 0] }, 1] }] },
    expiresAt: { $cond: [expired, new Date(now.getTime() + windowSeconds * 1000), '$expiresAt'] },
  } }];
  let counter;
  try {
    counter = await AuthRateLimit.findOneAndUpdate({ _id: id }, update,
      { upsert: true, returnDocument: 'after', updatePipeline: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
    counter = await AuthRateLimit.findOneAndUpdate({ _id: id }, update, { returnDocument: 'after', updatePipeline: true });
  }
  return { allowed: counter.count <= max, remaining: Math.max(0, max - counter.count),
    resetSeconds: Math.max(1, Math.ceil((counter.expiresAt.getTime() - now.getTime()) / 1000)), max };
};

export const authRateLimit = (operation) => async (req, res, next) => {
  const config = getSecurityConfig();
  const max = operation === 'login' ? config.loginMax :
    ['verify', 'reset'].includes(operation) ? config.verifyMax :
    operation === 'register' ? 5 : config.sendMax;
  try {
    const checks = [[`${operation}:ip:${req.ip}`, max * 4]];
    const email = normalizeEmail(req.body?.email);
    if (validEmail(email)) checks.push([`${operation}:email:${email}`, max]);
    for (const [key, limit] of checks) {
      const result = await consumeRateLimit(key, limit, config.rateWindowSeconds);
      res.set('RateLimit-Limit', String(limit));
      res.set('RateLimit-Remaining', String(result.remaining));
      res.set('RateLimit-Reset', String(result.resetSeconds));
      if (!result.allowed) {
        res.set('Retry-After', String(result.resetSeconds));
        return res.status(429).json({ message: 'Too many authentication requests. Please try again later.' });
      }
    }
    return next();
  } catch {
    return res.status(503).json({ message: 'Authentication is temporarily unavailable. Please try again later.' });
  }
};
