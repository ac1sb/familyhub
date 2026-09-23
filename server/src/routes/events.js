import { Router } from 'express';
import db from '../db.js';
import { expandOccurrences } from '../lib/recurrence.js';
import { addDays, startOfWeek } from '../lib/week.js';
import { fetchGoogleEvents, isGoogleWriteEnabled, pushEventToGoogle, updateGoogleEvent, deleteGoogleEvent } from './google.js';
import { fetchIcalEvents } from '../lib/icalFeed.js';
import { getIcalFeedUrl } from '../lib/appConfig.js';

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
    const base = req.query.week ? new Date(req.query.week) : new Date();
    rangeStart = startOfWeek(base);
    rangeEnd = addDays(rangeStart, 7);
  }

  const rows = db.prepare('SELECT * FROM events').all().map(rowToEvent);
  let occurrences = rows.flatMap((row) => expandOccurrences(row, rangeStart, rangeEnd));

  // A local event that's already been pushed to Google (google_event_id set)
  // would otherwise show up twice - once as the local row, once again as
  // Google's own copy of the same event when we fetch that calendar below.
  const pushedGoogleIds = new Set(rows.filter((r) => r.google_event_id).map((r) => r.google_event_id));

  try {
    const googleEvents = await fetchGoogleEvents(rangeStart, rangeEnd);
    occurrences = occurrences.concat(googleEvents.filter((ev) => !pushedGoogleIds.has(ev.google_event_id)));
  } catch (err) {
    // Google not connected or failed - agenda still works with local events only
  }

  try {
    const icalUrl = getIcalFeedUrl();
    if (icalUrl) occurrences = occurrences.concat(await fetchIcalEvents(icalUrl, rangeStart, rangeEnd));
  } catch (err) {
    // Feed unreachable/misconfigured - agenda still works with the other sources
  }

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
    photo_path = null,
    is_reminder = false,
  } = req.body;

  if (!title || !start_datetime) {
    return res.status(400).json({ error: 'title and start_datetime are required' });
  }
  if (!MEMBERS.includes(member)) {
    return res.status(400).json({ error: 'invalid member' });
  }

  const stmt = db.prepare(`
    INSERT INTO events (title, description, location, member, start_datetime, end_datetime, all_day, recurring, recurrence_days, photo_path, is_reminder)
    VALUES (@title, @description, @location, @member, @start_datetime, @end_datetime, @all_day, @recurring, @recurrence_days, @photo_path, @is_reminder)
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
      const googleEventId = await pushEventToGoogle(rowToEvent(row));
      if (googleEventId) {
        db.prepare('UPDATE events SET google_event_id = ? WHERE id = ?').run(googleEventId, row.id);
        row = db.prepare('SELECT * FROM events WHERE id = ?').get(row.id);
      }
    } catch (err) {
      console.error('Failed to push new event to Google Calendar:', err.message);
    }
  }

  res.status(201).json(rowToEvent(row));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });

  const merged = {
    title: req.body.title ?? existing.title,
    description: req.body.description ?? existing.description,
    location: req.body.location ?? existing.location,
    member: req.body.member ?? existing.member,
    start_datetime: req.body.start_datetime ?? existing.start_datetime,
    end_datetime: req.body.end_datetime ?? existing.end_datetime,
    all_day: req.body.all_day !== undefined ? (req.body.all_day ? 1 : 0) : existing.all_day,
    recurring: req.body.recurring !== undefined ? (req.body.recurring ? 1 : 0) : existing.recurring,
    recurrence_days: req.body.recurrence_days ? JSON.stringify(req.body.recurrence_days) : existing.recurrence_days,
    photo_path: req.body.photo_path ?? existing.photo_path,
    is_reminder: req.body.is_reminder !== undefined ? (req.body.is_reminder ? 1 : 0) : existing.is_reminder,
  };

  db.prepare(`
    UPDATE events SET title=@title, description=@description, location=@location, member=@member,
      start_datetime=@start_datetime, end_datetime=@end_datetime, all_day=@all_day, recurring=@recurring,
      recurrence_days=@recurrence_days, photo_path=@photo_path, is_reminder=@is_reminder, updated_at=datetime('now')
    WHERE id=@id
  `).run({ ...merged, id: req.params.id });

  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);

  if (existing.google_event_id && isGoogleWriteEnabled()) {
    updateGoogleEvent(existing.google_event_id, rowToEvent(row)).catch((err) => {
      console.error('Failed to update event on Google Calendar:', err.message);
    });
  }

  res.json(rowToEvent(row));
});

router.delete('/:id', async (req, res) => {
  const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);

  if (existing?.google_event_id && isGoogleWriteEnabled()) {
    try {
      await deleteGoogleEvent(existing.google_event_id);
    } catch (err) {
      console.error('Failed to delete event on Google Calendar:', err.message);
    }
  }

  res.status(204).end();
});

export default router;
