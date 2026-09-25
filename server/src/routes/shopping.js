import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import db from '../db.js';
import { uploadsDir } from '../lib/paths.js';
import { getShoppingSheetId, setShoppingSheetId } from '../lib/appConfig.js';
import { pushShoppingListToSheet } from './google.js';

// Accepts either a bare spreadsheet ID or a full Sheets URL
// (docs.google.com/spreadsheets/d/<ID>/edit#gid=0) and returns just the ID -
// pasting the URL straight out of the browser's address bar should just work.
function extractSheetId(input) {
  const trimmed = (input || '').trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : trimmed;
}

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

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

// POST /api/shopping/ink  (multipart form field "image") -> a handwritten item, drawn on a
// touchscreen instead of typed. Saved as the ink itself (a PNG snapshot); name starts blank
// and can be filled in later from any device via the "Type it" action (PUT with a name).
router.post('/ink', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'image file is required' });

  const filename = `shopping-ink-${Date.now()}.png`;
  fs.writeFileSync(`${uploadsDir}/${filename}`, req.file.buffer);
  const image_path = `/uploads/${filename}`;

  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM shopping_items').get().m;
  const info = db
    .prepare('INSERT INTO shopping_items (name, image_path, sort_order) VALUES (?, ?, ?)')
    .run('', image_path, maxOrder + 1);
  const row = db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ ...row, checked: !!row.checked });
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const checked = req.body.checked !== undefined ? (req.body.checked ? 1 : 0) : existing.checked;
  const name = req.body.name ?? existing.name;
  // Crossing an item off means "purchased" - stamp when that happened; un-crossing
  // (tapping it again) clears the stamp rather than keeping a stale one around.
  const checked_at =
    req.body.checked !== undefined ? (checked ? new Date().toISOString() : null) : existing.checked_at;
  db.prepare('UPDATE shopping_items SET name=?, checked=?, checked_at=? WHERE id=?').run(
    name,
    checked,
    checked_at,
    req.params.id
  );
  const row = db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(req.params.id);
  res.json({ ...row, checked: !!row.checked });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM shopping_items WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// GET /api/shopping/sheet-settings -> the saved spreadsheet ID, so the "Sync
// to Sheet" UI can prefill it (same pattern as the lunch menu import URL).
router.get('/sheet-settings', (req, res) => {
  res.json({ sheetId: getShoppingSheetId() });
});

// POST /api/shopping/sync-sheet  { sheetId? } -> pushes every still-needed
// item into that spreadsheet's "FamilyHub" tab. sheetId is optional if one's
// already saved; when given, it's saved for next time too (accepts a full
// Sheets URL or a bare ID either way).
router.post('/sync-sheet', async (req, res) => {
  const sheetId = extractSheetId(req.body.sheetId) || getShoppingSheetId();
  if (!sheetId) return res.status(400).json({ error: 'A Google Sheet ID or URL is required' });
  if (req.body.sheetId) setShoppingSheetId(sheetId);

  const items = db
    .prepare('SELECT name FROM shopping_items WHERE checked = 0 ORDER BY sort_order ASC, id ASC')
    .all()
    .map((r) => r.name)
    .filter(Boolean);

  try {
    await pushShoppingListToSheet(sheetId, items);
    res.json({ success: true, synced: items.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
