import { Router } from 'express';
import db from '../db.js';
import { expandOccurrences } from '../lib/recurrence.js';
import { addDays, startOfWeek } from '../lib/week.js';
import { fetchGoogleEvents } from './google.js';

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

  try {
    const googleEvents = await fetchGoogleEvents(rangeStart, rangeEnd);
    occurrences = occurrences.concat(googleEvents);
  } catch (err) {
    // Google not connected or failed - agenda still works with local events only
  }

  occurrences.sort((a, b) => new Date(a.occurrence_start) - new Date(b.occurrence_start));
  res.json({ range_start: rangeStart.toISOString(), range_end: rangeEnd.toISOString(), events: occurrences });
});

router.post('/', (req, res) => {
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

  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(info.lastInsertRowid);
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
  res.json(rowToEvent(row));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
