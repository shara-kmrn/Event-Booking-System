import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import API from '../api/axios';
import { SESSION_CHANGED_EVENT, readToken, saveSession, clearSession, tokenExpiry, logoutSession } from '../api/authSession.js';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');

  const logout = useCallback(() => {
    logoutSession(setUser, setToken);
    setSessionError('');
  }, []);

  useEffect(() => {
    const onSessionChange = () => {
      setUser(null);
      setToken(null);
    };
    const onStorage = (event) => {
      if (event.key === 'token' || event.key === 'user') {
        // Reloading obtains a fresh, server-validated role/profile in this tab.
        window.location.reload();
      }
    };
    window.addEventListener(SESSION_CHANGED_EVENT, onSessionChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(SESSION_CHANGED_EVENT, onSessionChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const storedToken = readToken();
    const restore = async () => {
      if (!storedToken) {
        localStorage.removeItem('user');
        if (active) setLoading(false);
        return;
      }
      if (tokenExpiry(storedToken) <= Date.now()) {
        clearSession(storedToken);
        if (active) setLoading(false);
        return;
      }
      try {
        const { data } = await API.get('/auth/profile');
        if (active && readToken() === storedToken) {
          saveSession(data, storedToken);
          setUser(data);
          setToken(storedToken);
        }
      } catch (error) {
        if (active && readToken() === storedToken) {
          if (error.response?.status === 401) logout();
          else setSessionError('Unable to restore your session. Check your connection and reload to try again.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    restore();
    return () => { active = false; };
  }, [logout]);

  useEffect(() => {
    if (!token) return undefined;
    const remaining = tokenExpiry(token) - Date.now();
    const timer = setTimeout(() => clearSession(token), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [token]);

  const login = async (email, password) => {
    const { data } = await API.post('/auth/login', { email, password });
    if (data.token) {
      const { token: nextToken, ...profile } = data;
      saveSession(profile, nextToken);
      setToken(nextToken);
      setUser(profile);
      setSessionError('');
    }
    return data;
  };
  const updateProfile = async (fields) => {
    const { data } = await API.put('/auth/profile', fields);
    const currentToken = readToken();
    if (currentToken) { saveSession(data, currentToken); setUser(data); }
    return data;
  };
  const register = async (userData) => (await API.post('/auth/register', userData)).data;
  const verifyOtp = async (email, otp) => (await API.post('/auth/verify-otp', { email, otp })).data;
  const resendOtp = async (email) => (await API.post('/auth/resend-otp', { email })).data;
  const forgotPassword = async (email) => (await API.post('/auth/forgot-password', { email })).data;
  const resetPassword = async (email, otp, newPassword) =>
    (await API.post('/auth/reset-password', { email, otp, newPassword })).data;

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, verifyOtp,
      resendOtp, forgotPassword, resetPassword, updateProfile, logout }}>
      {!loading && sessionError ? (
        <div role="alert" className="p-6 text-center">
          <p>{sessionError}</p>
          <button type="button" onClick={() => window.location.reload()}>Retry</button>
          <button type="button" onClick={logout}>Sign out</button>
        </div>
      ) : !loading && children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
