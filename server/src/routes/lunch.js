import { Router } from 'express';
import db, { withTransaction } from '../db.js';
import { fetchMenuItems } from '../lib/menuImport.js';
import { getMenuImportUrl, setMenuImportUrl } from '../lib/appConfig.js';
import { addDays, parseDateOnly, toISODate } from '../lib/week.js';

const router = Router();

const MAX_RANGE_DAYS = 400;

function isWeekend(dateStr) {
  const day = parseDateOnly(dateStr).getDay();
  return day === 0 || day === 6;
}

// Weekends default to "no school" since there's usually no lunch to pack;
// still editable per-day for the rare weekend school event.
const insertDefaultDay = db.prepare(
  "INSERT OR IGNORE INTO lunch_days (date, status, no_school, menu_item) VALUES (?, 'home', ?, '')"
);

function ensureDay(date) {
  insertDefaultDay.run(date, isWeekend(date) ? 1 : 0);
  return db.prepare('SELECT * FROM lunch_days WHERE date = ?').get(date);
}

// GET /api/lunch?start=YYYY-MM-DD&end=YYYY-MM-DD (end exclusive) -> one row per date,
// auto-creating any missing days in the range with sensible defaults.
router.get('/', (req, res) => {
  const { start, end } = req.query;
  if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return res.status(400).json({ error: 'start and end are required as YYYY-MM-DD' });
  }

  // Dates are stepped in local time - converting through toISOString() would
  // shift every date back a day on a server east of UTC.
  const dates = [];
  for (let d = parseDateOnly(start); dates.length < MAX_RANGE_DAYS; d = addDays(d, 1)) {
    const key = toISODate(d);
    if (key >= end) break;
    dates.push(key);
  }
  if (dates.length === 0) return res.json({ days: [] });

  const select = () =>
    db.prepare('SELECT * FROM lunch_days WHERE date >= ? AND date <= ? ORDER BY date ASC').all(dates[0], dates[dates.length - 1]);
  let rows = select();
  if (rows.length < dates.length) {
    const existing = new Set(rows.map((r) => r.date));
    withTransaction(() => {
      for (const date of dates) {
        if (!existing.has(date)) insertDefaultDay.run(date, isWeekend(date) ? 1 : 0);
      }
    });
    rows = select();
  }

  res.json({ days: rows.map((d) => ({ ...d, no_school: !!d.no_school })) });
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
  const setMenu = db.prepare('UPDATE lunch_days SET menu_item = ? WHERE date = ?');
  withTransaction(() => {
    for (const item of result.items) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date) || !item.entree) continue;
      insertDefaultDay.run(item.date, isWeekend(item.date) ? 1 : 0);
      setMenu.run(item.entree, item.date);
      imported += 1;
    }
  });

  res.json({ success: true, imported, daysFound: result.daysFound });
});

export default router;
