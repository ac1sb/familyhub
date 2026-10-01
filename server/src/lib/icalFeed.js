import ical from 'node-ical';

// Every open screen polls the agenda every 20-30s, and each poll used to
// re-download and re-parse every subscribed feed. Google only refreshes a
// secret iCal address every few hours anyway, so a short cache costs nothing
// in freshness. Concurrent callers share one in-flight download.
const FEED_TTL_MS = 5 * 60 * 1000;
const feedCache = new Map();

function loadFeed(url) {
  const cached = feedCache.get(url);
  if (cached && cached.expires > Date.now()) return cached.promise;
  const promise = ical.async.fromURL(url);
  feedCache.set(url, { promise, expires: Date.now() + FEED_TTL_MS });
  promise.catch(() => feedCache.delete(url));
  return promise;
}

// Pulls events from a plain read-only .ics feed (a calendar's "secret address
// in iCal format") and shapes them the same way fetchGoogleEvents() does, so
// routes/events.js can merge both sources into the agenda identically. No
// auth beyond the URL itself - anyone who has the secret link can read it,
// which is the whole point: no Google Cloud project or sign-in required.
export async function fetchIcalEvents(url, rangeStart, rangeEnd, member = 'family') {
  if (!url) return [];
  const data = await loadFeed(url);
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
      // Google's own iCal exports format a UID as "<calendar-API-event-id>@
      // google.com" - exposing the raw UID lets routes/events.js recognize a
      // FamilyHub-pushed event coming back through a subscribed feed as the
      // same event, not a second one, the same way it already does for the
      // OAuth-based reads.
      ical_uid: item.uid || null,
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
