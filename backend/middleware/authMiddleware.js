import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Login වී ඇති බව තහවුරු කිරීම (Protect Middleware)
export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Token එකෙන් user සොයා req.user ට assign කිරීම (password නැතුව)
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        return res.status(401).json({ message: 'User no longer exists' });
      }

      return next();
    } catch (error) {
      console.error('Auth verification error:', error.message);
      return res.status(401).json({ message: `Session expired or token invalid (${error.message}). Please log in again.` });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided. Please log in.' });
  }
};

// Role-based Access Control (RBAC)
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `User role '${req.user.role}' is not authorized to access this route` 
      });
    }
    next();
  };
};