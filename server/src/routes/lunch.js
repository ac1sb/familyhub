import { Router } from 'express';
import db from '../db.js';
import { fetchMenuItems } from '../lib/menuImport.js';
import { getMenuImportUrl, setMenuImportUrl } from '../lib/appConfig.js';

const router = Router();

function isWeekend(dateStr) {
  const day = new Date(`${dateStr}T00:00:00`).getDay();
  return day === 0 || day === 6;
}

function addDaysStr(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function ensureDay(date) {
  const existing = db.prepare('SELECT * FROM lunch_days WHERE date = ?').get(date);
  if (existing) return existing;
  // Weekends default to "no school" since there's usually no lunch to pack;
  // still editable per-day for the rare weekend school event.
  const no_school = isWeekend(date) ? 1 : 0;
  db.prepare('INSERT INTO lunch_days (date, status, no_school, menu_item) VALUES (?, ?, ?, ?)').run(
    date,
    'home',
    no_school,
    ''
  );
  return db.prepare('SELECT * FROM lunch_days WHERE date = ?').get(date);
}

// GET /api/lunch?start=YYYY-MM-DD&end=YYYY-MM-DD (end exclusive) -> one row per date,
// auto-creating any missing days in the range with sensible defaults.
router.get('/', (req, res) => {
  const { start, end } = req.query;
  if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return res.status(400).json({ error: 'start and end are required as YYYY-MM-DD' });
  }

  const days = [];
  let cursor = start;
  let guard = 0;
  while (cursor < end && guard < 400) {
    days.push(ensureDay(cursor));
    cursor = addDaysStr(cursor, 1);
    guard += 1;
  }

  res.json({ days: days.map((d) => ({ ...d, no_school: !!d.no_school })) });
});

// PUT /api/lunch/:date  { status?, no_school?, menu_item? }
router.put('/:date', (req, res) => {
  const { date } = req.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });

  const existing = ensureDay(date);
  const merged = {
    status: req.body.status !== undefined ? req.body.status : existing.status,
    no_school: req.body.no_school !== undefined ? (req.body.no_school ? 1 : 0) : existing.no_school,
    menu_item: req.body.menu_item !== undefined ? req.body.menu_item : existing.menu_item,
  };
  if (!['school', 'home'].includes(merged.status)) {
    return res.status(400).json({ error: "status must be 'school' or 'home'" });
  }

  db.prepare('UPDATE lunch_days SET status=@status, no_school=@no_school, menu_item=@menu_item WHERE date=@date').run({
    ...merged,
    date,
  });

  const row = db.prepare('SELECT * FROM lunch_days WHERE date = ?').get(date);
  res.json({ ...row, no_school: !!row.no_school });
});

// GET /api/lunch/import-settings -> the saved menu URL, so Settings can prefill it
router.get('/import-settings', (req, res) => {
  res.json({ url: getMenuImportUrl() });
});

// POST /api/lunch/import  { url? } -> fetch + parse the school's online menu and
// fill in menu_item for any matching dates (never touches status/no_school).
// Always returns a diagnostic payload, even on failure, so a first attempt that
// doesn't find anything can be debugged instead of just silently doing nothing.
router.post('/import', async (req, res) => {
  const url = (req.body.url || getMenuImportUrl() || '').trim();
  if (!url) return res.status(400).json({ error: 'No menu URL configured yet.' });
  setMenuImportUrl(url);

  let result;
  try {
    result = await fetchMenuItems(url);
  } catch (err) {
    return res.status(502).json({ success: false, error: `Could not reach the menu site: ${err.message}` });
  }

  if (!result.success) {
    return res.json(result);
  }

  let imported = 0;
  for (const item of result.items) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date) || !item.entree) continue;
    ensureDay(item.date);
    db.prepare('UPDATE lunch_days SET menu_item = ? WHERE date = ?').run(item.entree, item.date);
    imported += 1;
  }

  res.json({ success: true, imported, daysFound: result.daysFound });
});

export default router;
