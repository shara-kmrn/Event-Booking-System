/**
 * Parse date string or Date object combined with time string (e.g., "07:00 PM" or "19:00") into a JavaScript Date object.
 * @param {Date|String} dateInput 
 * @param {String} timeStr 
 * @returns {Date}
 */
export const parseDateTime = (dateInput, timeStr = '07:00 PM') => {
  if (!dateInput) return new Date();

  let baseDate = new Date(dateInput);
  if (isNaN(baseDate.getTime())) {
    baseDate = new Date();
  }

  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const day = baseDate.getDate();

  let hours = 19;
  let minutes = 0;

  if (typeof timeStr === 'string' && timeStr.trim()) {
    const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (match) {
      hours = parseInt(match[1], 10);
      minutes = parseInt(match[2], 10);
      const ampm = match[3] ? match[3].toUpperCase() : null;

      if (ampm === 'PM' && hours < 12) {
        hours += 12;
      } else if (ampm === 'AM' && hours === 12) {
        hours = 0;
      }
    }
  }

  return new Date(year, month, day, hours, minutes, 0, 0);
};

/**
 * Calculates dynamic event lifecycle status given start and end date-times.
 * @param {Date} startDateTime 
 * @param {Date} endDateTime 
 * @param {Date} [currentTime] 
 * @returns {'UPCOMING' | 'ONGOING' | 'COMPLETED'}
 */
export const calculateLifecycleStatus = (startDateTime, endDateTime, currentTime = new Date()) => {
  const now = new Date(currentTime);
  const start = new Date(startDateTime);
  const end = new Date(endDateTime);

  if (now < start) {
    return 'UPCOMING';
  } else if (now >= start && now < end) {
    return 'ONGOING';
  } else {
    return 'COMPLETED';
  }
};
