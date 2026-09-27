import { getFamilyPhotoAlbums } from './appConfig.js';
import { runFamilyPhotoSync } from '../routes/familyPhotos.js';

// How often the Family Photos albums auto-sync, in minutes - a shared album
// doesn't change often, so this defaults much slower than the shopping list
// sync. The "Sync Now" button in Settings still works any time.
const SYNC_MINUTES = Number(process.env.FAMILY_PHOTO_SYNC_MINUTES) || 60;

let syncing = false;

async function tick() {
  if (syncing) return;
  if (getFamilyPhotoAlbums().length === 0) return;

  syncing = true;
  try {
    await runFamilyPhotoSync();
  } catch (err) {
    console.error(`Family photo auto-sync failed: ${err.message}`);
  } finally {
    syncing = false;
  }
}

// Starts the background timer - call once at server startup.
export function startFamilyPhotoScheduler() {
  setInterval(tick, SYNC_MINUTES * 60 * 1000);
  // Also run once shortly after startup, same rationale as the shopping
  // list scheduler - a restart shouldn't wait a full interval to catch up.
  setTimeout(tick, 20000);
}
