import { BookingError } from '../config/bookingSecurity.js';
export const text = (value, label, max = 200, min = 1) => {
  // eslint-disable-next-line no-control-regex -- Deliberately reject nonprinting control characters.
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new BookingError(400, `Invalid ${label}.`);
  return value.trim();
};
export const pageQuery = (query) => {
  const parse = (value, fallback, max) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > max) throw new BookingError(400, 'Invalid pagination.');
    return Number(value);
  };
  const page = parse(query.page, 1, 100000), limit = parse(query.limit, 24, 100);
  return { page, limit, skip: (page - 1) * limit };
};
export const literalSearch = (value) => text(value, 'search', 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const profileFields = (body) => {
  const allowed = ['name', 'firstName', 'lastName', 'contactNumber'];
  if (!body || Array.isArray(body) || Object.keys(body).some((key) => !allowed.includes(key))) throw new BookingError(400, 'Only name and contact fields may be updated.');
  const result = {};
  for (const key of Object.keys(body)) result[key] = text(body[key], key, key === 'contactNumber' ? 32 : 100, key === 'name' ? 2 : 0);
  if (result.contactNumber && !/^[+0-9 ()-]{5,32}$/.test(result.contactNumber)) throw new BookingError(400, 'Invalid contact number.');
  if (!Object.keys(result).length) throw new BookingError(400, 'No profile changes supplied.');
  return result;
};
