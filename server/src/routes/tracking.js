import { Router } from 'express';
import db from '../db.js';
import { parseDateOnly, addDays, toISODate } from '../lib/week.js';

const router = Router();

const DEFAULT_LOOKBACK_DAYS = 60;

// Both endpoints below only ever report on days that have already fully
// passed - a day still in progress isn't "missed" yet, so today itself (and
// anything after it, which can briefly exist for chores: see note below) is
// left out rather than counted as a no.
function lookbackRange(req) {
  const days = Number(req.query.days) || DEFAULT_LOOKBACK_DAYS;
  const today = toISODate(new Date());
  const start = toISODate(addDays(new Date(), -days));
  return { start, end: today };
}

// Settings > Chore & Checklist Tracking - a plain yes/no history of whether
// each recurring chore/checklist item got done on the day it was expected,
// for the one simple question a parent actually wants answered day to day.
// Only template-backed (recurring) instances have a real "expected day" to
// check against; one-off items added straight from a widget's "Add a
// one-time..." box aren't part of any schedule, so there's nothing to track.
router.get('/chores', (req, res) => {
  const { start, end } = lookbackRange(req);
  const templates = db
    .prepare('SELECT id, title FROM chore_templates WHERE active = 1 ORDER BY sort_order ASC, id ASC')
    .all();

  const rows = db
    .prepare(
      `SELECT template_id, title, week_start, day_of_week, done FROM chores
       WHERE template_id IS NOT NULL AND day_of_week IS NOT NULL`
    )
    .all();

  const byTemplate = new Map();
  for (const r of rows) {
    // Chore weeks run Sunday-based with day_of_week 0=Mon..6=Sun (see
    // routes/chores.js) - the row's actual calendar date is its week_start
    // plus that day's offset from that Sunday.
    const date = toISODate(addDays(parseDateOnly(r.week_start), (r.day_of_week + 1) % 7));
    // The current week's not-yet-arrived days are already generated ahead of
    // time (see ensureWeekChores) so they exist as "not done" before they've
    // even happened - excluded by the end-of-range check below, same as the
    // explicit "today onward" exclusion for daily tasks.
    if (date < start || date >= end) continue;
    if (!byTemplate.has(r.template_id)) byTemplate.set(r.template_id, []);
    byTemplate.get(r.template_id).push({ date, done: !!r.done });
  }

  const result = templates.map((t) => {
    const entries = (byTemplate.get(t.id) || []).sort((a, b) => (a.date < b.date ? 1 : -1));
    return { template_id: t.id, title: t.title, entries };
  });
  res.json({ items: result });
});

router.get('/daily-tasks', (req, res) => {
  const { start, end } = lookbackRange(req);
  const templates = db
    .prepare('SELECT id, title FROM daily_task_templates WHERE active = 1 ORDER BY sort_order ASC, id ASC')
    .all();

  const rows = db
    .prepare(
      `SELECT template_id, title, date, done FROM daily_tasks
       WHERE template_id IS NOT NULL AND date >= ? AND date < ?
       ORDER BY date DESC`
    )
    .all(start, end);

  const byTemplate = new Map();
  for (const r of rows) {
    if (!byTemplate.has(r.template_id)) byTemplate.set(r.template_id, []);
    byTemplate.get(r.template_id).push({ date: r.date, done: !!r.done });
  }

  const result = templates.map((t) => ({
    template_id: t.id,
    title: t.title,
    entries: byTemplate.get(t.id) || [],
  }));
  res.json({ items: result });
});

export default router;
