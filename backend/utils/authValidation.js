export const normalizeEmail = (value) => typeof value === 'string' ? value.trim().toLowerCase() : '';
export const validEmail = (value) => typeof value === 'string' && value.length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export const validPassword = (value) => typeof value === 'string' && value.length >= 8 &&
  Buffer.byteLength(value, 'utf8') <= 72 && /[A-Z]/.test(value) && /[a-z]/.test(value) &&
  /[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value);
export const passwordMessage = 'Password must contain at least 8 characters, uppercase and lowercase letters, a number and a special character, and be at most 72 UTF-8 bytes.';
export const validLoginPassword = (value) => typeof value === 'string' && value.length > 0 &&
  Buffer.byteLength(value, 'utf8') <= 72;
export const normalizeOtp = (value) => typeof value === 'string' ? value.trim() :
  Number.isInteger(value) ? String(value) : '';
export const validOtp = (value) => /^[0-9]{6}$/.test(normalizeOtp(value));
export const validName = (value) => typeof value === 'string' && value.trim().length >= 2 &&
  value.trim().length <= 100 && !/[\u0000-\u001f\u007f]/.test(value); // eslint-disable-line no-control-regex -- Name validation intentionally rejects controls.
export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
