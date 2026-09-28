import { Router } from 'express';
import { createWorker } from 'tesseract.js';
import db from '../db.js';
import { uploadsDir } from '../lib/paths.js';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { getMealPlanPhotoSettings, setMealPlanPhotoSettings } from '../lib/appConfig.js';
import { getDriveFolderName, listDriveFolderPhotos, downloadDriveFile, extensionForMimeType } from './google.js';
import { parseMealPlanRecipes, extractDeliveryDate } from '../lib/mealPlanOcr.js';
import { startOfWeek, toISODate, addDays } from '../lib/week.js';

const router = Router();

const scratchDir = `${uploadsDir}/meal-plan-scratch`;
if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });

function extractFolderId(input) {
  const trimmed = (input || '').trim();
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : trimmed;
}

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function ocrRecipeWords(filePath) {
  let workerError = null;
  const worker = await withTimeout(
    createWorker('eng', 1, { errorHandler: (err) => { workerError = err; } }),
    30000,
    'Timed out starting the OCR engine'
  );
  if (workerError) throw new Error(typeof workerError === 'string' ? workerError : JSON.stringify(workerError));
  const { data } = await withTimeout(worker.recognize(filePath), 30000, 'Timed out reading the photo');
  await worker.terminate();
  return data.words || [];
}

function mealSlot(date) {
  return { weekStart: toISODate(startOfWeek(date)), dayOfWeek: (date.getDay() + 6) % 7 };
}

function isSlotEmpty(date) {
  const { weekStart, dayOfWeek } = mealSlot(date);
  const row = db.prepare('SELECT name FROM meals WHERE week_start = ? AND day_of_week = ?').get(weekStart, dayOfWeek);
  return !row || !row.name.trim();
}

// A safety bound on how far ahead to look for an empty day, so a bug (or
// some unforeseen state) can never turn this into a true infinite loop.
const MAX_LOOKAHEAD_DAYS = 120;

// Assigns one date per recipe, walking forward from the day after delivery
// and skipping both the configured day of the week and any day that already
// has a meal in it - a manual entry, a previous sync, anything - so this
// never clobbers something already there and always lands on the next real
// gap in the menu instead of a day chosen by arithmetic alone. anchorDate is
// the delivery date read off the photo when OCR found one there (see
// extractDeliveryDate); when it can't find one, the caller falls back to
// today, so a sync that runs the same day a photo is dropped in still starts
// tomorrow same as before.
function nextTargetDates(count, skipDay, anchorDate) {
  const dates = [];
  let cursor = addDays(anchorDate, 1);
  for (let i = 0; dates.length < count && i < MAX_LOOKAHEAD_DAYS; i++) {
    const dow = (cursor.getDay() + 6) % 7; // 0=Mon..6=Sun
    if (dow !== skipDay && isSlotEmpty(cursor)) dates.push(new Date(cursor));
    cursor = addDays(cursor, 1);
  }
  return dates;
}

function applyRecipesToMenu(recipeNames, skipDay, deliveryDate) {
  const dates = nextTargetDates(recipeNames.length, skipDay, deliveryDate || new Date());
  // A row for this slot usually already exists (empty) - meals.js proactively
  // creates one for every day of a week as soon as it's viewed - so this
  // still has to be an upsert, not a plain insert. isSlotEmpty() is what
  // actually guarantees a real meal never gets overwritten, not this.
  const upsert = db.prepare(
    'INSERT INTO meals (week_start, day_of_week, name) VALUES (?, ?, ?) ON CONFLICT(week_start, day_of_week) DO UPDATE SET name = excluded.name'
  );
  const appliedDates = [];
  dates.forEach((date, i) => {
    const { weekStart, dayOfWeek } = mealSlot(date);
    upsert.run(weekStart, dayOfWeek, recipeNames[i]);
    appliedDates.push(toISODate(date));
  });
  return appliedDates;
}

// The actual sync, factored out so the background scheduler can run it on a
// timer without going through HTTP - same shape as Family Photos' sync.
// Downloads and OCRs any photo in the folder not already processed (matched
// by Drive's own file id), and writes whatever recipes it finds straight
// onto the upcoming Dinner Menu - there is no review step, so a misread
// photo (or an unrelated one saved to the same folder) can land on the menu
// unreviewed; that trade was made deliberately in exchange for zero taps.
export async function runMealPlanPhotoSync() {
  const { folderId, skipDay } = getMealPlanPhotoSettings();
  if (!folderId) return { success: true, added: 0, total: 0 };

  const existingGuids = new Set(db.prepare('SELECT guid FROM meal_plan_syncs').all().map((r) => r.guid));
  const [, photos] = await Promise.all([
    getDriveFolderName(folderId).catch(() => null),
    listDriveFolderPhotos(folderId),
  ]);

  let added = 0;
  const results = [];

  for (const photo of photos) {
    if (existingGuids.has(photo.id)) continue;

    const scratchPath = `${scratchDir}/${crypto.randomUUID()}.${extensionForMimeType(photo.mimeType)}`;
    try {
      const buffer = await downloadDriveFile(photo.id);
      fs.writeFileSync(scratchPath, buffer);

      const words = await ocrRecipeWords(scratchPath);
      const recipes = parseMealPlanRecipes(words);
      const deliveryDate = extractDeliveryDate(words);

      let appliedDates = [];
      if (recipes.length > 0) {
        appliedDates = applyRecipesToMenu(recipes, skipDay, deliveryDate);
        added++;
      }

      db.prepare(
        'INSERT INTO meal_plan_syncs (guid, recipe_names, applied_dates) VALUES (?, ?, ?)'
      ).run(photo.id, JSON.stringify(recipes), JSON.stringify(appliedDates));
      existingGuids.add(photo.id);
      results.push({ name: photo.name, recipes, appliedDates });
    } catch (err) {
      results.push({ name: photo.name, error: err.message });
    } finally {
      fs.rm(scratchPath, () => {}); // best-effort - the photo itself isn't kept, only what OCR found
    }
  }

  return { success: true, added, total: photos.length, results };
}

// GET /api/meal-plan-photos/settings -> the saved Drive folder + skip day,
// same shape as the other Drive-folder settings.
router.get('/settings', (req, res) => {
  res.json(getMealPlanPhotoSettings());
});

router.post('/settings', (req, res) => {
  const folderId = req.body.folderId !== undefined ? extractFolderId(req.body.folderId) : undefined;
  res.json(setMealPlanPhotoSettings({ folderId, skipDay: req.body.skipDay }));
});

// GET /api/meal-plan-photos -> recent sync history, so Settings can show
// what the last few photos actually produced.
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM meal_plan_syncs ORDER BY id DESC LIMIT 10').all();
  res.json({
    syncs: rows.map((r) => ({
      id: r.id,
      recipeNames: JSON.parse(r.recipe_names),
      appliedDates: JSON.parse(r.applied_dates),
      syncedAt: r.synced_at,
    })),
  });
});

// POST /api/meal-plan-photos/sync -> runs a sync right now, for a "Sync Now"
// button - the same sync also runs automatically on a timer (see
// lib/mealPlanPhotoScheduler.js).
router.post('/sync', async (req, res) => {
  if (!getMealPlanPhotoSettings().folderId) {
    return res.status(400).json({ error: 'Add a Drive folder first' });
  }
  try {
    res.json(await runMealPlanPhotoSync());
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
