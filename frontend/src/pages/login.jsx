import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import {
  KeyRound, CheckCircle2, XCircle, RefreshCw, ArrowRight,
  ShieldCheck, Mail, Lock, HelpCircle, Eye, EyeOff,
} from 'lucide-react';

const Login = () => {
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState(location.state?.verifiedMessage || '');
  const [loading, setLoading] = useState(false);

  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');

  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const inputRefs = useRef([]);
  const { login, verifyOtp, resendOtp, forgotPassword, resetPassword } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let timer;
    if (showOtpModal && resendTimer > 0) {
      timer = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [showOtpModal, resendTimer]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      if (user.role === 'organizer') navigate('/organizer/dashboard');
      else if (user.role === 'superadmin') navigate('/admin/dashboard');
      else navigate('/');
    } catch (err) {
      if (err.response?.status === 403 && err.response?.data?.requiresVerification) {
        setUnverifiedEmail(err.response.data.email || email.trim());
        setShowOtpModal(true);
        setResendTimer(60);
        setOtpError('');
        setOtpSuccess(err.response.data.message || 'Please enter the verification code sent to your email.');
      } else {
        setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
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
    if (code.length !== 6) { setOtpError('Please enter all 6 digits of the OTP code.'); return; }
    setOtpLoading(true); setOtpError('');
    try {
      await verifyOtp(unverifiedEmail, code);
      setOtpSuccess('Email successfully verified! Please log in now.');
      setShowOtpModal(false);
      setSuccessMsg('Email verified successfully! Please enter your email and password to log in.');
      setEmail(unverifiedEmail);
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Invalid or expired OTP code.');
    } finally { setOtpLoading(false); }
  };

  const handleResendOtpCode = async () => {
    if (resendTimer > 0 || resendLoading) return;
    setResendLoading(true); setOtpError('');
    try {
      const res = await resendOtp(unverifiedEmail);
      setOtpSuccess(res.message || 'Fresh OTP code sent.');
      setResendTimer(60);
      setOtpDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err) { setOtpError(err.response?.data?.message || 'Failed to resend OTP.'); }
    finally { setResendLoading(false); }
  };

  const handleRequestResetOtp = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) { setForgotError('Please enter your email address.'); return; }
    setForgotLoading(true); setForgotError('');
    try {
      const res = await forgotPassword(forgotEmail.trim());
      setForgotSuccess(res.message || 'Reset code sent.');
      setForgotStep(2);
    } catch (err) { setForgotError(err.response?.data?.message || 'Failed to send reset code.'); }
    finally { setForgotLoading(false); }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!forgotOtp.trim() || forgotOtp.trim().length !== 6) { setForgotError('Please enter the 6-digit reset code.'); return; }
    if (!newPassword || newPassword.length < 8 || new TextEncoder().encode(newPassword).length > 72 ||
        !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      setForgotError('Use at least 8 characters with uppercase, lowercase, a number and a special character (maximum 72 UTF-8 bytes).'); return;
    }
    if (newPassword !== confirmNewPassword) { setForgotError('Passwords do not match.'); return; }
    setForgotLoading(true); setForgotError('');
    try {
      const res = await resetPassword(forgotEmail.trim(), forgotOtp.trim(), newPassword);
      setShowForgotModal(false);
      setSuccessMsg(res.message || 'Password reset successfully!');
      setEmail(forgotEmail.trim()); setPassword('');
      setForgotStep(1); setForgotEmail(''); setForgotOtp(''); setNewPassword(''); setConfirmNewPassword('');
    } catch (err) { setForgotError(err.response?.data?.message || 'Password reset failed.'); }
    finally { setForgotLoading(false); }
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
    <div className="min-h-[calc(100vh-70px)] flex items-center justify-center px-4 relative overflow-hidden" style={{ backgroundColor: 'var(--bg-main)' }}>

      <div className="max-w-md w-full rounded-2xl p-8 relative z-10 ev-card" style={{ boxShadow: 'var(--shadow-modal)' }}>
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3" style={{ backgroundColor: 'var(--primary)', color: 'var(--text-on-primary)' }}>
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-heading)' }}>Welcome Back</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>
            Sign in to your <span className="font-semibold" style={{ color: 'var(--accent-text)' }}>Eventra</span> account
          </p>
        </div>

        {successMsg && (
          <div className="ev-alert-success text-xs p-3.5 rounded-xl mb-5 flex items-start gap-2.5 ev-animate-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}
        {error && (
          <div className="ev-alert-error text-xs p-3.5 rounded-xl mb-5 flex items-start gap-2 ev-animate-in">
            <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-body)' }}>Email Address</label>
            <div className="relative flex items-center">
              <Mail className="w-4 h-4 absolute left-3.5 pointer-events-none" style={{ color: 'var(--accent-text)' }} />
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 text-sm" style={inputStyle} placeholder="you@example.com" {...inputFocusProps} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-body)' }}>Password</label>
              <button type="button" onClick={() => { setShowForgotModal(true); setForgotEmail(email); setForgotError(''); setForgotSuccess(''); }}
                className="text-xs font-semibold hover:underline cursor-pointer" style={{ color: 'var(--accent-text)' }}>
                Forgot password?
              </button>
            </div>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 absolute left-3.5 pointer-events-none" style={{ color: 'var(--accent-text)' }} />
              <input type={showPassword ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 text-sm" style={inputStyle} placeholder="••••••••" {...inputFocusProps} />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 transition cursor-pointer" style={{ color: 'var(--text-subtle)' }}>
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3 px-4 rounded-xl font-bold text-sm transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 mt-2 disabled:opacity-50 ev-btn-primary">
            {loading ? <div className="w-5 h-5 border-2 border-border border-t-transparent rounded-full animate-spin" /> : <span>Sign In</span>}
          </button>
        </form>

        <p className="text-xs mt-6 text-center" style={{ color: 'var(--text-subtle)' }}>
          Don't have an account?{' '}
          <Link to="/register" className="font-semibold hover:underline" style={{ color: 'var(--accent-text)' }}>Register here</Link>
        </p>
      </div>

      {/* OTP Verification Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center ev-modal-overlay px-4 ev-animate-in">
          <div className="max-w-md w-full ev-modal-panel rounded-2xl p-6 sm:p-8 relative">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3" style={{ backgroundColor: 'var(--primary-muted)', color: 'var(--accent-text)', border: '1px solid var(--primary-border)' }}>
                <KeyRound className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-extrabold" style={{ color: 'var(--text-heading)' }}>Account Not Verified</h3>
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-subtle)' }}>
                Use the latest 6-digit verification code for <br />
                <span className="font-semibold" style={{ color: 'var(--accent-text)' }}>{unverifiedEmail}</span>
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
                    style={{ ...inputStyle, color: 'var(--accent-text)' }} {...inputFocusProps} />
                ))}
              </div>
              <button type="submit" disabled={otpLoading || otpDigits.join('').length !== 6}
                className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer ev-btn-primary">
                {otpLoading ? <div className="w-5 h-5 border-2 border-border border-t-transparent rounded-full animate-spin" /> : <><span>Verify & Continue to Login</span><ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>

            <div className="mt-6 pt-4 flex items-center justify-between text-xs" style={{ borderTop: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-subtle)' }}>Didn't receive code?</span>
              <button type="button" onClick={handleResendOtpCode} disabled={resendTimer > 0 || resendLoading}
                className="font-semibold flex items-center gap-1.5 disabled:pointer-events-none cursor-pointer transition"
                style={{ color: resendTimer > 0 ? 'var(--text-subtle)' : 'var(--primary)' }}>
                <RefreshCw className={`w-3.5 h-3.5 ${resendLoading ? 'animate-spin' : ''}`} />
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Code'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center ev-modal-overlay px-4 ev-animate-in">
          <div className="max-w-md w-full ev-modal-panel rounded-2xl p-6 sm:p-8 relative">
            <button type="button" onClick={() => setShowForgotModal(false)} className="absolute top-4 right-4 transition cursor-pointer text-lg" style={{ color: 'var(--text-subtle)' }}>✕</button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3" style={{ backgroundColor: 'var(--primary-muted)', color: 'var(--accent-text)', border: '1px solid var(--primary-border)' }}>
                <HelpCircle className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-extrabold" style={{ color: 'var(--text-heading)' }}>Reset Password</h3>
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-subtle)' }}>
                {forgotStep === 1 ? 'Enter your email to receive a 6-digit password reset code.' : `Enter the code sent to ${forgotEmail} and your new password.`}
              </p>
              <div className="mt-2 text-[11px] py-1 px-3 rounded-full inline-flex items-center gap-1.5" style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning-text)', border: '1px solid var(--warning-border)' }}>
                Check your email inbox and spam folder for your reset code.
              </div>
            </div>

            {forgotError && <div className="ev-alert-error text-xs p-3 rounded-xl mb-4 flex items-center gap-2"><XCircle className="w-4 h-4 shrink-0" /><span>{forgotError}</span></div>}
            {forgotSuccess && !forgotError && <div className="ev-alert-success text-xs p-3 rounded-xl mb-4 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" /><span>{forgotSuccess}</span></div>}

            {forgotStep === 1 ? (
              <form onSubmit={handleRequestResetOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase mb-1.5" style={{ color: 'var(--text-body)' }}>Email Address</label>
                  <div className="relative flex items-center">
                    <Mail className="w-4 h-4 absolute left-3.5 pointer-events-none" style={{ color: 'var(--accent-text)' }} />
                    <input type="email" required value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm" style={inputStyle} placeholder="nimal@example.com" {...inputFocusProps} />
                  </div>
                </div>
                <button type="submit" disabled={forgotLoading}
                  className="w-full py-3.5 rounded-xl font-bold text-sm cursor-pointer flex items-center justify-center gap-2 ev-btn-primary">
                  {forgotLoading ? <div className="w-5 h-5 border-2 border-border border-t-transparent rounded-full animate-spin" /> : <span>Send Reset Code</span>}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase mb-1.5" style={{ color: 'var(--text-body)' }}>6-Digit Reset Code</label>
                  <input type="text" required maxLength={6} value={forgotOtp} onChange={e => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3.5 py-2.5 text-center font-mono text-lg font-bold tracking-widest" style={{ ...inputStyle, color: 'var(--accent-text)' }} placeholder="123456" {...inputFocusProps} />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase mb-1.5" style={{ color: 'var(--text-body)' }}>New Password</label>
                  <div className="relative flex items-center">
                    <Lock className="w-4 h-4 absolute left-3.5 pointer-events-none" style={{ color: 'var(--accent-text)' }} />
                    <input type={showNewPassword ? 'text' : 'password'} required value={newPassword} onChange={e => setNewPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 text-sm" style={inputStyle} placeholder="NewPassword123!" {...inputFocusProps} />
                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 cursor-pointer" style={{ color: 'var(--text-subtle)' }}>
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase mb-1.5" style={{ color: 'var(--text-body)' }}>Confirm New Password</label>
                  <div className="relative flex items-center">
                    <Lock className="w-4 h-4 absolute left-3.5 pointer-events-none" style={{ color: 'var(--accent-text)' }} />
                    <input type={showNewPassword ? 'text' : 'password'} required value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm" style={inputStyle} placeholder="••••••••" {...inputFocusProps} />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setForgotStep(1)} className="w-1/3 py-3 rounded-xl font-bold text-xs cursor-pointer ev-btn-secondary">Back</button>
                  <button type="submit" disabled={forgotLoading}
                    className="w-2/3 py-3 rounded-xl font-bold text-xs cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 ev-btn-primary">
                    {forgotLoading ? <div className="w-4 h-4 border-2 border-border border-t-transparent rounded-full animate-spin" /> : <span>Reset Password</span>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;