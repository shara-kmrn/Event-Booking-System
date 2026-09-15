import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import {
  User,
  Mail,
  Phone,
  Lock,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  XCircle,
  Check,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';

const Register = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    contactNumber: '',
    email: '',
    verificationMethod: 'email', // Defaulted to email OTP
    password: '',
    confirmPassword: '',
    role: 'customer',
    agreeToTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
    if (error) setError('');
  };

  // Phone number validation function (Enforces Sri Lanka 10 digits for 0-start & +94 + 9 digits)
  const isPhoneValid = (phone) => {
    if (!phone) return false;
    // Remove spaces, dashes, parentheses
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');

    // 1. Starts with 0 (Sri Lanka local): Must be EXACTLY 10 digits (e.g. 0771234567)
    if (/^0/.test(cleaned)) {
      return /^0\d{9}$/.test(cleaned);
    }

    // 2. Starts with +94 (Sri Lanka international with +): +94 followed by EXACTLY 9 digits (e.g. +94771234567)
    if (/^\+94/.test(cleaned)) {
      return /^\+94\d{9}$/.test(cleaned);
    }

    // 3. Starts with 94 (Sri Lanka international without +): 94 followed by EXACTLY 9 digits (e.g. 94771234567)
    if (/^94/.test(cleaned)) {
      return /^94\d{9}$/.test(cleaned);
    }

    // 4. Other International numbers starting with +: + followed by 8 to 14 digits
    if (/^\+/.test(cleaned)) {
      return /^\+[1-9]\d{7,14}$/.test(cleaned);
    }

    return false;
  };

  // Password criteria check
  const criteria = [
    { id: 'length', label: 'At least 8 characters', valid: formData.password.length >= 8 },
    { id: 'uppercase', label: 'At least 1 uppercase letter', valid: /[A-Z]/.test(formData.password) },
    { id: 'lowercase', label: 'At least 1 lowercase letter', valid: /[a-z]/.test(formData.password) },
    { id: 'number', label: 'At least 1 number', valid: /[0-9]/.test(formData.password) },
    { id: 'special', label: 'At least 1 special character (!@#$%^&*)', valid: /[^A-Za-z0-9]/.test(formData.password) },
  ];

  const validCount = criteria.filter((c) => c.valid).length;
  const isPasswordValid = validCount === criteria.length;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isPhoneValid(formData.contactNumber)) {
      setError('Please enter a valid phone number (07XXXXXXXX for 10 digits or +94 7X XXX XXXX for 9 digits after +94).');
      return;
    }

    if (!isPasswordValid) {
      setError('Please ensure your password meets all required security criteria.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match. Please verify your password.');
      return;
    }

    if (!formData.agreeToTerms) {
      setError('You must agree to the Terms of Service and Privacy Policy to register.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        name: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
        contactNumber: formData.contactNumber.trim(),
        email: formData.email.trim(),
        verificationMethod: 'email',
        password: formData.password,
        role: formData.role,
      };

      const user = await register(payload);
      if (user.role === 'organizer') {
        navigate('/organizer/dashboard');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Calculate strength percentage & label
  const strengthPercent = (validCount / criteria.length) * 100;
  let strengthLabel = 'Very Weak';
  let strengthColor = 'bg-rose-500';
  if (validCount >= 5) {
    strengthLabel = 'Strong';
    strengthColor = 'bg-emerald-500';
  } else if (validCount >= 3) {
    strengthLabel = 'Medium';
    strengthColor = 'bg-amber-500';
  } else if (validCount >= 1) {
    strengthLabel = 'Weak';
    strengthColor = 'bg-rose-500';
  }

  const phoneHasInput = formData.contactNumber.length > 0;
  const phoneIsValid = isPhoneValid(formData.contactNumber);

  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center bg-[#030712] px-4 py-12 relative overflow-hidden">
      {/* Background Decorative Glows */}
      <div className="gradient-glow top-1/4 left-10 w-[400px] h-[400px] bg-indigo-600/15 animate-pulse-slow" />
      <div className="gradient-glow bottom-10 right-10 w-[450px] h-[450px] bg-purple-600/15 animate-pulse-slow" style={{ animationDelay: '2s' }} />

      <div className="max-w-xl w-full glass-panel border border-slate-800/90 rounded-2xl p-6 sm:p-10 shadow-2xl shadow-black/80 relative z-10 backdrop-blur-xl">
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 p-0.5 shadow-lg shadow-indigo-500/20 mb-3">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-indigo-400" />
            </div>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center justify-center gap-2">
            Create Your Account
            <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Join <span className="text-indigo-400 font-semibold">Eventra</span> to book tickets or host live events
          </p>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm p-3.5 rounded-xl mb-6 flex items-start gap-2.5 animate-in fade-in">
            <XCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* First Name & Last Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                First Name <span className="text-rose-400">*</span>
              </label>
              <div className="relative flex items-center">
                <User className="w-4 h-4 text-indigo-400 absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  name="firstName"
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition shadow-inner placeholder-slate-600"
                  placeholder="Nimal"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Last Name <span className="text-rose-400">*</span>
              </label>
              <div className="relative flex items-center">
                <User className="w-4 h-4 text-indigo-400 absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  name="lastName"
                  required
                  value={formData.lastName}
                  onChange={handleChange}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition shadow-inner placeholder-slate-600"
                  placeholder="Perera"
                />
              </div>
            </div>
          </div>

          {/* Contact Number & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Contact Number <span className="text-rose-400">*</span>
              </label>
              <div className="relative flex items-center">
                <Phone className="w-4 h-4 text-indigo-400 absolute left-3.5 pointer-events-none" />
                <input
                  type="tel"
                  name="contactNumber"
                  required
                  value={formData.contactNumber}
                  onChange={handleChange}
                  className={`w-full bg-slate-950/80 border rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white focus:outline-none transition shadow-inner placeholder-slate-600 ${
                    phoneHasInput
                      ? phoneIsValid
                        ? 'border-emerald-500/80 focus:border-emerald-400'
                        : 'border-rose-500/80 focus:border-rose-400'
                      : 'border-slate-800 focus:border-indigo-500'
                  }`}
                  placeholder="0771234567 or +94771234567"
                />
              </div>
              {/* Phone format feedback */}
              {phoneHasInput && (
                <div className="mt-1 flex items-center gap-1 text-[11px] font-medium">
                  {phoneIsValid ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Valid phone number
                    </span>
                  ) : (
                    <span className="text-rose-400 flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" /> 10 digits starting with 0 OR +94 with 9 digits
                    </span>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Email Address <span className="text-rose-400">*</span>
              </label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-indigo-400 absolute left-3.5 pointer-events-none" />
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition shadow-inner placeholder-slate-600"
                  placeholder="nimal@example.com"
                />
              </div>
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Password <span className="text-rose-400">*</span>
            </label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-indigo-400 absolute left-3.5 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition shadow-inner placeholder-slate-600"
                placeholder="Password123!"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-slate-400 hover:text-slate-200 transition cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Real-time Password Strength Bar & Requirements Box */}
            {formData.password.length > 0 && (
              <div className="mt-3 p-3.5 rounded-xl bg-slate-950/90 border border-slate-800/80 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
                {/* Strength Meter Bar */}
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1">
                  <span>Password Strength:</span>
                  <span
                    className={`capitalize font-bold ${
                      validCount >= 5
                        ? 'text-emerald-400'
                        : validCount >= 3
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {strengthLabel}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${strengthColor}`}
                    style={{ width: `${strengthPercent}%` }}
                  />
                </div>

                {/* Criteria Checklist */}
                <div className="pt-1.5 space-y-1.5 text-xs">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                    Password must contain:
                  </div>
                  {criteria.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-2 transition duration-200 ${
                        item.valid ? 'text-emerald-400 font-medium' : 'text-slate-500'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0 transition ${
                          item.valid
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-slate-900 text-slate-600 border border-slate-800'
                        }`}
                      >
                        {item.valid ? <Check className="w-3 h-3 stroke-[3]" /> : <X className="w-3 h-3" />}
                      </div>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password Field */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Confirm Password <span className="text-rose-400">*</span>
            </label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-indigo-400 absolute left-3.5 pointer-events-none" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                className={`w-full bg-slate-950/80 border rounded-xl pl-10 pr-10 py-2.5 text-sm text-white focus:outline-none transition shadow-inner placeholder-slate-600 ${
                  formData.confirmPassword.length > 0
                    ? formData.password === formData.confirmPassword
                      ? 'border-emerald-500/80 focus:border-emerald-400'
                      : 'border-rose-500/80 focus:border-rose-400'
                    : 'border-slate-800 focus:border-indigo-500'
                }`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 text-slate-400 hover:text-slate-200 transition cursor-pointer"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Confirm Password Live Match Feedback */}
            {formData.confirmPassword.length > 0 && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium">
                {formData.password === formData.confirmPassword ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Passwords match
                  </span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> Passwords do not match
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Account Role Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Account Role <span className="text-rose-400">*</span>
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
            >
              <option value="customer">Customer (Book & Attend Events)</option>
              <option value="organizer">Event Organizer (Publish & Manage Events)</option>
            </select>
          </div>

          {/* Terms & Conditions Checkbox */}
          <div className="flex items-start gap-3 pt-1">
            <input
              type="checkbox"
              id="agreeToTerms"
              name="agreeToTerms"
              checked={formData.agreeToTerms}
              onChange={handleChange}
              className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-950 mt-0.5 cursor-pointer accent-indigo-600"
            />
            <label htmlFor="agreeToTerms" className="text-xs text-slate-400 leading-relaxed cursor-pointer select-none">
              I agree to the{' '}
              <a href="#terms" className="text-indigo-400 font-semibold hover:underline">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="#privacy" className="text-indigo-400 font-semibold hover:underline">
                Privacy Policy
              </a>
              . <span className="text-rose-400">*</span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={
              loading ||
              (phoneHasInput && !phoneIsValid) ||
              (formData.password.length > 0 && !isPasswordValid) ||
              !formData.agreeToTerms
            }
            className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white shadow-xl shadow-indigo-600/25 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-indigo-200" />
                <span>Complete Registration</span>
              </>
            )}
          </button>
        </form>

        <p className="text-xs text-slate-400 mt-6 text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-400 font-semibold hover:underline">
            Sign in here
          </Link>
        </p>

      </div>
    </div>
  );
};

export default Register;