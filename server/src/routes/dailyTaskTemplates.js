import { Router } from 'express';
import db, { withTransaction } from '../db.js';

const router = Router();

function rowToTemplate(row) {
  let days;
  try {
    days = JSON.parse(row.days || '[]');
  } catch {
    days = [];
  }
  if (!Array.isArray(days)) days = [];
  return { ...row, active: !!row.active, days };
}

function validDays(days) {
  return (
    Array.isArray(days) &&
    days.length > 0 &&
    days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)
  );
}

// Manages the recurring daily-routine roster (Settings > Daily Checklist Setup).
// Each active template automatically gets a fresh, unchecked instance added on
// each of its selected days, every day - see ensureDayTasks() in routes/dailyTasks.js.
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM daily_task_templates ORDER BY sort_order ASC, id ASC').all();
  res.json({ templates: rows.map(rowToTemplate) });
});

router.post('/', (req, res) => {
  const { title, assigned_to = 'family', days = [0, 1, 2, 3, 4, 5, 6], icon = null } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  if (!validDays(days)) return res.status(400).json({ error: 'days must be a non-empty array of 0-6' });

  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM daily_task_templates').get().m;
  const info = db
    .prepare('INSERT INTO daily_task_templates (title, assigned_to, days, icon, sort_order) VALUES (?, ?, ?, ?, ?)')
    .run(title, assigned_to, JSON.stringify(days), icon, maxOrder + 1);

  const row = db.prepare('SELECT * FROM daily_task_templates WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(rowToTemplate(row));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM daily_task_templates WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });

  if (req.body.days !== undefined && !validDays(req.body.days)) {
    return res.status(400).json({ error: 'days must be a non-empty array of 0-6' });
  }

  const merged = {
    title: req.body.title ?? existing.title,
    assigned_to: req.body.assigned_to ?? existing.assigned_to,
    active: req.body.active !== undefined ? (req.body.active ? 1 : 0) : existing.active,
    days: req.body.days !== undefined ? JSON.stringify(req.body.days) : existing.days,
    // icon: null clears back to auto-guessed - distinct from omitting the
    // field entirely, which leaves whatever was already saved untouched.
    icon: req.body.icon !== undefined ? req.body.icon : existing.icon,
  };

  db.prepare(
    'UPDATE daily_task_templates SET title=@title, assigned_to=@assigned_to, active=@active, days=@days, icon=@icon WHERE id=@id'
  ).run({ ...merged, id: req.params.id });

  const row = db.prepare('SELECT * FROM daily_task_templates WHERE id = ?').get(req.params.id);
  res.json(rowToTemplate(row));
});

router.delete('/:id', (req, res) => {
  // Every active template gets a fresh instance auto-generated on each of
  // its days (see ensureDayTasks() in routes/dailyTasks.js) - by the time
  // anyone deletes a template, today's instance almost always already
  // exists and references it, so deleting the template row alone trips the
  // template_id foreign key. Clear that link on any generated instances
  // first (they become plain one-off items, same as a manually-typed
  // task) rather than deleting the instances themselves, so a day's
  // already-checked history doesn't just vanish.
  withTransaction(() => {
    db.prepare('UPDATE daily_tasks SET template_id = NULL WHERE template_id = ?').run(req.params.id);
    db.prepare('DELETE FROM daily_task_templates WHERE id = ?').run(req.params.id);
  });
  res.status(204).end();
});

export default router;
