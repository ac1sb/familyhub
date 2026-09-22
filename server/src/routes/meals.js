import { Router } from 'express';
import db, { withTransaction } from '../db.js';
import { weekStartParam } from '../lib/week.js';

const router = Router();

function ensureWeekRows(week_start) {
  const existing = db.prepare('SELECT * FROM meals WHERE week_start = ? ORDER BY day_of_week ASC').all(week_start);
  if (existing.length === 7) return existing;

  const byDay = new Map(existing.map((r) => [r.day_of_week, r]));
  const insert = db.prepare('INSERT INTO meals (week_start, day_of_week, name) VALUES (?, ?, ?)');
  withTransaction(() => {
    for (let d = 0; d < 7; d++) {
      if (!byDay.has(d)) insert.run(week_start, d, '');
    }
  });
  return db.prepare('SELECT * FROM meals WHERE week_start = ? ORDER BY day_of_week ASC').all(week_start);
}

// GET /api/meals?week=YYYY-MM-DD -> 7 ordered slots Mon..Sun
router.get('/', (req, res) => {
  const week_start = weekStartParam(req.query);
  const rows = ensureWeekRows(week_start);
  res.json({ week_start, meals: rows });
});

// PUT /api/meals/:day_of_week  { name } -> set/edit the meal name for one day slot
router.put('/:day_of_week', (req, res) => {
  const week_start = weekStartParam(req.query);
  const day_of_week = Number(req.params.day_of_week);
  const { name = '' } = req.body;
  ensureWeekRows(week_start);

  db.prepare(
    'UPDATE meals SET name = ? WHERE week_start = ? AND day_of_week = ?'
  ).run(name, week_start, day_of_week);

  const rows = db.prepare('SELECT * FROM meals WHERE week_start = ? ORDER BY day_of_week ASC').all(week_start);
  res.json({ week_start, meals: rows });
});

// PUT /api/meals/reorder  { names: [ 'Tacos', 'Pizza', ... ] } (7 entries, index = day_of_week)
// Used by the drag-and-drop UI: days stay fixed Mon->Sun, only which meal sits in which slot changes.
router.put('/', (req, res) => {
  const week_start = weekStartParam(req.query);
  const { names } = req.body;
  if (!Array.isArray(names) || names.length !== 7) {
    return res.status(400).json({ error: 'names must be an array of 7 items (Mon..Sun)' });
  }
  ensureWeekRows(week_start);

  const update = db.prepare('UPDATE meals SET name = ? WHERE week_start = ? AND day_of_week = ?');
  withTransaction(() => {
    names.forEach((name, day_of_week) => update.run(name || '', week_start, day_of_week));
  });

  const rows = db.prepare('SELECT * FROM meals WHERE week_start = ? ORDER BY day_of_week ASC').all(week_start);
  res.json({ week_start, meals: rows });
});

export default router;
