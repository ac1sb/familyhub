import { addDays, startOfWeek, toISODate } from './week.js';

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// Expand a single event row into concrete occurrences that fall within
// [rangeStart, rangeEnd). Non-recurring events just pass through if they
// fall in range. Recurring events repeat either:
//   - 'weekly': on the weekdays listed in recurrence_days (0=Mon..6=Sun),
//     every recurrence_interval weeks (2 = every other week, etc).
//   - 'monthly': on the same day-of-month as the original start_datetime,
//     every recurrence_interval months. A month that doesn't have that day
//     (e.g. the 31st in February) is skipped rather than rolling over into
//     the next month.
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

  function pushIfInRange(occStart) {
    if (occStart >= rangeStart && occStart < rangeEnd && occStart >= originalStart) {
      const occEnd = durationMs ? new Date(occStart.getTime() + durationMs) : null;
      occurrences.push({
        ...event,
        occurrence_start: occStart.toISOString(),
        occurrence_end: occEnd ? occEnd.toISOString() : null,
      });
    }
  }

  const interval = Math.max(1, Number(event.recurrence_interval) || 1);

  if (event.recurrence_type === 'monthly') {
    const dayOfMonth = originalStart.getDate();
    let cursor = new Date(originalStart.getFullYear(), originalStart.getMonth(), 1);
    let guard = 0;
    // Months are coarse (at most ~12/year), so even a many-year range is a
    // small number of iterations - no need to align a starting offset first.
    while (cursor < rangeEnd && guard < 1200) {
      const occ = new Date(
        cursor.getFullYear(),
        cursor.getMonth(),
        dayOfMonth,
        originalStart.getHours(),
        originalStart.getMinutes(),
        originalStart.getSeconds()
      );
      // If dayOfMonth doesn't exist in this month, JS Date rolls it into the
      // next month instead of erroring - detect that and skip rather than
      // silently showing the occurrence on the wrong date.
      if (occ.getMonth() === cursor.getMonth()) pushIfInRange(occ);
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + interval, 1);
      guard += 1;
    }
    return occurrences.sort((a, b) => new Date(a.occurrence_start) - new Date(b.occurrence_start));
  }

  // 'weekly' (default) - same day-of-week model as before, now stepping by
  // recurrence_interval weeks instead of always every single week.
  let days = event.recurrence_days;
  if (typeof days === 'string') {
    try {
      days = JSON.parse(days || '[]');
    } catch {
      days = [];
    }
  }
  if (!Array.isArray(days) || days.length === 0) return occurrences;

  const originalStartWeek = startOfWeek(originalStart);
  let cursor = startOfWeek(rangeStart);
  // Align cursor to the same interval-week cadence as the original event's
  // own week - otherwise a range starting mid-cycle could land on a week
  // this series doesn't actually occur on.
  const weeksSinceStart = Math.round((cursor - originalStartWeek) / MS_PER_WEEK);
  const offset = ((weeksSinceStart % interval) + interval) % interval;
  cursor = addDays(cursor, -7 * offset);

  while (cursor < rangeEnd) {
    if (cursor >= originalStartWeek || toISODate(cursor) === toISODate(originalStartWeek)) {
      for (const weekday of days) {
        const occDate = addDays(cursor, weekday);
        const occStart = new Date(occDate);
        occStart.setHours(originalStart.getHours(), originalStart.getMinutes(), originalStart.getSeconds(), 0);
        pushIfInRange(occStart);
      }
    }
    cursor = addDays(cursor, 7 * interval);
  }

  return occurrences.sort((a, b) => new Date(a.occurrence_start) - new Date(b.occurrence_start));
}
