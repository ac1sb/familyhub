import { Router } from 'express';
import db from '../db.js';
import { weekStartParam } from '../lib/week.js';

const router = Router();

function ensureWeekRows(week_start) {
  const existing = db.prepare('SELECT * FROM lunch WHERE week_start = ? ORDER BY day_of_week ASC').all(week_start);
  if (existing.length === 5) return existing;

  const byDay = new Map(existing.map((r) => [r.day_of_week, r]));
  const insert = db.prepare('INSERT INTO lunch (week_start, day_of_week, status) VALUES (?, ?, ?)');
  const tx = db.transaction(() => {
    for (let d = 0; d < 5; d++) {
      if (!byDay.has(d)) insert.run(week_start, d, 'home');
    }
  });
  tx();
  return db.prepare('SELECT * FROM lunch WHERE week_start = ? ORDER BY day_of_week ASC').all(week_start);
}

// GET /api/lunch?week=YYYY-MM-DD -> Mon-Fri status for the single child tracked
router.get('/', (req, res) => {
  const week_start = weekStartParam(req.query);
  const rows = ensureWeekRows(week_start);
  res.json({ week_start, days: rows });
});

// PUT /api/lunch/:day_of_week  { status: 'school' | 'home' }
router.put('/:day_of_week', (req, res) => {
  const week_start = weekStartParam(req.query);
  const day_of_week = Number(req.params.day_of_week);
  const { status } = req.body;
  if (day_of_week < 0 || day_of_week > 4) return res.status(400).json({ error: 'day_of_week must be 0-4 (Mon-Fri)' });
  if (!['school', 'home'].includes(status)) return res.status(400).json({ error: "status must be 'school' or 'home'" });

  ensureWeekRows(week_start);
  db.prepare('UPDATE lunch SET status = ? WHERE week_start = ? AND day_of_week = ?').run(status, week_start, day_of_week);

  const rows = db.prepare('SELECT * FROM lunch WHERE week_start = ? ORDER BY day_of_week ASC').all(week_start);
  res.json({ week_start, days: rows });
});

export default router;
