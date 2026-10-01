import { Router } from 'express';
import fs from 'node:fs';
import crypto from 'node:crypto';
import heicConvert from 'heic-convert';
import db from '../db.js';
import { uploadsDir } from '../lib/paths.js';
import { getFamilyPhotoFolders, setFamilyPhotoFolders } from '../lib/appConfig.js';
import { getDriveFolderName, listDriveFolderPhotos, downloadDriveFile, extensionForMimeType } from './google.js';
import { singleFlight } from '../lib/singleFlight.js';

const router = Router();

const photosDir = `${uploadsDir}/family-photos`;
if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });

const HEIC_MIME_TYPES = new Set(['image/heic', 'image/heif']);

// HEIC/HEIF (the default photo format on newer iPhones) doesn't preview in
// most non-Safari browsers, including the Chromium a Pi kiosk typically
// runs - convert to JPEG at download time so every synced photo actually
// displays. If a particular file fails to decode (an unusual HEIC variant),
// it's kept in its original format rather than dropped - it just might not
// preview everywhere, same as before this existed.
async function normalizeForDisplay(buffer, mimeType) {
  if (!HEIC_MIME_TYPES.has(mimeType)) return { buffer, mimeType };
  try {
    const jpegBuffer = await heicConvert({ buffer, format: 'JPEG', quality: 0.9 });
    return { buffer: Buffer.from(jpegBuffer), mimeType: 'image/jpeg' };
  } catch (err) {
    console.error(`HEIC-to-JPEG conversion failed, keeping original format: ${err.message}`);
    return { buffer, mimeType };
  }
}

// Accepts either a bare Drive folder ID or a full Drive folder URL
// (drive.google.com/drive/folders/<ID>, with or without a /u/0/ account
// segment or a trailing ?usp=sharing) and returns just the ID - pasting the
// URL straight out of the browser's address bar should just work.
function extractFolderId(input) {
  const trimmed = (input || '').trim();
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : trimmed;
}

function rowToPhoto(row) {
  return {
    id: row.id,
    url: `/uploads/family-photos/${row.filename}`,
    caption: row.caption,
    takenAt: row.taken_at,
    albumLabel: row.album_label,
  };
}

// The actual sync, factored out of the route handler so the background
// scheduler (see lib/familyPhotoScheduler.js) can run it on a timer without
// going through HTTP. Syncs every configured folder (one bad/unreachable
// folder doesn't stop the others - each gets its own try/catch and shows up
// in the returned per-folder results). Downloads any photo not already
// synced from ANY folder (matched by Drive's own file id, so the same photo
// shared into two folders is only ever stored once) into
// uploads/family-photos/, and records it in the family_photos table. Never
// removes a previously-synced photo, even one no longer in its folder - see
// the family_photos table comment in db.js.
export const runFamilyPhotoSync = singleFlight(async () => {
  const folders = getFamilyPhotoFolders();
  if (folders.length === 0) return { success: true, added: 0, total: 0, folders: [] };

  const existingGuids = new Set(
    db.prepare('SELECT guid FROM family_photos').all().map((r) => r.guid)
  );

  let added = 0;
  let total = 0;
  const perFolder = [];

  for (const folderId of folders) {
    try {
      const [folderName, photos] = await Promise.all([
        getDriveFolderName(folderId).catch(() => null),
        listDriveFolderPhotos(folderId),
      ]);
      total += photos.length;
      let addedForFolder = 0;

      for (const photo of photos) {
        if (existingGuids.has(photo.id)) continue;

        const rawBuffer = await downloadDriveFile(photo.id).catch(() => null);
        if (!rawBuffer) continue; // one bad file shouldn't fail the whole sync
        const { buffer, mimeType } = await normalizeForDisplay(rawBuffer, photo.mimeType);
        const filename = `${crypto.randomUUID()}.${extensionForMimeType(mimeType)}`;
        fs.writeFileSync(`${photosDir}/${filename}`, buffer);

        db.prepare(
          'INSERT INTO family_photos (guid, filename, caption, taken_at, album_url, album_label) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(photo.id, filename, photo.name, photo.takenAt, folderId, folderName);
        existingGuids.add(photo.id);
        addedForFolder++;
        added++;
      }

      perFolder.push({ folderId, label: folderName, added: addedForFolder, success: true });
    } catch (err) {
      perFolder.push({ folderId, added: 0, success: false, error: err.message });
    }
  }

  return { success: true, added, total, folders: perFolder };
});

// GET /api/family-photos -> every synced photo, for the Settings gallery and
// the screensaver's family-photos overlay.
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM family_photos ORDER BY taken_at DESC, id DESC').all();
  res.json({ photos: rows.map(rowToPhoto) });
});

// GET/POST /api/family-photos/settings -> the saved list of Drive folders,
// same prefill-then-save pattern as the shared calendar feeds list.
router.get('/settings', (req, res) => {
  res.json({ folders: getFamilyPhotoFolders() });
});

router.post('/settings', (req, res) => {
  const folders = (req.body.folders || []).map(extractFolderId);
  setFamilyPhotoFolders(folders);
  res.json({ folders: getFamilyPhotoFolders() });
});

// POST /api/family-photos/sync -> runs a sync right now, for the "Sync Now"
// button - the same sync also runs automatically on a timer (see
// lib/familyPhotoScheduler.js), so this is only needed to pull in a
// just-added photo without waiting.
router.post('/sync', async (req, res) => {
  if (getFamilyPhotoFolders().length === 0) {
    return res.status(400).json({ error: 'Add at least one Drive folder first' });
  }
  try {
    const result = await runFamilyPhotoSync();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/family-photos/:id -> removes just FamilyHub's local copy (not
// anything in the actual Drive folder) - for dropping a photo nobody wants
// cycling on the screensaver without having to remove it from the shared
// folder for everyone else too.
router.delete('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM family_photos WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  db.prepare('DELETE FROM family_photos WHERE id = ?').run(req.params.id);
  fs.rm(`${photosDir}/${row.filename}`, () => {}); // best-effort; a missing file is fine
  res.status(204).end();
});

export default router;
