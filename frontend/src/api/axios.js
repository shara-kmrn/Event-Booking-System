import axios from 'axios';
import { readToken, clearSession } from './authSession.js';

const API = axios.create({
  baseURL: import.meta.env?.VITE_API_BASE_URL || 'http://localhost:5000/api',
});

API.interceptors.request.use((request) => {
  const token = readToken();
  if (token) request.headers.Authorization = `Bearer ${token}`;
  return request;
});

API.interceptors.response.use((response) => response, (error) => {
  const authorization = error.config?.headers?.Authorization;
  const publicAuth = /\/auth\/(login|register|verify-otp|resend-otp|forgot-password|reset-password)(?:\?|$)/.test(error.config?.url || '');
  if (error.response?.status === 401 && authorization?.startsWith('Bearer ') && !publicAuth) {
    // A late response from an old session must not log out a newer login.
    clearSession(authorization.slice(7));
  }
  return Promise.reject(error);
});

export default API;
