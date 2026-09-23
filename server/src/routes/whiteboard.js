import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { uploadsDir } from '../lib/paths.js';
import { getSetting, setSetting } from '../lib/settings.js';
import db from '../db.js';

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const router = Router();

// Only this many archived notes are kept - clearing the board is a routine
// action, so without a cap the note history (and the Pi's limited disk)
// would grow forever.
const MAX_NOTES = 30;

function pruneOldNotes() {
  const extra = db
    .prepare('SELECT id, image_path FROM whiteboard_notes ORDER BY id DESC LIMIT -1 OFFSET ?')
    .all(MAX_NOTES);
  if (extra.length === 0) return;
  const del = db.prepare('DELETE FROM whiteboard_notes WHERE id = ?');
  for (const row of extra) {
    del.run(row.id);
    fs.unlink(path.join(uploadsDir, path.basename(row.image_path)), () => {});
  }
}

// A single shared board. Every device polls GET and reloads the image
// whenever image_path changes, which is how a message drawn on one screen
// shows up on the others without needing a live stroke-by-stroke sync
// channel. Clearing it archives whatever was on it into whiteboard_notes
// first (see POST /notes) so old messages aren't just thrown away.
router.get('/', (req, res) => {
  res.json({
    image_path: getSetting('whiteboard_image_path') || null,
    updated_at: getSetting('whiteboard_updated_at') || null,
  });
});

router.post('/', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'image file is required' });

  const filename = `whiteboard-${Date.now()}.png`;
  fs.writeFileSync(path.join(uploadsDir, filename), req.file.buffer);

  // Only one board image is ever kept - remove the previous one so redraws
  // don't quietly fill the disk with a new file every time someone saves.
  const previous = getSetting('whiteboard_image_path');
  if (previous) {
    fs.unlink(path.join(uploadsDir, path.basename(previous)), () => {});
  }

  const image_path = `/uploads/${filename}`;
  const updated_at = new Date().toISOString();
  setSetting('whiteboard_image_path', image_path);
  setSetting('whiteboard_updated_at', updated_at);
  res.json({ image_path, updated_at });
});

// Archived note history - the client posts here (with whatever's currently
// on the canvas, even unsaved strokes) right before it clears the live board,
// so clearing never just throws a message away.
router.get('/notes', (req, res) => {
  const rows = db.prepare('SELECT * FROM whiteboard_notes ORDER BY id DESC LIMIT ?').all(MAX_NOTES);
  res.json({ notes: rows });
});

router.post('/notes', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'image file is required' });

  const filename = `whiteboard-note-${Date.now()}.png`;
  fs.writeFileSync(path.join(uploadsDir, filename), req.file.buffer);

  const image_path = `/uploads/${filename}`;
  const info = db
    .prepare('INSERT INTO whiteboard_notes (image_path) VALUES (?)')
    .run(image_path);
  pruneOldNotes();

  const row = db.prepare('SELECT * FROM whiteboard_notes WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

router.delete('/notes/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM whiteboard_notes WHERE id = ?').get(req.params.id);
  if (row) fs.unlink(path.join(uploadsDir, path.basename(row.image_path)), () => {});
  db.prepare('DELETE FROM whiteboard_notes WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
