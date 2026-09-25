import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import db from '../db.js';
import { uploadsDir } from '../lib/paths.js';
import { getShoppingSheetId, setShoppingSheetId } from '../lib/appConfig.js';
import { readShoppingSheetRows, writeShoppingSheetUpdates } from './google.js';

// Accepts either a bare spreadsheet ID or a full Sheets URL
// (docs.google.com/spreadsheets/d/<ID>/edit#gid=0) and returns just the ID -
// pasting the URL straight out of the browser's address bar should just work.
function extractSheetId(input) {
  const trimmed = (input || '').trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : trimmed;
}

// The matching side of the two-way sync, kept pure (no DB, no network) so
// it can be unit-tested directly: given the sheet's current rows and every
// local item, decide which sheet rows are already linked to a real item,
// which match an existing still-needed item by name (first sync of a sheet
// that already had the same items typed in), and which are genuinely new
// and need a local item created for them. The caller does the actual
// INSERTs (needs real auto-increment ids) and then separately figures out
// which still-needed items have no sheet row yet.
export function planShoppingSheetLinks(sheetRows, allItems) {
  const itemsById = new Map(allItems.map((i) => [i.id, i]));
  const stillNeeded = allItems.filter((i) => !i.checked);
  const linkedIds = new Set();
  const idUpdatesForExisting = [];
  const toInsert = [];

  for (const row of sheetRows) {
    if (row.id && itemsById.has(row.id)) {
      linkedIds.add(row.id);
      continue;
    }
    const nameMatch = stillNeeded.find(
      (i) => !linkedIds.has(i.id) && i.name.trim().toLowerCase() === row.name.toLowerCase()
    );
    if (nameMatch) {
      linkedIds.add(nameMatch.id);
      idUpdatesForExisting.push({ rowNumber: row.rowNumber, id: nameMatch.id });
      continue;
    }
    toInsert.push({ rowNumber: row.rowNumber, name: row.name });
  }

  return { toInsert, idUpdatesForExisting, linkedIds };
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

// GET /api/shopping/sheet-settings -> the saved spreadsheet ID, so Settings
// can prefill it (same pattern as the LIFX token / lunch menu import URL).
router.get('/sheet-settings', (req, res) => {
  res.json({ sheetId: getShoppingSheetId() });
});

// POST /api/shopping/sheet-settings { sheetId } -> just saves it (accepts a
// full Sheets URL or a bare ID either way), without syncing. Lets Settings
// configure the sheet up front, separately from actually running a sync.
router.post('/sheet-settings', (req, res) => {
  const sheetId = extractSheetId(req.body.sheetId);
  setShoppingSheetId(sheetId);
  res.json({ sheetId });
});

// POST /api/shopping/sync-sheet  { sheetId? } -> two-way merge with that
// spreadsheet's "FamilyHub" tab: a row typed there with no recognized id
// becomes a new local item (matched to an existing still-needed item by
// name first, so syncing a sheet that already has the same items typed in
// doesn't create duplicates); a still-needed local item with no row yet
// gets appended as one. Never deletes or clears anything on either side -
// existing rows and existing items are only ever added to, and a row
// already linked to an item that's since been checked off or deleted is
// just left alone, not removed. sheetId is optional if one's already
// saved; when given, it's saved for next time too (accepts a full Sheets
// URL or a bare ID either way).
router.post('/sync-sheet', async (req, res) => {
  const sheetId = extractSheetId(req.body.sheetId) || getShoppingSheetId();
  if (!sheetId) return res.status(400).json({ error: 'A Google Sheet ID or URL is required' });
  if (req.body.sheetId) setShoppingSheetId(sheetId);

  try {
    const sheetRows = await readShoppingSheetRows(sheetId);
    const allItems = db.prepare('SELECT * FROM shopping_items ORDER BY sort_order ASC, id ASC').all();
    const { toInsert, idUpdatesForExisting, linkedIds } = planShoppingSheetLinks(sheetRows, allItems);

    const idUpdates = [...idUpdatesForExisting];
    for (const row of toInsert) {
      const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM shopping_items').get().m;
      const info = db.prepare('INSERT INTO shopping_items (name, sort_order) VALUES (?, ?)').run(row.name, maxOrder + 1);
      linkedIds.add(info.lastInsertRowid);
      idUpdates.push({ rowNumber: row.rowNumber, id: info.lastInsertRowid });
    }

    const stillNeeded = allItems.filter((i) => !i.checked);
    const newRows = stillNeeded
      .filter((i) => !linkedIds.has(i.id) && i.name && i.name.trim())
      .map((i) => ({ name: i.name, id: i.id }));

    await writeShoppingSheetUpdates(sheetId, { idUpdates, newRows });
    res.json({ success: true, imported: toInsert.length, pushed: newRows.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
