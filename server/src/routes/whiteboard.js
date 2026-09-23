import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { uploadsDir } from '../lib/paths.js';
import { getSetting, setSetting } from '../lib/settings.js';

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const router = Router();

// A single shared board (no history/archive, no multiple pages - see FamilyHub's feature
// notes for those as possible future additions). Every device polls GET and reloads the
// image whenever image_path changes, which is how a message drawn on one screen shows up
// on the others without needing a live stroke-by-stroke sync channel.
router.get('/', (req, res) => {
  res.json({
    image_path: getSetting('whiteboard_image_path') || null,
    updated_at: getSetting('whiteboard_updated_at') || null,
  });
});

router.post('/', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'image file is required' });

  const filename = `whiteboard-${Date.now()}.png`;
  fs.writeFileSync(path.join(uploadsDir, filename), req.file.buffer);

  // Only one board image is ever kept - remove the previous one so redraws
  // don't quietly fill the disk with a new file every time someone saves.
  const previous = getSetting('whiteboard_image_path');
  if (previous) {
    fs.unlink(path.join(uploadsDir, path.basename(previous)), () => {});
  }

  const image_path = `/uploads/${filename}`;
  const updated_at = new Date().toISOString();
  setSetting('whiteboard_image_path', image_path);
  setSetting('whiteboard_updated_at', updated_at);
  res.json({ image_path, updated_at });
});

export default router;
