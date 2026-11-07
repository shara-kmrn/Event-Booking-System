import User from '../models/User.js';
import { verifyToken } from '../utils/authTokens.js';
import { PUBLIC_USER_FIELDS } from '../utils/userResponse.js';

export const protect = async (req, res, next) => {
  const match = typeof req.headers.authorization === 'string' &&
    req.headers.authorization.match(/^Bearer ([^\s]+)$/i);
  if (!match) return res.status(401).json({ message: 'Please log in to continue.' });
  let decoded;
  try { decoded = verifyToken(match[1]); }
  catch { return res.status(401).json({ message: 'Session expired or invalid. Please log in again.' }); }
  try {
    const user = await User.findById(decoded.id).select(`${PUBLIC_USER_FIELDS} +sessionVersion`);
    if (!user || !user.isVerified || user.accountStatus === 'suspended' || decoded.sv !== (user.sessionVersion || 0)) {
      return res.status(401).json({ message: 'Session expired or invalid. Please log in again.' });
    }
    req.user = user;
    return next();
  } catch {
    return res.status(503).json({ message: 'Authentication is temporarily unavailable. Please try again later.' });
  }
};

export const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'You are not authorized to access this resource.' });
  }
  return next();
};
