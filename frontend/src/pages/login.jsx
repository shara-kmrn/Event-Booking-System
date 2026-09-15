import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import { KeyRound, CheckCircle2, XCircle, RefreshCw, ArrowRight, ShieldCheck, Mail, Lock } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // OTP Modal State for unverified users
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');

  const inputRefs = useRef([]);
  const { login, verifyOtp, resendOtp } = useAuth();
  const navigate = useNavigate();

  // Timer countdown for OTP resend button
  useEffect(() => {
    let timer;
    if (showOtpModal && resendTimer > 0) {
      timer = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [showOtpModal, resendTimer]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(email.trim(), password);
      if (user.role === 'organizer') {
        navigate('/organizer/dashboard');
      } else {
        navigate('/');
      }
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

  // OTP Input auto-advance & paste handler
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...otpDigits];
    newDigits[index] = value.slice(-1);
    setOtpDigits(newDigits);
    if (otpError) setOtpError('');

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pasteData)) {
      const digits = pasteData.split('');
      setOtpDigits(digits);
      inputRefs.current[5]?.focus();
    }
  };

  // Submit OTP Code
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const code = otpDigits.join('');
    if (code.length !== 6) {
      setOtpError('Please enter all 6 digits of the OTP code.');
      return;
    }

    setOtpLoading(true);
    setOtpError('');
    try {
      const user = await verifyOtp(unverifiedEmail, code);
      setOtpSuccess('Email successfully verified! Signing in...');
      setTimeout(() => {
        if (user.role === 'organizer') {
          navigate('/organizer/dashboard');
        } else {
          navigate('/');
        }
      }, 1200);
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Invalid or expired OTP code. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  // Resend OTP Code
  const handleResendOtpCode = async () => {
    if (resendTimer > 0 || resendLoading) return;
    setResendLoading(true);
    setOtpError('');
    try {
      const res = await resendOtp(unverifiedEmail);
      setOtpSuccess(res.message || 'Fresh OTP code sent to your email address.');
      setResendTimer(60);
      setOtpDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Failed to resend OTP code.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center bg-[#030712] px-4 relative overflow-hidden">
      {/* Background Decorative Glows */}
      <div className="gradient-glow top-1/3 left-1/4 w-[350px] h-[350px] bg-indigo-600/15 animate-pulse-slow" />
      <div className="gradient-glow bottom-1/3 right-1/4 w-[350px] h-[350px] bg-purple-600/15 animate-pulse-slow" style={{ animationDelay: '2s' }} />

      <div className="max-w-md w-full glass-panel border border-slate-800/90 rounded-2xl p-8 shadow-2xl shadow-black/80 relative z-10 backdrop-blur-xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 p-0.5 shadow-lg shadow-indigo-500/20 mb-3">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-indigo-400" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">Welcome Back</h2>
          <p className="text-xs text-slate-400 mt-1">Sign in to your <span className="text-indigo-400 font-semibold">Eventra</span> account</p>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3.5 rounded-xl mb-5 flex items-start gap-2 animate-in fade-in">
            <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Email Address</label>
            <div className="relative flex items-center">
              <Mail className="w-4 h-4 text-indigo-400 absolute left-3.5 pointer-events-none" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition shadow-inner placeholder-slate-600"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Password</label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-indigo-400 absolute left-3.5 pointer-events-none" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition shadow-inner placeholder-slate-600"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white shadow-xl shadow-indigo-600/25 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>

        <p className="text-xs text-slate-400 mt-6 text-center">
          Don't have an account?{' '}
          <Link to="/register" className="text-indigo-400 font-semibold hover:underline">
            Register here
          </Link>
        </p>
      </div>

      {/* OTP Verification Modal for Unverified User */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4 animate-in fade-in duration-200">
          <div className="max-w-md w-full glass-panel border border-indigo-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-indigo-950/80 relative">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 mb-3 shadow-inner">
                <KeyRound className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-extrabold text-white">Account Not Verified</h3>
              <p className="text-xs text-slate-400 mt-1.5">
                We sent a 6-digit OTP verification code to <br />
                <span className="text-indigo-400 font-semibold">{unverifiedEmail}</span>
              </p>
              <div className="mt-2 text-[11px] bg-slate-900/80 border border-slate-800 text-amber-300/90 py-1 px-3 rounded-full inline-flex items-center gap-1.5">
                💡 Dev Note: Check your server terminal output for the OTP code
              </div>
            </div>

            {otpError && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3 rounded-xl mb-4 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{otpError}</span>
              </div>
            )}

            {otpSuccess && !otpError && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs p-3 rounded-xl mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{otpSuccess}</span>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="flex justify-center gap-2 sm:gap-2.5" onPaste={handleOtpPaste}>
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (inputRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="w-10 h-12 sm:w-12 sm:h-14 bg-slate-950 border border-slate-800 text-center font-mono font-bold text-xl text-indigo-300 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition shadow-inner"
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={otpLoading || otpDigits.join('').length !== 6}
                className="w-full py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white shadow-lg shadow-indigo-600/30 transition hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {otpLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Verify & Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-400">Didn't receive code?</span>
              <button
                type="button"
                onClick={handleResendOtpCode}
                disabled={resendTimer > 0 || resendLoading}
                className="text-indigo-400 font-semibold hover:text-indigo-300 transition flex items-center gap-1.5 disabled:text-slate-600 disabled:pointer-events-none cursor-pointer"
              >
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

export default Login;