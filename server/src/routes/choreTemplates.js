import { Router } from 'express';
import db from '../db.js';

const router = Router();

function rowToTemplate(row) {
  return { ...row, active: !!row.active };
}

// Manages the recurring "chore roster" (Settings > Chore Setup). Each active
// template automatically gets a fresh, unchecked instance added to every new
// week's chore list — see ensureWeekChores() in routes/chores.js.
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM chore_templates ORDER BY sort_order ASC, id ASC').all();
  res.json({ templates: rows.map(rowToTemplate) });
});

router.post('/', (req, res) => {
  const { title, assigned_to = 'family' } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });

  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM chore_templates').get().m;
  const info = db
    .prepare('INSERT INTO chore_templates (title, assigned_to, sort_order) VALUES (?, ?, ?)')
    .run(title, assigned_to, maxOrder + 1);

  const row = db.prepare('SELECT * FROM chore_templates WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(rowToTemplate(row));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM chore_templates WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });

  const merged = {
    title: req.body.title ?? existing.title,
    assigned_to: req.body.assigned_to ?? existing.assigned_to,
    active: req.body.active !== undefined ? (req.body.active ? 1 : 0) : existing.active,
  };

  db.prepare('UPDATE chore_templates SET title=@title, assigned_to=@assigned_to, active=@active WHERE id=@id').run({
    ...merged,
    id: req.params.id,
  });

  const row = db.prepare('SELECT * FROM chore_templates WHERE id = ?').get(req.params.id);
  res.json(rowToTemplate(row));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM chore_templates WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
