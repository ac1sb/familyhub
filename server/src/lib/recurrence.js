import { addDays, startOfWeek, toISODate } from './week.js';

// Expand a single event row into concrete occurrences that fall within [rangeStart, rangeEnd).
// Non-recurring events just pass through if they fall in range.
// Recurring events repeat weekly on the weekdays listed in recurrence_days (0=Mon..6=Sun).
export function expandOccurrences(event, rangeStart, rangeEnd) {
  const occurrences = [];
  const originalStart = new Date(event.start_datetime);
  const originalEnd = event.end_datetime ? new Date(event.end_datetime) : null;
  const durationMs = originalEnd ? originalEnd - originalStart : 0;

  if (!event.recurring) {
    if (originalStart >= rangeStart && originalStart < rangeEnd) {
      occurrences.push({ ...event, occurrence_start: event.start_datetime, occurrence_end: event.end_datetime });
    }
    return occurrences;
  }

  let days = event.recurrence_days;
  if (typeof days === 'string') {
    try {
      days = JSON.parse(days || '[]');
    } catch {
      days = [];
    }
  }
  if (!Array.isArray(days) || days.length === 0) return occurrences;

  let cursor = startOfWeek(rangeStart);
  const originalStartDay = startOfWeek(originalStart);
  while (cursor < rangeEnd) {
    if (cursor >= originalStartDay || toISODate(cursor) === toISODate(originalStartDay)) {
      for (const weekday of days) {
        const occDate = addDays(cursor, weekday);
        const occStart = new Date(occDate);
        occStart.setHours(originalStart.getHours(), originalStart.getMinutes(), originalStart.getSeconds(), 0);
        if (occStart >= rangeStart && occStart < rangeEnd && occStart >= originalStart) {
          const occEnd = durationMs ? new Date(occStart.getTime() + durationMs) : null;
          occurrences.push({
            ...event,
            occurrence_start: occStart.toISOString(),
            occurrence_end: occEnd ? occEnd.toISOString() : null,
          });
        }
      }
    }
    cursor = addDays(cursor, 7);
  }

  return occurrences.sort((a, b) => new Date(a.occurrence_start) - new Date(b.occurrence_start));
}
