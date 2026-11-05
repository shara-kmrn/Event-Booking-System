const dateError = () => {
  const error = new Error('Invalid event date/time. Use a valid date, time and explicit UTC offset.');
  error.status = 400;
  return error;
};
export const parseInstant = (value) => {
  if (typeof value !== 'string' || !/(Z|[+-][0-9]{2}:[0-9]{2})$/i.test(value)) throw dateError();
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw dateError();
  return date;
};
// Legacy date + clock forms use an explicit offset, never the server machine's timezone.
// Existing UTC Date fields are not rewritten. Sri Lanka's offset is the development default.
export const parseDateTime = (dateInput, timeStr = '07:00 PM') => {
  const offset = Number(process.env.EVENT_TIMEZONE_OFFSET_MINUTES ?? 330);
  if (!Number.isInteger(offset) || offset < -840 || offset > 840) throw dateError();
  const date = typeof dateInput === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(dateInput) ?
    dateInput : dateInput instanceof Date && Number.isFinite(dateInput.getTime()) ? dateInput.toISOString().slice(0, 10) : '';
  const match = typeof timeStr === 'string' && timeStr.trim().match(/^([0-9]{1,2}):([0-9]{2})\s*(AM|PM)?$/i);
  if (!date || !match) throw dateError();
  const [year, month, day] = date.split('-').map(Number);
  if (new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) !== date) throw dateError();
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59 || (match[3] ? hour < 1 || hour > 12 : hour > 23)) throw dateError();
  if (match[3]) hour = hour % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - offset * 60000);
};
export const calculateLifecycleStatus = (startDateTime, endDateTime, currentTime = new Date()) => {
  const now = new Date(currentTime);
  return now < new Date(startDateTime) ? 'UPCOMING' : now < new Date(endDateTime) ? 'ONGOING' : 'COMPLETED';
};
