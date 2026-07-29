// ============================================================
// Calendar utility functions
// Date iteration, weekday matching, formatting
// ============================================================

import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  isSameMonth,
  isToday as isTodayFn,
  parseISO,
  isWithinInterval,
  getDay,
} from 'date-fns';

/**
 * Get all days to display in a month calendar grid (including padding days)
 */
export function getCalendarDays(year: number, month: number): Date[] {
  const monthStart = startOfMonth(new Date(year, month));
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart); // Sunday
  const calendarEnd = endOfWeek(monthEnd); // Saturday

  return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
}

/**
 * Format a date for display
 */
export function formatDate(date: Date | string, fmt: string = 'yyyy-MM-dd'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, fmt);
}

/**
 * Check if a date is within a semester's range
 */
export function isInSemester(date: Date, startDate: string, endDate: string): boolean {
  return isWithinInterval(date, {
    start: parseISO(startDate),
    end: parseISO(endDate),
  });
}

/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
  return isTodayFn(date);
}

/**
 * Check if a date is the same month
 */
export function isSameMonthAs(date: Date, referenceDate: Date): boolean {
  return isSameMonth(date, referenceDate);
}

/**
 * Get a date string in yyyy-MM-dd format
 */
export function toDateString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Get weekday index (0=Sun, 6=Sat) from a date
 */
export function getWeekday(date: Date | string): number {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return getDay(d);
}

/**
 * Format time string (HH:MM:SS → h:mm a)
 */
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
}

/**
 * Check if a date is in the future (after today)
 */
export function isFutureDate(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d > today;
}

/**
 * Get human-readable weekday name
 */
export function getWeekdayName(weekday: number, short: boolean = false): string {
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const shortNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return short ? shortNames[weekday] : names[weekday];
}
