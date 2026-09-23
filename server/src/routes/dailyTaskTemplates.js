import { Router } from 'express';
import db from '../db.js';

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
  const { title, assigned_to = 'family', days = [0, 1, 2, 3, 4, 5, 6] } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  if (!validDays(days)) return res.status(400).json({ error: 'days must be a non-empty array of 0-6' });

  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM daily_task_templates').get().m;
  const info = db
    .prepare('INSERT INTO daily_task_templates (title, assigned_to, days, sort_order) VALUES (?, ?, ?, ?)')
    .run(title, assigned_to, JSON.stringify(days), maxOrder + 1);

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
  };

  db.prepare(
    'UPDATE daily_task_templates SET title=@title, assigned_to=@assigned_to, active=@active, days=@days WHERE id=@id'
  ).run({ ...merged, id: req.params.id });

  const row = db.prepare('SELECT * FROM daily_task_templates WHERE id = ?').get(req.params.id);
  res.json(rowToTemplate(row));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM daily_task_templates WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
