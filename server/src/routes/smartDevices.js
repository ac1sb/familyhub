import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Mock smart-home layer: see the smart_devices table comment in db.js. Every
// handler here only reads/writes this table - there is no LIFX or Lutron
// network call anywhere in this file yet.
function serialize(row) {
  return {
    ...row,
    dimmable: !!row.dimmable,
    color_capable: !!row.color_capable,
    is_on: !!row.is_on,
  };
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM smart_devices ORDER BY room ASC, sort_order ASC, id ASC').all();
  res.json({ devices: rows.map(serialize) });
});

router.post('/', (req, res) => {
  const { name, room = '', platform } = req.body;
  if (!name || !platform) return res.status(400).json({ error: 'name and platform are required' });
  if (!['lifx', 'caseta'].includes(platform)) return res.status(400).json({ error: 'platform must be lifx or caseta' });

  // LIFX bulbs (the color line this mockup targets) are always dimmable and
  // color-capable; Caseta covers plain on/off switches and dimmer switches,
  // never color.
  const kind = platform === 'lifx' ? 'light' : req.body.kind === 'dimmer' ? 'dimmer' : 'switch';
  const dimmable = platform === 'lifx' || kind === 'dimmer' ? 1 : 0;
  const color_capable = platform === 'lifx' ? 1 : 0;

  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM smart_devices').get().m;
  const info = db
    .prepare(
      'INSERT INTO smart_devices (name, room, platform, kind, dimmable, color_capable, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(name, room, platform, kind, dimmable, color_capable, maxOrder + 1);

  const row = db.prepare('SELECT * FROM smart_devices WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(serialize(row));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM smart_devices WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });

  const merged = {
    name: req.body.name ?? existing.name,
    room: req.body.room ?? existing.room,
    is_on: req.body.is_on !== undefined ? (req.body.is_on ? 1 : 0) : existing.is_on,
    brightness:
      req.body.brightness !== undefined
        ? Math.max(0, Math.min(100, Number(req.body.brightness)))
        : existing.brightness,
    color: req.body.color ?? existing.color,
  };

  db.prepare(
    'UPDATE smart_devices SET name=@name, room=@room, is_on=@is_on, brightness=@brightness, color=@color WHERE id=@id'
  ).run({ ...merged, id: req.params.id });

  const row = db.prepare('SELECT * FROM smart_devices WHERE id = ?').get(req.params.id);
  res.json(serialize(row));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM smart_devices WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
