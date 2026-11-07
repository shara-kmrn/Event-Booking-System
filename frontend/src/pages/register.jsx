import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import {
  User, Mail, Phone, Lock, ShieldCheck, CheckCircle2, XCircle,
  Check, X, Eye, EyeOff, KeyRound, RefreshCw, ArrowRight,
} from 'lucide-react';

const Register = () => {
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', contactNumber: '', email: '',
    verificationMethod: 'email', password: '', confirmPassword: '',
    role: 'customer', agreeToTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [, setAssignedRole] = useState('customer');

  const inputRefs = useRef([]);
  const { register, verifyOtp, resendOtp, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let timer;
    if (showOtpModal && resendTimer > 0) {
      timer = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [showOtpModal, resendTimer]);

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
    if (error) setError('');
  };

  const isPhoneValid = (phone) => {
    if (!phone) return false;
    const cleaned = phone.replace(/[\s\-()]/g, '');
    if (/^0/.test(cleaned)) return /^0\d{9}$/.test(cleaned);
    if (/^\+94/.test(cleaned)) return /^\+94\d{9}$/.test(cleaned);
    if (/^94/.test(cleaned)) return /^94\d{9}$/.test(cleaned);
    if (/^\+/.test(cleaned)) return /^\+[1-9]\d{7,14}$/.test(cleaned);
    return false;
  };

  const criteria = [
    { id: 'length', label: '8 or more characters (maximum 72 UTF-8 bytes)', valid: formData.password.length >= 8 && new TextEncoder().encode(formData.password).length <= 72 },
    { id: 'uppercase', label: 'At least 1 uppercase letter', valid: /[A-Z]/.test(formData.password) },
    { id: 'lowercase', label: 'At least 1 lowercase letter', valid: /[a-z]/.test(formData.password) },
    { id: 'number', label: 'At least 1 number', valid: /[0-9]/.test(formData.password) },
    { id: 'special', label: 'At least 1 special character (!@#$%^&*)', valid: /[^A-Za-z0-9]/.test(formData.password) },
  ];

  const validCount = criteria.filter((c) => c.valid).length;
  const isPasswordValid = validCount === criteria.length;
  const strengthPercent = (validCount / criteria.length) * 100;
  let strengthLabel = 'Very Weak';
  if (validCount >= 5) strengthLabel = 'Strong';
  else if (validCount >= 3) strengthLabel = 'Medium';
  else if (validCount >= 1) strengthLabel = 'Weak';

  const phoneHasInput = formData.contactNumber.length > 0;
  const phoneIsValid = isPhoneValid(formData.contactNumber);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isPhoneValid(formData.contactNumber)) { setError('Please enter a valid phone number.'); return; }
    if (!isPasswordValid) { setError('Please ensure your password meets all security criteria.'); return; }
    if (formData.password !== formData.confirmPassword) { setError('Passwords do not match.'); return; }
    if (!formData.agreeToTerms) { setError('You must agree to the Terms of Service.'); return; }

    setLoading(true);
    try {
      const payload = {
        firstName: formData.firstName.trim(), lastName: formData.lastName.trim(),
        name: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
        contactNumber: formData.contactNumber.trim(), email: formData.email.trim(),
        verificationMethod: 'email', password: formData.password, role: formData.role,
      };
      const res = await register(payload);
      setRegisteredEmail(formData.email.trim());
      setAssignedRole(formData.role);
      setShowOtpModal(true); setResendTimer(60); setOtpError('');
      setOtpSuccess(res.message || 'OTP verification code sent to your email.');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.');
    } finally { setLoading(false); }
  };

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...otpDigits];
    newDigits[index] = value.slice(-1);
    setOtpDigits(newDigits);
    if (otpError) setOtpError('');
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };
  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) inputRefs.current[index - 1]?.focus();
  };
  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pasteData)) { setOtpDigits(pasteData.split('')); inputRefs.current[5]?.focus(); }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const code = otpDigits.join('');
    if (code.length !== 6) { setOtpError('Please enter all 6 digits.'); return; }
    setOtpLoading(true); setOtpError('');
    try {
      await verifyOtp(registeredEmail, code);
      logout();
      setOtpSuccess('Email successfully verified! Redirecting to login...');
      setTimeout(() => {
        navigate('/login', { state: { verifiedMessage: 'Email verified! Please sign in.', email: registeredEmail } });
      }, 1200);
    } catch (err) { setOtpError(err.response?.data?.message || 'Invalid or expired OTP.'); }
    finally { setOtpLoading(false); }
  };

  const handleResendOtpCode = async () => {
    if (resendTimer > 0 || resendLoading) return;
    setResendLoading(true); setOtpError('');
    try {
      const res = await resendOtp(registeredEmail);
      setOtpSuccess(res.message || 'Fresh OTP sent.');
      setResendTimer(60); setOtpDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err) { setOtpError(err.response?.data?.message || 'Failed to resend OTP.'); }
    finally { setResendLoading(false); }
  };

  const inputStyle = {
    backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)',
    color: 'var(--text-heading)', borderRadius: '0.75rem',
  };
  const inputFocusProps = {
    onFocus: e => e.currentTarget.style.borderColor = 'var(--primary)',
    onBlur: e => e.currentTarget.style.borderColor = 'var(--border)',
  };

  return (
    <div className="min-h-[calc(100vh-70px)] flex items-center justify-center px-4 py-12 relative overflow-hidden" style={{ backgroundColor: 'var(--bg-main)' }}>

      {/* Registration Card */}
      <div className="max-w-xl w-full ev-card rounded-2xl p-6 sm:p-10 relative z-10" style={{ boxShadow: 'var(--shadow-modal)' }}>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3" style={{ backgroundColor: 'var(--primary)', color: 'var(--text-on-primary)' }}>
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: 'var(--text-heading)' }}>Create Your Account</h2>
          <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--text-subtle)' }}>
            Join <span className="font-semibold" style={{ color: 'var(--accent-text)' }}>Eventra</span> to book tickets or host live events
          </p>
        </div>

        {error && (
          <div className="ev-alert-error text-xs sm:text-sm p-3.5 rounded-xl mb-6 flex items-start gap-2.5 ev-animate-in">
            <XCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Names */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-body)' }}>First Name <span style={{ color: 'var(--error-text)' }}>*</span></label>
              <div className="relative flex items-center">
                <User className="w-4 h-4 absolute left-3.5 pointer-events-none" style={{ color: 'var(--accent-text)' }} />
                <input type="text" name="firstName" required value={formData.firstName} onChange={handleChange}
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm" style={inputStyle} placeholder="Nimal" {...inputFocusProps} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-body)' }}>Last Name <span style={{ color: 'var(--error-text)' }}>*</span></label>
              <div className="relative flex items-center">
                <User className="w-4 h-4 absolute left-3.5 pointer-events-none" style={{ color: 'var(--accent-text)' }} />
                <input type="text" name="lastName" required value={formData.lastName} onChange={handleChange}
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm" style={inputStyle} placeholder="Perera" {...inputFocusProps} />
              </div>
            </div>
          </div>

          {/* Phone & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-body)' }}>Contact Number <span style={{ color: 'var(--error-text)' }}>*</span></label>
              <div className="relative flex items-center">
                <Phone className="w-4 h-4 absolute left-3.5 pointer-events-none" style={{ color: 'var(--accent-text)' }} />
                <input type="tel" name="contactNumber" required value={formData.contactNumber} onChange={handleChange}
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm"
                  style={{ ...inputStyle, borderColor: phoneHasInput ? (phoneIsValid ? 'var(--success-border)' : 'var(--error-border)') : 'var(--border)' }}
                  placeholder="0771234567 or +94771234567"
                  onFocus={e => e.currentTarget.style.borderColor = phoneHasInput ? (phoneIsValid ? 'var(--success-border)' : 'var(--error-border)') : 'var(--primary)'}
                  onBlur={e => e.currentTarget.style.borderColor = phoneHasInput ? (phoneIsValid ? 'var(--success-border)' : 'var(--error-border)') : 'var(--border)'}
                />
              </div>
              {phoneHasInput && (
                <div className="mt-1 flex items-center gap-1 text-[11px] font-medium">
                  {phoneIsValid
                    ? <span style={{ color: 'var(--success-text)' }} className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Valid phone number</span>
                    : <span style={{ color: 'var(--error-text)' }} className="flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> 10 digits starting with 0 OR +94 with 9 digits</span>
                  }
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-body)' }}>Email Address <span style={{ color: 'var(--error-text)' }}>*</span></label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 absolute left-3.5 pointer-events-none" style={{ color: 'var(--accent-text)' }} />
                <input type="email" name="email" required value={formData.email} onChange={handleChange}
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm" style={inputStyle} placeholder="nimal@example.com" {...inputFocusProps} />
              </div>
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-body)' }}>Password <span style={{ color: 'var(--error-text)' }}>*</span></label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 absolute left-3.5 pointer-events-none" style={{ color: 'var(--accent-text)' }} />
              <input type={showPassword ? 'text' : 'password'} name="password" required value={formData.password} onChange={handleChange}
                className="w-full pl-10 pr-10 py-2.5 text-sm" style={inputStyle} placeholder="Password123!" {...inputFocusProps} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 cursor-pointer" style={{ color: 'var(--text-subtle)' }}>
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {formData.password.length > 0 && (
              <div className="mt-3 p-3.5 rounded-xl space-y-2.5 ev-animate-in" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between text-[11px] font-semibold mb-1" style={{ color: 'var(--text-subtle)' }}>
                  <span>Password Strength:</span>
                  <span className="capitalize font-bold" style={{ color: validCount >= 5 ? 'var(--success-text)' : validCount >= 3 ? 'var(--warning-text)' : 'var(--error-text)' }}>
                    {strengthLabel}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-main)' }}>
                  <div className="h-full transition-all duration-300" style={{
                    width: `${strengthPercent}%`,
                    backgroundColor: validCount >= 5 ? 'var(--primary)' : validCount >= 3 ? 'var(--warning-text)' : 'var(--error-text)'
                  }} />
                </div>
                <div className="pt-1.5 space-y-1.5 text-xs">
                  <div className="text-[10px] uppercase font-bold tracking-wider mb-1" style={{ color: 'var(--text-subtle)' }}>Password must contain:</div>
                  {criteria.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 transition duration-200" style={{ color: item.valid ? 'var(--success-text)' : 'var(--text-subtle)' }}>
                      <div className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0"
                        style={{
                          backgroundColor: item.valid ? 'var(--success-bg)' : 'var(--bg-main)',
                          color: item.valid ? 'var(--success-text)' : 'var(--text-subtle)',
                          border: item.valid ? '1px solid var(--success-border)' : '1px solid var(--border)',
                        }}>
                        {item.valid ? <Check className="w-3 h-3 stroke-[3]" /> : <X className="w-3 h-3" />}
                      </div>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-body)' }}>Confirm Password <span style={{ color: 'var(--error-text)' }}>*</span></label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 absolute left-3.5 pointer-events-none" style={{ color: 'var(--accent-text)' }} />
              <input type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword" required value={formData.confirmPassword} onChange={handleChange}
                className="w-full pl-10 pr-10 py-2.5 text-sm"
                style={{ ...inputStyle, borderColor: formData.confirmPassword.length > 0 ? (formData.password === formData.confirmPassword ? 'var(--success-border)' : 'var(--error-border)') : 'var(--border)' }}
                placeholder="••••••••"
                onFocus={e => e.currentTarget.style.borderColor = formData.confirmPassword.length > 0 ? (formData.password === formData.confirmPassword ? 'var(--success-border)' : 'var(--error-border)') : 'var(--primary)'}
                onBlur={e => e.currentTarget.style.borderColor = formData.confirmPassword.length > 0 ? (formData.password === formData.confirmPassword ? 'var(--success-border)' : 'var(--error-border)') : 'var(--border)'}
              />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 cursor-pointer" style={{ color: 'var(--text-subtle)' }}>
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {formData.confirmPassword.length > 0 && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium">
                {formData.password === formData.confirmPassword
                  ? <span style={{ color: 'var(--success-text)' }} className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Passwords match</span>
                  : <span style={{ color: 'var(--error-text)' }} className="flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Passwords do not match</span>
                }
              </div>
            )}
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-body)' }}>Account Role <span style={{ color: 'var(--error-text)' }}>*</span></label>
            <select name="role" value={formData.role} onChange={handleChange}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl" style={inputStyle}>
              <option value="customer">Customer (Book & Attend Events)</option>
              <option value="organizer">Event Organizer (Publish & Manage Events)</option>
            </select>
          </div>

          {/* Terms */}
          <div className="flex items-start gap-3 pt-1">
            <input type="checkbox" id="agreeToTerms" name="agreeToTerms" checked={formData.agreeToTerms} onChange={handleChange}
              className="w-4 h-4 rounded mt-0.5 cursor-pointer" style={{ accentColor: 'var(--primary)' }} />
            <label htmlFor="agreeToTerms" className="text-xs leading-relaxed cursor-pointer select-none" style={{ color: 'var(--text-subtle)' }}>
              I agree to the <a href="#terms" className="font-semibold hover:underline" style={{ color: 'var(--accent-text)' }}>Terms of Service</a> and{' '}
              <a href="#privacy" className="font-semibold hover:underline" style={{ color: 'var(--accent-text)' }}>Privacy Policy</a>.{' '}
              <span style={{ color: 'var(--error-text)' }}>*</span>
            </label>
          </div>

          {/* Submit */}
          <button type="submit"
            disabled={loading || (phoneHasInput && !phoneIsValid) || (formData.password.length > 0 && !isPasswordValid) || !formData.agreeToTerms}
            className="w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:pointer-events-none cursor-pointer ev-btn-primary">
            {loading
              ? <div className="w-5 h-5 border-2 border-border border-t-transparent rounded-full animate-spin" />
              : <><ShieldCheck className="w-4 h-4" /><span>Complete Registration</span></>
            }
          </button>
        </form>

        <p className="text-xs mt-6 text-center" style={{ color: 'var(--text-subtle)' }}>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold hover:underline" style={{ color: 'var(--accent-text)' }}>Sign in here</Link>
        </p>
      </div>

      {/* OTP Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center ev-modal-overlay px-4 ev-animate-in">
          <div className="max-w-md w-full ev-modal-panel rounded-2xl p-6 sm:p-8 relative">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3" style={{ backgroundColor: 'var(--primary-muted)', color: 'var(--accent-text)', border: '1px solid var(--primary-border)' }}>
                <KeyRound className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-extrabold" style={{ color: 'var(--text-heading)' }}>Email Verification Code</h3>
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-subtle)' }}>
                If eligible, a 6-digit code will be sent to <br /><span className="font-semibold" style={{ color: 'var(--accent-text)' }}>{registeredEmail}</span>
              </p>
              <div className="mt-2 text-[11px] py-1 px-3 rounded-full inline-flex items-center gap-1.5" style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning-text)', border: '1px solid var(--warning-border)' }}>
                Check your email inbox and spam folder for your verification code.
              </div>
            </div>

            {otpError && <div className="ev-alert-error text-xs p-3 rounded-xl mb-4 flex items-center gap-2"><XCircle className="w-4 h-4 shrink-0" /><span>{otpError}</span></div>}
            {otpSuccess && !otpError && <div className="ev-alert-success text-xs p-3 rounded-xl mb-4 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" /><span>{otpSuccess}</span></div>}

            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="flex justify-center gap-2 sm:gap-2.5" onPaste={handleOtpPaste}>
                {otpDigits.map((digit, idx) => (
                  <input key={idx} ref={el => (inputRefs.current[idx] = el)} type="text" inputMode="numeric" maxLength={1}
                    value={digit} onChange={e => handleOtpChange(idx, e.target.value)} onKeyDown={e => handleOtpKeyDown(idx, e)}
                    className="w-10 h-12 sm:w-12 sm:h-14 text-center font-mono font-bold text-xl rounded-xl"
                    style={{ ...inputStyle, color: 'var(--accent-text)' }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.outline = '2px solid var(--primary)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.outline = ''; }}
                  />
                ))}
              </div>
              <button type="submit" disabled={otpLoading || otpDigits.join('').length !== 6}
                className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer ev-btn-primary">
                {otpLoading ? <div className="w-5 h-5 border-2 border-border border-t-transparent rounded-full animate-spin" /> : <><span>Verify & Continue</span><ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>

            <div className="mt-6 pt-4 flex items-center justify-between text-xs" style={{ borderTop: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-subtle)' }}>Didn't receive code?</span>
              <button type="button" onClick={handleResendOtpCode} disabled={resendTimer > 0 || resendLoading}
                className="font-semibold flex items-center gap-1.5 disabled:pointer-events-none cursor-pointer transition"
                style={{ color: resendTimer > 0 ? 'var(--text-subtle)' : 'var(--accent-text)' }}>
                <RefreshCw className={`w-3.5 h-3.5 ${resendLoading ? 'animate-spin' : ''}`} />
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Code'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Register;
