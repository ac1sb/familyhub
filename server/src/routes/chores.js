import { Router } from 'express';
import db, { withTransaction } from '../db.js';
import { weekStartParam } from '../lib/week.js';

const router = Router();

// Recurring chores are managed as templates (Settings > Chore Setup). Whenever
// a week's chore list is requested, make sure every active template has a
// fresh, unchecked instance for each of its selected days that week — carrying
// chores forward every week without ever duplicating one that's already there.
function ensureWeekChores(week_start) {
  const templates = db.prepare('SELECT * FROM chore_templates WHERE active = 1 ORDER BY sort_order ASC, id ASC').all();
  if (templates.length === 0) return;

  const existingKeys = new Set(
    db
      .prepare('SELECT template_id, day_of_week FROM chores WHERE week_start = ? AND template_id IS NOT NULL')
      .all(week_start)
      .map((r) => `${r.template_id}:${r.day_of_week}`)
  );

  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM chores WHERE week_start = ?').get(week_start).m;
  const insert = db.prepare(
    'INSERT INTO chores (title, assigned_to, recurring, template_id, day_of_week, week_start, sort_order) VALUES (?, ?, 1, ?, ?, ?, ?)'
  );

  withTransaction(() => {
    let order = maxOrder;
    for (const t of templates) {
      let days;
      try {
        days = JSON.parse(t.days || '[]');
      } catch {
        days = [];
      }
      if (!Array.isArray(days) || days.length === 0) days = [0, 1, 2, 3, 4, 5, 6];

      for (const day of days) {
        const key = `${t.id}:${day}`;
        if (existingKeys.has(key)) continue;
        order += 1;
        insert.run(t.title, t.assigned_to, t.id, day, week_start, order);
        existingKeys.add(key);
      }
    }
  });
}

router.get('/', (req, res) => {
  const week_start = weekStartParam(req.query);
  ensureWeekChores(week_start);
  const rows = db
    .prepare(
      'SELECT * FROM chores WHERE week_start = ? ORDER BY (day_of_week IS NULL) ASC, day_of_week ASC, sort_order ASC, id ASC'
    )
    .all(week_start)
    .map((r) => ({ ...r, done: !!r.done, recurring: !!r.recurring }));
  res.json({ week_start, chores: rows });
});

router.post('/', (req, res) => {
  const week_start = weekStartParam(req.query);
  const { title, assigned_to = 'family', recurring = false, day_of_week = null } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });

  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM chores WHERE week_start = ?').get(week_start).m;

  const info = db
    .prepare(
      'INSERT INTO chores (title, assigned_to, recurring, day_of_week, week_start, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(title, assigned_to, recurring ? 1 : 0, day_of_week, week_start, maxOrder + 1);

  const row = db.prepare('SELECT * FROM chores WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ ...row, done: !!row.done, recurring: !!row.recurring });
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM chores WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });

  const merged = {
    title: req.body.title ?? existing.title,
    assigned_to: req.body.assigned_to ?? existing.assigned_to,
    recurring: req.body.recurring !== undefined ? (req.body.recurring ? 1 : 0) : existing.recurring,
    day_of_week: req.body.day_of_week !== undefined ? req.body.day_of_week : existing.day_of_week,
    done: req.body.done !== undefined ? (req.body.done ? 1 : 0) : existing.done,
  };

  db.prepare(
    'UPDATE chores SET title=@title, assigned_to=@assigned_to, recurring=@recurring, day_of_week=@day_of_week, done=@done WHERE id=@id'
  ).run({ ...merged, id: req.params.id });

  const row = db.prepare('SELECT * FROM chores WHERE id = ?').get(req.params.id);
  res.json({ ...row, done: !!row.done, recurring: !!row.recurring });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM chores WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
