import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(__dirname, '..', '..');

// Same rationale as DB_PATH in db.js: lets flyer photos live outside the repo
// checkout so they survive a fresh clone/rebuild. Defaults to server/uploads/,
// which is gitignored (safe from `git pull` on an existing checkout either way).
export const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(serverRoot, 'uploads');
