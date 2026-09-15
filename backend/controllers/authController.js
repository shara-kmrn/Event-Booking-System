import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import sendEmail from '../utils/sendEmail.js';

// JWT Token Generator
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// Generate 6-digit numeric OTP code
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Create branded HTML template for email
const getOTPEmailHTML = (name, otp) => {
  return `
    <div style="font-family: Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 30px; border-radius: 12px; max-width: 500px; margin: 0 auto;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #6366f1; margin: 0; font-size: 28px;">Eventra</h1>
        <p style="color: #94a3b8; font-size: 14px; margin-top: 4px;">Live Event Booking & Management Platform</p>
      </div>
      <div style="background-color: #1e293b; padding: 24px; border-radius: 8px; border: 1px solid #334155;">
        <h2 style="color: #ffffff; font-size: 20px; margin-top: 0;">Verify Your Email Address</h2>
        <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5;">Hello <strong>${name}</strong>,</p>
        <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5;">Thank you for registering with Eventra! Please use the following 6-digit Verification Code to complete your account setup:</p>
        <div style="text-align: center; margin: 25px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #818cf8; background-color: #0f172a; padding: 12px 24px; border-radius: 8px; border: 1px solid #4f46e5; display: inline-block;">${otp}</span>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-bottom: 0;">This code is valid for <strong>10 minutes</strong>. If you did not request this, please ignore this email.</p>
      </div>
      <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #64748b;">
        &copy; ${new Date().getFullYear()} Eventra Inc. All rights reserved.
      </div>
    </div>
  `;
};

// @desc    Register a new user & send OTP for email verification
// @route   POST /api/auth/register
export const registerUser = async (req, res) => {
  try {
    const { firstName, lastName, name, contactNumber, email, verificationMethod, password, role } = req.body;

    const userExists = await User.findOne({ email });

    // Generate fresh OTP code & expiry (10 mins)
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    if (userExists) {
      if (!userExists.isVerified) {
        // Update OTP for unverified user and send new mail
        userExists.otp = otp;
        userExists.otpExpires = otpExpires;
        await userExists.save();

        await sendEmail({
          to: userExists.email,
          subject: 'Eventra - Email Verification OTP',
          html: getOTPEmailHTML(userExists.name, otp),
          otp,
        });

        return res.status(200).json({
          message: 'An unverified account exists. A fresh OTP code has been sent to your email.',
          email: userExists.email,
          requiresVerification: true,
        });
      }

      return res.status(400).json({ message: 'User already exists with this email address.' });
    }

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
      isVerified: false,
      otp,
      otpExpires,
    });

    // Send verification email
    await sendEmail({
      to: user.email,
      subject: 'Eventra - Verify your Email Address',
      html: getOTPEmailHTML(user.name, otp),
      otp,
    });

    res.status(201).json({
      message: 'Registration successful! Verification code sent to your email.',
      email: user.email,
      requiresVerification: true,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify OTP code and complete user registration
// @route   POST /api/auth/verify-otp
export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP code are required.' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User account not found.' });
    }

    if (user.isVerified) {
      return res.status(200).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        subscriptionPlan: user.subscriptionPlan,
        isVerified: true,
        token: generateToken(user._id),
      });
    }

    if (user.otp !== otp.toString().trim()) {
      return res.status(400).json({ message: 'Invalid OTP verification code. Please check and try again.' });
    }

    if (user.otpExpires < new Date()) {
      return res.status(400).json({ message: 'OTP code has expired. Please request a new code.' });
    }

    // Mark user as verified & clear OTP fields
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.status(200).json({
      message: 'Email successfully verified!',
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      subscriptionPlan: user.subscriptionPlan,
      isVerified: true,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Resend OTP verification code
// @route   POST /api/auth/resend-otp
export const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email address is required.' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'User account is already verified.' });
    }

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendEmail({
      to: user.email,
      subject: 'Eventra - Fresh Email Verification OTP',
      html: getOTPEmailHTML(user.name, otp),
      otp,
    });

    res.status(200).json({ message: 'A fresh OTP code has been sent to your email.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Authenticate user & get token (Check verification status)
// @route   POST /api/auth/login
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      // Check if user email is verified
      if (!user.isVerified) {
        // Send fresh OTP automatically
        const otp = generateOTP();
        user.otp = otp;
        user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();

        await sendEmail({
          to: user.email,
          subject: 'Eventra - Email Verification OTP',
          html: getOTPEmailHTML(user.name, otp),
          otp,
        });

        return res.status(403).json({
          message: 'Your email address is not verified yet. An OTP has been sent to your email.',
          requiresVerification: true,
          email: user.email,
        });
      }

      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        subscriptionPlan: user.subscriptionPlan,
        isVerified: user.isVerified,
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

// @desc    Send password reset OTP
// @route   POST /api/auth/forgot-password
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email address is required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'No account found with this email address.' });
    }

    const otp = generateOTP();
    user.resetPasswordOtp = otp;
    user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendEmail({
      to: user.email,
      subject: 'Eventra - Password Reset OTP Code',
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 30px; border-radius: 12px; max-width: 500px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #6366f1; margin: 0; font-size: 28px;">Eventra</h1>
            <p style="color: #94a3b8; font-size: 14px; margin-top: 4px;">Password Reset Request</p>
          </div>
          <div style="background-color: #1e293b; padding: 24px; border-radius: 8px; border: 1px solid #334155;">
            <p style="color: #cbd5e1; font-size: 14px;">Hello <strong>${user.name}</strong>,</p>
            <p style="color: #cbd5e1; font-size: 14px;">You requested to reset your password. Use the following 6-digit code to reset your password:</p>
            <div style="text-align: center; margin: 25px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #f43f5e; background-color: #0f172a; padding: 12px 24px; border-radius: 8px; border: 1px solid #e11d48; display: inline-block;">${otp}</span>
            </div>
            <p style="color: #94a3b8; font-size: 12px; text-align: center;">Code is valid for 10 minutes.</p>
          </div>
        </div>
      `,
      otp,
    });

    res.status(200).json({ message: 'Password reset OTP code sent to your email.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reset password using OTP code
// @route   POST /api/auth/reset-password
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, OTP code, and new password are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user.resetPasswordOtp !== otp.toString().trim()) {
      return res.status(400).json({ message: 'Invalid password reset code.' });
    }

    if (user.resetPasswordExpires < new Date()) {
      return res.status(400).json({ message: 'Password reset code has expired. Please request a new one.' });
    }

    user.password = newPassword;
    user.resetPasswordOtp = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ message: 'Password reset successfully! You can now log in with your new password.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};