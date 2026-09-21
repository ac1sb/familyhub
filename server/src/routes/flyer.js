import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createWorker } from 'tesseract.js';
import { parseFlyerText } from '../lib/ocrParse.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `flyer-${Date.now()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

const router = Router();

// POST /api/flyer/scan  (multipart form field "photo") -> OCR + parsed date/time/location suggestions.
// The uploaded image is kept on disk; its relative path is returned so it can be attached
// to the event once the person confirms/edits the parsed details.
router.post('/scan', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'photo file is required' });

  const photo_path = `/uploads/${req.file.filename}`;

  try {
    const worker = await createWorker('eng');
    const { data } = await worker.recognize(req.file.path);
    await worker.terminate();

    const parsed = parseFlyerText(data.text || '');
    res.json({ ...parsed, photo_path });
  } catch (err) {
    res.status(500).json({ error: `OCR failed: ${err.message}`, photo_path });
  }
});

export default router;
