import User from '../models/User.js';
import Event from '../models/event.js';
import Booking from '../models/booking.js';
import Category from '../models/category.js';
import Venue from '../models/venue.js';
import Complaint from '../models/complaints.js';

// @desc    Get all users in the system
// @route   GET /api/admin/users
// @access  Private (Superadmin only)
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user role
// @route   PUT /api/admin/users/:id/role
// @access  Private (Superadmin only)
export const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!['superadmin', 'organizer', 'customer'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role specified.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    user.role = role;
    await user.save();

    res.status(200).json({ message: `User role updated to ${role}`, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update organizer subscription plan
// @route   PUT /api/admin/organizers/:id/plan
// @access  Private (Superadmin only)
export const updateOrganizerPlan = async (req, res) => {
  try {
    const { subscriptionPlan } = req.body;
    if (!['free', 'pro'].includes(subscriptionPlan)) {
      return res.status(400).json({ message: 'Invalid subscription plan.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    user.subscriptionPlan = subscriptionPlan;
    await user.save();

    res.status(200).json({ message: `Subscription plan updated to ${subscriptionPlan}`, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a user
// @route   DELETE /api/admin/users/:id
// @access  Private (Superadmin only)
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'User deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all events for admin moderation
// @route   GET /api/admin/events
// @access  Private (Superadmin only)
export const getAllEventsAdmin = async (req, res) => {
  try {
    const events = await Event.find({})
      .populate('tenantId', 'name email')
      .sort({ createdAt: -1 });
    res.status(200).json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Approve event
// @route   PUT /api/admin/events/:id/approve
// @access  Private (Superadmin only)
export const approveEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    event.approvalStatus = 'approved';
    await event.save();

    res.status(200).json({ message: 'Event approved successfully.', event });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reject event
// @route   PUT /api/admin/events/:id/reject
// @access  Private (Superadmin only)
export const rejectEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    event.approvalStatus = 'rejected';
    await event.save();

    res.status(200).json({ message: 'Event rejected.', event });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get categories
// @route   GET /api/admin/categories
// @access  Public / Admin
export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ name: 1 });
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create category
// @route   POST /api/admin/categories
// @access  Private (Superadmin only)
export const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Category name is required.' });
    }

    const category = await Category.create({ name, description });
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete category
// @route   DELETE /api/admin/categories/:id
// @access  Private (Superadmin only)
export const deleteCategory = async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Category deleted.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get venues
// @route   GET /api/admin/venues
// @access  Public / Admin
export const getVenues = async (req, res) => {
  try {
    const venues = await Venue.find({}).sort({ name: 1 });
    res.status(200).json(venues);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create venue
// @route   POST /api/admin/venues
// @access  Private (Superadmin only)
export const createVenue = async (req, res) => {
  try {
    const { name, address, capacity } = req.body;
    if (!name || !address) {
      return res.status(400).json({ message: 'Name and address are required.' });
    }

    const venue = await Venue.create({ name, address, capacity });
    res.status(201).json(venue);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete venue
// @route   DELETE /api/admin/venues/:id
// @access  Private (Superadmin only)
export const deleteVenue = async (req, res) => {
  try {
    await Venue.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Venue deleted.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get system transactions
// @route   GET /api/admin/transactions
// @access  Private (Superadmin only)
export const getAllTransactions = async (req, res) => {
  try {
    const transactions = await Booking.find({})
      .populate('userId', 'name email')
      .populate('eventId', 'title')
      .sort({ createdAt: -1 });
    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Process refund
// @route   PUT /api/admin/transactions/:id/refund
// @access  Private (Superadmin only)
export const processRefund = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking transaction not found.' });
    }

    booking.paymentStatus = 'refunded';
    await booking.save();

    res.status(200).json({ message: 'Refund marked as processed successfully.', booking });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all complaints
// @route   GET /api/admin/complaints
// @access  Private (Superadmin only)
export const getComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({})
      .populate('user', 'name email')
      .sort({ createdAt: -1 });
    res.status(200).json(complaints);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Resolve complaint
// @route   PUT /api/admin/complaints/:id/resolve
// @access  Private (Superadmin only)
export const resolveComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found.' });
    }

    complaint.status = 'resolved';
    await complaint.save();

    res.status(200).json({ message: 'Complaint resolved.', complaint });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
