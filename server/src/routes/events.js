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
    recurrence_days: JSON.parse(row.recurrence_days || '[]'),
  };
}

// GET /api/events?week=YYYY-MM-DD  -> agenda for that week (Mon-Sun), local + google merged
router.get('/', async (req, res) => {
  const base = req.query.week ? new Date(req.query.week) : new Date();
  const rangeStart = startOfWeek(base);
  const rangeEnd = addDays(rangeStart, 7);

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
  } = req.body;

  if (!title || !start_datetime) {
    return res.status(400).json({ error: 'title and start_datetime are required' });
  }
  if (!MEMBERS.includes(member)) {
    return res.status(400).json({ error: 'invalid member' });
  }

  const stmt = db.prepare(`
    INSERT INTO events (title, description, location, member, start_datetime, end_datetime, all_day, recurring, recurrence_days, photo_path)
    VALUES (@title, @description, @location, @member, @start_datetime, @end_datetime, @all_day, @recurring, @recurrence_days, @photo_path)
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
  };

  db.prepare(`
    UPDATE events SET title=@title, description=@description, location=@location, member=@member,
      start_datetime=@start_datetime, end_datetime=@end_datetime, all_day=@all_day, recurring=@recurring,
      recurrence_days=@recurrence_days, photo_path=@photo_path, updated_at=datetime('now')
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
