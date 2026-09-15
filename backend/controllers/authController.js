import User from '../models/User.js';
import jwt from 'jsonwebtoken';

// JWT Token Generator
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Register a new user (Customer or Organizer)
// @route   POST /api/auth/register
export const registerUser = async (req, res) => {
  try {
    const { firstName, lastName, name, contactNumber, email, verificationMethod, password, role } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Security check: Superadmin manually create විය යුතු අතර direct register වීමට ඉඩ නොදෙයි
    const assignedRole = role === 'organizer' ? 'organizer' : 'customer';
    const computedName = name || `${firstName || ''} ${lastName || ''}`.trim() || 'User';

    const user = await User.create({
      firstName,
      lastName,
      name: computedName,
      contactNumber,
      email,
      verificationMethod: verificationMethod || 'email',
      password,
      role: assignedRole,
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      subscriptionPlan: user.subscriptionPlan,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        subscriptionPlan: user.subscriptionPlan,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/profile
export const getUserProfile = async (req, res) => {
  res.json(req.user);
};