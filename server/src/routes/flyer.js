import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { createWorker } from 'tesseract.js';
import { parseFlyerText } from '../lib/ocrParse.js';
import { uploadsDir } from '../lib/paths.js';

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

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// POST /api/flyer/scan  (multipart form field "photo") -> OCR + parsed date/time/location suggestions.
// The uploaded image is kept on disk; its relative path is returned so it can be attached
// to the event once the person confirms/edits the parsed details.
router.post('/scan', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'photo file is required' });

  const photo_path = `/uploads/${req.file.filename}`;

  try {
    // tesseract.js internally does `throw Error(...)` on a worker-level failure
    // (e.g. a network hiccup downloading its language data) whenever no
    // errorHandler is supplied — that throw happens outside this try/catch's
    // promise chain and would otherwise crash the entire server process, not
    // just this request. Supplying one (even a no-op) keeps it out of that path.
    // Separately, tesseract.js v5's own internal load chain swallows that same
    // failure (`.catch(() => {})` with nothing re-thrown/resolved), so
    // `createWorker()` can hang forever instead of ever rejecting — wrap it in
    // a timeout so a flaky network fails the request instead of hanging it.
    let workerError = null;
    const worker = await withTimeout(
      createWorker('eng', 1, {
        errorHandler: (err) => {
          workerError = err;
        },
      }),
      30000,
      'Timed out starting the OCR engine — check the server has internet access to download its language data.'
    );
    if (workerError) throw new Error(typeof workerError === 'string' ? workerError : JSON.stringify(workerError));

    const { data } = await withTimeout(worker.recognize(req.file.path), 30000, 'Timed out reading the photo.');
    await worker.terminate();

    const parsed = parseFlyerText(data.text || '');
    res.json({ ...parsed, photo_path });
  } catch (err) {
    res.status(500).json({ error: `OCR failed: ${err.message}`, photo_path });
  }
});

export default router;
