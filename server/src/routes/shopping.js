import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM shopping_items ORDER BY checked ASC, sort_order ASC, id ASC').all();
  res.json({ items: rows.map((r) => ({ ...r, checked: !!r.checked })) });
});

router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM shopping_items').get().m;
  const info = db.prepare('INSERT INTO shopping_items (name, sort_order) VALUES (?, ?)').run(name, maxOrder + 1);
  const row = db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ ...row, checked: !!row.checked });
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const checked = req.body.checked !== undefined ? (req.body.checked ? 1 : 0) : existing.checked;
  const name = req.body.name ?? existing.name;
  db.prepare('UPDATE shopping_items SET name=?, checked=? WHERE id=?').run(name, checked, req.params.id);
  const row = db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(req.params.id);
  res.json({ ...row, checked: !!row.checked });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM shopping_items WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
