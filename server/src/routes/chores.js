import { Router } from 'express';
import db, { withTransaction } from '../db.js';
import { weekStartParam } from '../lib/week.js';

const router = Router();

// Recurring chores are managed as templates (Settings > Chore Setup). Whenever
// a week's chore list is requested, make sure every active template has a
// fresh, unchecked instance for that week — carrying a chore forward every
// week without ever duplicating one that's already there.
function ensureWeekChores(week_start) {
  const templates = db.prepare('SELECT * FROM chore_templates WHERE active = 1 ORDER BY sort_order ASC, id ASC').all();
  if (templates.length === 0) return;

  const existingTemplateIds = new Set(
    db
      .prepare('SELECT template_id FROM chores WHERE week_start = ? AND template_id IS NOT NULL')
      .all(week_start)
      .map((r) => r.template_id)
  );
  const missing = templates.filter((t) => !existingTemplateIds.has(t.id));
  if (missing.length === 0) return;

  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM chores WHERE week_start = ?').get(week_start).m;
  const insert = db.prepare(
    'INSERT INTO chores (title, assigned_to, recurring, template_id, week_start, sort_order) VALUES (?, ?, 1, ?, ?, ?)'
  );
  withTransaction(() => {
    missing.forEach((t, i) => insert.run(t.title, t.assigned_to, t.id, week_start, maxOrder + 1 + i));
  });
}

router.get('/', (req, res) => {
  const week_start = weekStartParam(req.query);
  ensureWeekChores(week_start);
  const rows = db
    .prepare('SELECT * FROM chores WHERE week_start = ? ORDER BY sort_order ASC, id ASC')
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
