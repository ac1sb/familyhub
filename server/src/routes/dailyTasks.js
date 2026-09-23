import { Router } from 'express';
import db, { withTransaction } from '../db.js';
import { toISODate } from '../lib/week.js';

const router = Router();

// Whenever a day's checklist is requested, make sure every active template
// that applies to that weekday has a fresh, unchecked instance for it -
// resetting every day instead of carrying a checked box forward, unlike chores.
function ensureDayTasks(date) {
  const templates = db.prepare('SELECT * FROM daily_task_templates WHERE active = 1 ORDER BY sort_order ASC, id ASC').all();
  if (templates.length === 0) return;

  const weekday = (new Date(`${date}T00:00:00`).getDay() + 6) % 7; // 0=Mon..6=Sun

  const existingTemplateIds = new Set(
    db
      .prepare('SELECT template_id FROM daily_tasks WHERE date = ? AND template_id IS NOT NULL')
      .all(date)
      .map((r) => r.template_id)
  );

  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM daily_tasks WHERE date = ?').get(date).m;
  const insert = db.prepare(
    'INSERT INTO daily_tasks (title, assigned_to, template_id, date, sort_order) VALUES (?, ?, ?, ?, ?)'
  );

  withTransaction(() => {
    let order = maxOrder;
    for (const t of templates) {
      if (existingTemplateIds.has(t.id)) continue;
      let days;
      try {
        days = JSON.parse(t.days || '[]');
      } catch {
        days = [];
      }
      if (!Array.isArray(days) || days.length === 0) days = [0, 1, 2, 3, 4, 5, 6];
      if (!days.includes(weekday)) continue;

      order += 1;
      insert.run(t.title, t.assigned_to, t.id, date, order);
    }
  });
}

router.get('/', (req, res) => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : toISODate(new Date());
  ensureDayTasks(date);
  const rows = db
    .prepare('SELECT * FROM daily_tasks WHERE date = ? ORDER BY sort_order ASC, id ASC')
    .all(date)
    .map((r) => ({ ...r, done: !!r.done }));
  res.json({ date, tasks: rows });
});

router.post('/', (req, res) => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : toISODate(new Date());
  const { title, assigned_to = 'family' } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });

  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM daily_tasks WHERE date = ?').get(date).m;
  const info = db
    .prepare('INSERT INTO daily_tasks (title, assigned_to, date, sort_order) VALUES (?, ?, ?, ?)')
    .run(title, assigned_to, date, maxOrder + 1);

  const row = db.prepare('SELECT * FROM daily_tasks WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ ...row, done: !!row.done });
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM daily_tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });

  const merged = {
    title: req.body.title ?? existing.title,
    assigned_to: req.body.assigned_to ?? existing.assigned_to,
    done: req.body.done !== undefined ? (req.body.done ? 1 : 0) : existing.done,
  };

  db.prepare('UPDATE daily_tasks SET title=@title, assigned_to=@assigned_to, done=@done WHERE id=@id').run({
    ...merged,
    id: req.params.id,
  });

  const row = db.prepare('SELECT * FROM daily_tasks WHERE id = ?').get(req.params.id);
  res.json({ ...row, done: !!row.done });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM daily_tasks WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
