import { getShoppingSheetId } from './appConfig.js';
import { runShoppingSheetSync } from '../routes/shopping.js';

// How often the shopping list auto-syncs with its Google Sheet, in minutes -
// the "Sync with Sheet" button on the page still exists for pulling in a
// just-added item right away without waiting for the next tick.
const SYNC_MINUTES = Number(process.env.SHOPPING_SHEET_SYNC_MINUTES) || 5;

let syncing = false;

async function tick() {
  // Skip a still-running sync instead of piling another one on top of it
  // (a slow Sheets API response, not a normal case) - the next tick picks
  // up wherever it left off either way.
  if (syncing) return;
  const sheetId = getShoppingSheetId();
  if (!sheetId) return;

  syncing = true;
  try {
    await runShoppingSheetSync(sheetId);
  } catch (err) {
    console.error(`Shopping list sheet auto-sync failed: ${err.message}`);
  } finally {
    syncing = false;
  }
}

// Starts the background timer - call once at server startup. Nothing to
// clean up on shutdown since the process is exiting anyway.
export function startShoppingSheetScheduler() {
  setInterval(tick, SYNC_MINUTES * 60 * 1000);
  // Also run once shortly after startup, so a restart doesn't wait a full
  // interval before picking up whatever changed while the server was down.
  setTimeout(tick, 15000);
}
