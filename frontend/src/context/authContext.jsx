import { createContext, useContext, useState, useEffect } from 'react';
import API from '../api/axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  // App එක load වෙද්දී token එක තියෙනවා නම් user data restore කිරීම
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser && token) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        logout();
      }
    }
    setLoading(false);
  }, [token]);

  // Login handler
  const login = async (email, password) => {
    const { data } = await API.post('/auth/login', { email, password });
    if (data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data));
      setToken(data.token);
      setUser(data);
    }
    return data;
  };

  // Register handler
  const register = async (userData) => {
    const { data } = await API.post('/auth/register', userData);
    return data;
  };

  // Verify OTP handler
  const verifyOtp = async (email, otp) => {
    const { data } = await API.post('/auth/verify-otp', { email, otp });
    // Note: Do NOT auto-save token here if caller wants manual login
    return data;
  };

  // Resend OTP handler
  const resendOtp = async (email) => {
    const { data } = await API.post('/auth/resend-otp', { email });
    return data;
  };

  // Forgot Password handler
  const forgotPassword = async (email) => {
    const { data } = await API.post('/auth/forgot-password', { email });
    return data;
  };

  // Reset Password handler
  const resetPassword = async (email, otp, newPassword) => {
    const { data } = await API.post('/auth/reset-password', { email, otp, newPassword });
    return data;
  };

  // Logout handler
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        verifyOtp,
        resendOtp,
        forgotPassword,
        resetPassword,
        logout,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);