const KEY = 'familyhub.calendarWidgetDays.v1';

// Per-device, like every other dashboard display choice - how many days
// (starting today) the compact Calendar widget on the Home dashboard shows.
// The full Calendar page ignores this: it auto-grows to fill the available
// height instead (see CalendarAgenda.jsx's MIN_DAYS/MAX_DAYS).
export const MIN_DAYS = 2;
export const MAX_DAYS = 10;
const DEFAULT_DAYS = 4;

export function getCalendarWidgetDays() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? Number(raw) : NaN;
    if (!Number.isInteger(parsed)) return DEFAULT_DAYS;
    return Math.max(MIN_DAYS, Math.min(MAX_DAYS, parsed));
  } catch {
    return DEFAULT_DAYS;
  }
}

export function setCalendarWidgetDays(days) {
  try {
    const clamped = Math.max(MIN_DAYS, Math.min(MAX_DAYS, Math.round(days)));
    localStorage.setItem(KEY, String(clamped));
  } catch {
    // private browsing / storage blocked - choice just won't persist on this device
  }
}
