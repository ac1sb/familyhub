import { Router } from 'express';
import db from '../db.js';
import { expandOccurrences } from '../lib/recurrence.js';
import { addDays, startOfWeek, parseDateOnly } from '../lib/week.js';
import {
  fetchGoogleEvents,
  fetchMemberCalendarEvents,
  isGoogleWriteEnabled,
  pushEventToGoogle,
  updateGoogleEvent,
  deleteGoogleEvent,
  getMemberCalendarIds,
  pushEventToMemberCalendars,
  updateMemberCalendarEvents,
  deleteMemberCalendarEvents,
} from './google.js';
import { fetchIcalEvents } from '../lib/icalFeed.js';
import { getIcalFeeds } from '../lib/appConfig.js';

const router = Router();

const MEMBERS = ['member_1', 'member_2', 'member_3', 'family'];

function rowToEvent(row) {
  return {
    ...row,
    all_day: !!row.all_day,
    recurring: !!row.recurring,
    is_reminder: !!row.is_reminder,
    recurrence_days: JSON.parse(row.recurrence_days || '[]'),
  };
}

function getEventGoogleLinks(eventId) {
  return db.prepare('SELECT * FROM event_google_links WHERE event_id = ?').all(eventId);
}

// Pushes an event onto whichever Google Calendar(s) its member maps to - the
// single shared calendar for 'family', or the per-member calendar(s) from
// Settings -> Calendar otherwise (member_3 fans out to both parents). Used
// both for a brand new event and, on reassignment, for re-pushing one that
// changed which member it belongs to.
async function pushEventToGoogleTargets(row) {
  if (row.member === 'family') {
    const googleEventId = await pushEventToGoogle(rowToEvent(row));
    if (googleEventId) db.prepare('UPDATE events SET google_event_id = ? WHERE id = ?').run(googleEventId, row.id);
    return;
  }
  const calendarIds = getMemberCalendarIds(row.member);
  const links = await pushEventToMemberCalendars(rowToEvent(row), calendarIds);
  const insert = db.prepare('INSERT INTO event_google_links (event_id, calendar_id, google_event_id) VALUES (?, ?, ?)');
  for (const link of links) insert.run(row.id, link.calendarId, link.googleEventId);
}

// Removes whatever Google copies an event currently has, regardless of
// whether it was a 'family' event (single google_event_id) or a per-member
// one (event_google_links rows) - used both for a real delete and, on
// reassignment, to clear out the old target(s) before pushing to the new one(s).
async function deleteEventFromGoogleTargets(existingRow) {
  if (existingRow.member === 'family') {
    if (existingRow.google_event_id) await deleteGoogleEvent(existingRow.google_event_id);
    return;
  }
  const links = getEventGoogleLinks(existingRow.id);
  if (links.length > 0) await deleteMemberCalendarEvents(links);
  db.prepare('DELETE FROM event_google_links WHERE event_id = ?').run(existingRow.id);
}

// GET /api/events?week=YYYY-MM-DD          -> agenda for that Mon-Sun week, local + google merged
// GET /api/events?start=YYYY-MM-DD&days=N  -> agenda for a literal N-day window starting on that
//                                             exact date (no Monday snapping) - used for the
//                                             dashboard's rolling "today + next 6 days" view.
router.get('/', async (req, res) => {
  let rangeStart;
  let rangeEnd;
  if (req.query.start && /^\d{4}-\d{2}-\d{2}$/.test(req.query.start)) {
    rangeStart = new Date(`${req.query.start}T00:00:00`);
    rangeEnd = addDays(rangeStart, Number(req.query.days) || 7);
  } else {
    const base = req.query.week ? parseDateOnly(req.query.week) : new Date();
    rangeStart = startOfWeek(base);
    rangeEnd = addDays(rangeStart, 7);
  }

  const rows = db.prepare('SELECT * FROM events').all().map(rowToEvent);
  let occurrences = rows.flatMap((row) => expandOccurrences(row, rangeStart, rangeEnd));

  // Every external source below (the connected account's own calendar, each
  // parent's personal calendar, any subscribed iCal feed) can overlap with
  // any other - the same event can be visible through more than one of them
  // at once (a shared calendar the connected account also belongs to, a feed
  // that happens to export a calendar already read another way, etc). Rather
  // than special-casing each pair, every source is checked against, and adds
  // to, one running "already showing" set as it's processed - first source
  // to report an event wins, everything after it is skipped.
  //
  // events.google_event_id covers a locally-created "family" event pushed to
  // the single shared calendar; event_google_links covers the per-member
  // sync (Settings -> Calendar -> "Sync each person's events with their own
  // Google Calendar") - both seed the set before any external source is
  // fetched, so a FamilyHub-authored event always wins over any read-only
  // copy of itself, regardless of which source that copy comes back through.
  const linkedGoogleIds = db.prepare('SELECT google_event_id FROM event_google_links').all().map((r) => r.google_event_id);
  const seenGoogleIds = new Set([
    ...rows.filter((r) => r.google_event_id).map((r) => r.google_event_id),
    ...linkedGoogleIds,
  ]);
  // Google gives the same logical event a different `id` on every calendar
  // it's visible on - `id` is only unique within one calendar. iCalUID is
  // the field Google keeps identical everywhere that event appears,
  // including across a plain iCal export of the same calendar, so it's what
  // catches an overlap `id` alone would miss.
  const seenICalUids = new Set();
  const GOOGLE_ICAL_UID_SUFFIX = '@google.com';

  function isFresh(ev) {
    if (seenGoogleIds.has(ev.google_event_id)) return false;
    if (!ev.ical_uid) return true;
    if (seenICalUids.has(ev.ical_uid)) return false;
    if (ev.ical_uid.endsWith(GOOGLE_ICAL_UID_SUFFIX)) {
      const derivedId = ev.ical_uid.slice(0, -GOOGLE_ICAL_UID_SUFFIX.length);
      if (seenGoogleIds.has(derivedId)) return false;
    }
    return true;
  }

  function remember(ev) {
    if (ev.google_event_id) seenGoogleIds.add(ev.google_event_id);
    if (ev.ical_uid) seenICalUids.add(ev.ical_uid);
  }

  // All sources are fetched in parallel, then merged strictly in this
  // priority order: each parent's own calendar first (so an event there is
  // attributed to that specific member rather than the connected account's
  // single "Show its events under" choice), then the connected account's
  // primary calendar, then each iCal feed. Any source failing (not
  // connected, unreachable, misconfigured) just contributes nothing. Feed
  // results are namespaced with the feed's index so two feeds can never
  // collide on id even if they share a UID (a copy-pasted .ics template).
  const feeds = getIcalFeeds();
  const [memberResult, primaryResult, ...feedResults] = await Promise.allSettled([
    fetchMemberCalendarEvents(rangeStart, rangeEnd),
    fetchGoogleEvents(rangeStart, rangeEnd),
    ...feeds.map((feed) => fetchIcalEvents(feed.url, rangeStart, rangeEnd, feed.member)),
  ]);

  function merge(result, mapEvent = (ev) => ev) {
    if (result.status !== 'fulfilled') return;
    const fresh = result.value.filter(isFresh);
    fresh.forEach(remember);
    occurrences = occurrences.concat(fresh.map(mapEvent));
  }

  merge(memberResult);
  merge(primaryResult);
  feedResults.forEach((result, i) => merge(result, (ev) => ({ ...ev, id: `${i}-${ev.id}` })));

  occurrences.sort((a, b) => new Date(a.occurrence_start) - new Date(b.occurrence_start));
  res.json({ range_start: rangeStart.toISOString(), range_end: rangeEnd.toISOString(), events: occurrences });
});

router.post('/', async (req, res) => {
  const {
    title,
    description = '',
    location = '',
    member = 'family',
    start_datetime,
    end_datetime = null,
    all_day = false,
    recurring = false,
    recurrence_days = [],
    recurrence_type = 'weekly',
    recurrence_interval = 1,
    photo_path = null,
    is_reminder = false,
  } = req.body;

  if (!title || !start_datetime) {
    return res.status(400).json({ error: 'title and start_datetime are required' });
  }
  if (!MEMBERS.includes(member)) {
    return res.status(400).json({ error: 'invalid member' });
  }
  if (!['weekly', 'monthly'].includes(recurrence_type)) {
    return res.status(400).json({ error: 'recurrence_type must be weekly or monthly' });
  }

  const stmt = db.prepare(`
    INSERT INTO events (title, description, location, member, start_datetime, end_datetime, all_day, recurring, recurrence_days, recurrence_type, recurrence_interval, photo_path, is_reminder)
    VALUES (@title, @description, @location, @member, @start_datetime, @end_datetime, @all_day, @recurring, @recurrence_days, @recurrence_type, @recurrence_interval, @photo_path, @is_reminder)
  `);
  const info = stmt.run({
    title,
    description,
    location,
    member,
    start_datetime,
    end_datetime,
    all_day: all_day ? 1 : 0,
    recurring: recurring ? 1 : 0,
    recurrence_days: JSON.stringify(recurrence_days),
    recurrence_type,
    recurrence_interval: Math.max(1, Number(recurrence_interval) || 1),
    photo_path,
    is_reminder: is_reminder ? 1 : 0,
  });

  let row = db.prepare('SELECT * FROM events WHERE id = ?').get(info.lastInsertRowid);

  // Best-effort mirror to Google Calendar - a failed push (not connected,
  // API hiccup) shouldn't stop the event from being saved locally. Recurring
  // events are skipped: our weekly recurrence_days model doesn't map onto a
  // single Google event, and creating a real Google recurring series would
  // come back from fetchGoogleEvents as one entry per occurrence (Google
  // expands them with singleEvents:true) with per-instance ids that never
  // match this row's single google_event_id - every occurrence would show
  // up twice on the agenda instead of being deduped.
  if (isGoogleWriteEnabled() && !row.recurring) {
    try {
      await pushEventToGoogleTargets(row);
      row = db.prepare('SELECT * FROM events WHERE id = ?').get(row.id);
    } catch (err) {
      console.error('Failed to push new event to Google Calendar:', err.message);
    }
  }

  res.status(201).json(rowToEvent(row));
});

router.put('/:id', async (req, res) => {
  const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });

  if (req.body.recurrence_type !== undefined && !['weekly', 'monthly'].includes(req.body.recurrence_type)) {
    return res.status(400).json({ error: 'recurrence_type must be weekly or monthly' });
  }
  if (req.body.member !== undefined && !MEMBERS.includes(req.body.member)) {
    return res.status(400).json({ error: 'invalid member' });
  }

  const merged = {
    title: req.body.title ?? existing.title,
    description: req.body.description ?? existing.description,
    location: req.body.location ?? existing.location,
    member: req.body.member ?? existing.member,
    start_datetime: req.body.start_datetime ?? existing.start_datetime,
    // An explicit null clears the end time (the edit form sends null when the
    // "Ends" field is emptied) - only an omitted field keeps the old one.
    end_datetime: req.body.end_datetime !== undefined ? req.body.end_datetime : existing.end_datetime,
    all_day: req.body.all_day !== undefined ? (req.body.all_day ? 1 : 0) : existing.all_day,
    recurring: req.body.recurring !== undefined ? (req.body.recurring ? 1 : 0) : existing.recurring,
    recurrence_days: req.body.recurrence_days ? JSON.stringify(req.body.recurrence_days) : existing.recurrence_days,
    recurrence_type: req.body.recurrence_type ?? existing.recurrence_type,
    recurrence_interval:
      req.body.recurrence_interval !== undefined
        ? Math.max(1, Number(req.body.recurrence_interval) || 1)
        : existing.recurrence_interval,
    photo_path: req.body.photo_path ?? existing.photo_path,
    is_reminder: req.body.is_reminder !== undefined ? (req.body.is_reminder ? 1 : 0) : existing.is_reminder,
  };

  db.prepare(`
    UPDATE events SET title=@title, description=@description, location=@location, member=@member,
      start_datetime=@start_datetime, end_datetime=@end_datetime, all_day=@all_day, recurring=@recurring,
      recurrence_days=@recurrence_days, recurrence_type=@recurrence_type, recurrence_interval=@recurrence_interval,
      photo_path=@photo_path, is_reminder=@is_reminder, updated_at=datetime('now')
    WHERE id=@id
  `).run({ ...merged, id: req.params.id });

  let row = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);

  if (isGoogleWriteEnabled()) {
    try {
      if (existing.member !== row.member) {
        // Which calendar(s) this event belongs on changed (e.g. reassigned
        // from one person's column to another's) - move it by removing the
        // old copy/copies and pushing a fresh one to the new target(s),
        // rather than trying to patch across calendars.
        await deleteEventFromGoogleTargets(existing);
        if (!row.recurring) {
          await pushEventToGoogleTargets(row);
          row = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
        }
      } else if (row.member === 'family') {
        if (existing.google_event_id) await updateGoogleEvent(existing.google_event_id, rowToEvent(row));
      } else {
        const links = getEventGoogleLinks(row.id);
        if (links.length > 0) await updateMemberCalendarEvents(links, rowToEvent(row));
      }
    } catch (err) {
      console.error('Failed to sync updated event to Google Calendar:', err.message);
    }
  }

  res.json(rowToEvent(row));
});

router.delete('/:id', async (req, res) => {
  const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  // A Google-synced or iCal-feed-sourced occurrence (id like "google-..." or
  // "0-ical-...") has no local row to begin with - surface that clearly
  // instead of silently returning success and having the item reappear on
  // the client's next refresh, straight from whichever feed it came from.
  if (!existing) return res.status(404).json({ error: 'not found' });
  // Read any per-member links before the delete below, since removing the
  // event row cascades and takes them with it.
  const links = existing.member !== 'family' ? getEventGoogleLinks(existing.id) : [];

  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);

  if (isGoogleWriteEnabled()) {
    try {
      if (existing.member === 'family') {
        if (existing.google_event_id) await deleteGoogleEvent(existing.google_event_id);
      } else if (links.length > 0) {
        await deleteMemberCalendarEvents(links);
      }
    } catch (err) {
      console.error('Failed to delete event on Google Calendar:', err.message);
    }
  }

  res.status(204).end();
});

export default router;
