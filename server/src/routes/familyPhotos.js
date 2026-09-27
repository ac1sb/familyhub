import { Router } from 'express';
import fs from 'node:fs';
import crypto from 'node:crypto';
import db from '../db.js';
import { uploadsDir } from '../lib/paths.js';
import { getFamilyPhotoAlbums, setFamilyPhotoAlbums } from '../lib/appConfig.js';
import { listSharedAlbumPhotos } from '../lib/icloudSharedAlbum.js';

const router = Router();

const photosDir = `${uploadsDir}/family-photos`;
if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });

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
// going through HTTP. Syncs every configured album (one bad/unreachable
// album doesn't stop the others - each gets its own try/catch and shows up
// in the returned per-album results). Downloads any photo not already
// synced from ANY album (matched by Apple's own guid, so the same photo
// shared into two albums is only ever stored once) into
// uploads/family-photos/, and records it in the family_photos table. Never
// removes a previously-synced photo, even one no longer in its album - see
// the family_photos table comment in db.js.
export async function runFamilyPhotoSync() {
  const albums = getFamilyPhotoAlbums();
  if (albums.length === 0) return { success: true, added: 0, total: 0, albums: [] };

  const existingGuids = new Set(
    db.prepare('SELECT guid FROM family_photos').all().map((r) => r.guid)
  );

  let added = 0;
  let total = 0;
  const perAlbum = [];

  for (const albumUrl of albums) {
    try {
      const { streamName, photos } = await listSharedAlbumPhotos(albumUrl);
      total += photos.length;
      let addedForAlbum = 0;

      for (const photo of photos) {
        if (existingGuids.has(photo.guid)) continue;

        const resp = await fetch(photo.url);
        if (!resp.ok) continue; // one bad asset URL shouldn't fail the whole sync
        const buffer = Buffer.from(await resp.arrayBuffer());
        const ext = resp.headers.get('content-type')?.includes('png') ? 'png' : 'jpg';
        const filename = `${crypto.randomUUID()}.${ext}`;
        fs.writeFileSync(`${photosDir}/${filename}`, buffer);

        db.prepare(
          'INSERT INTO family_photos (guid, filename, caption, taken_at, album_url, album_label) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(photo.guid, filename, photo.caption, photo.takenAt, albumUrl, streamName);
        existingGuids.add(photo.guid);
        addedForAlbum++;
        added++;
      }

      perAlbum.push({ albumUrl, label: streamName, added: addedForAlbum, success: true });
    } catch (err) {
      perAlbum.push({ albumUrl, added: 0, success: false, error: err.message });
    }
  }

  return { success: true, added, total, albums: perAlbum };
}

// GET /api/family-photos -> every synced photo, for the Settings gallery and
// the screensaver/background "Family Photos" theme.
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM family_photos ORDER BY taken_at DESC, id DESC').all();
  res.json({ photos: rows.map(rowToPhoto) });
});

// GET/POST /api/family-photos/settings -> the saved list of album links,
// same prefill-then-save pattern as the shared calendar feeds list.
router.get('/settings', (req, res) => {
  res.json({ albums: getFamilyPhotoAlbums() });
});

router.post('/settings', (req, res) => {
  setFamilyPhotoAlbums(req.body.albums);
  res.json({ albums: getFamilyPhotoAlbums() });
});

// POST /api/family-photos/sync -> runs a sync right now, for the "Sync Now"
// button - the same sync also runs automatically on a timer (see
// lib/familyPhotoScheduler.js), so this is only needed to pull in a
// just-added photo without waiting.
router.post('/sync', async (req, res) => {
  if (getFamilyPhotoAlbums().length === 0) {
    return res.status(400).json({ error: 'Add at least one Shared Album link first' });
  }
  try {
    const result = await runFamilyPhotoSync();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/family-photos/:id -> removes just FamilyHub's local copy (not
// anything in the actual iCloud album) - for dropping a photo nobody wants
// cycling on the screensaver without having to remove it from the shared
// album for everyone else too.
router.delete('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM family_photos WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  db.prepare('DELETE FROM family_photos WHERE id = ?').run(req.params.id);
  fs.rm(`${photosDir}/${row.filename}`, () => {}); // best-effort; a missing file is fine
  res.status(204).end();
});

export default router;
