import { getMealPlanPhotoSettings } from './appConfig.js';
import { runMealPlanPhotoSync } from '../routes/mealPlanPhotos.js';

// How often the meal-plan Drive folder auto-syncs, in minutes - a shared
// folder doesn't change often (once a week, typically), so this defaults the
// same as Family Photos. The "Sync Now" button in Settings still works any time.
const SYNC_MINUTES = Number(process.env.MEAL_PLAN_PHOTO_SYNC_MINUTES) || 60;

let syncing = false;

async function tick() {
  if (syncing) return;
  if (!getMealPlanPhotoSettings().folderId) return;

  syncing = true;
  try {
    await runMealPlanPhotoSync();
  } catch (err) {
    console.error(`Meal plan photo auto-sync failed: ${err.message}`);
  } finally {
    syncing = false;
  }
}

// Starts the background timer - call once at server startup.
export function startMealPlanPhotoScheduler() {
  setInterval(tick, SYNC_MINUTES * 60 * 1000);
  // Also run once shortly after startup, same rationale as the other
  // schedulers - a restart shouldn't wait a full interval to catch up.
  setTimeout(tick, 20000);
}
