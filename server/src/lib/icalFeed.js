import ical from 'node-ical';

// Pulls events from a plain read-only .ics feed (a calendar's "secret address
// in iCal format") and shapes them the same way fetchGoogleEvents() does, so
// routes/events.js can merge both sources into the agenda identically. No
// auth beyond the URL itself - anyone who has the secret link can read it,
// which is the whole point: no Google Cloud project or sign-in required.
export async function fetchIcalEvents(url, rangeStart, rangeEnd, member = 'family') {
  if (!url) return [];
  const data = await ical.async.fromURL(url);
  const results = [];

  function pushOccurrence(item, start, end) {
    if (start >= rangeEnd || (end || start) < rangeStart) return;
    results.push({
      id: `ical-${item.uid}-${start.toISOString()}`,
      title: item.summary || '(untitled)',
      description: item.description || '',
      location: item.location || '',
      member,
      source: 'ical',
      all_day: !!(item.start && item.start.dateOnly),
      recurring: false,
      recurrence_days: [],
      occurrence_start: start.toISOString(),
      occurrence_end: end ? end.toISOString() : null,
    });
  }

  for (const key in data) {
    const item = data[key];
    if (item.type !== 'VEVENT' || !item.start) continue;
    const duration = item.end ? item.end.getTime() - item.start.getTime() : 0;

    if (item.rrule) {
      // between() wants plain Dates and returns each occurrence's start;
      // the end is just that plus the original event's duration.
      const occurrences = item.rrule.between(rangeStart, rangeEnd, true);
      for (const occStart of occurrences) {
        pushOccurrence(item, occStart, duration ? new Date(occStart.getTime() + duration) : null);
      }
    } else {
      pushOccurrence(item, item.start, item.end || null);
    }
  }

  return results;
}
