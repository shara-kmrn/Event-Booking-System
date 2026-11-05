export const SESSION_CHANGED_EVENT = 'eventra:session-changed';

export const readToken = () => localStorage.getItem('token');
export const saveSession = (user, token) => {
  const { token: ignoredToken, ...profile } = user;
  void ignoredToken;
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(profile));
};
export const clearSession = (expectedToken) => {
  if (expectedToken && readToken() !== expectedToken) return false;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
  return true;
};
export const logoutSession = (setUser, setToken) => {
  clearSession();
  setUser(null);
  setToken(null);
};
export const tokenExpiry = (token) => {
  try {
    const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(encoded));
    return Number.isFinite(exp) ? exp * 1000 : 0;
  } catch { return 0; }
};
