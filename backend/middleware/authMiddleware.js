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

      next();
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }
};

// Role-based Access Control (RBAC - Case Insensitive)
export const authorize = (...roles) => {
  return (req, res, next) => {
    const userRole = req.user?.role ? req.user.role.toLowerCase() : '';
    const allowed = roles.map((r) => r.toLowerCase());

    if (!allowed.includes(userRole)) {
      return res.status(403).json({ 
        message: `User role '${req.user?.role}' is not authorized to access this route` 
      });
    }
    next();
  };
};