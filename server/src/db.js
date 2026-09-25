import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// DB_PATH lets the database file live outside the repo checkout entirely
// (e.g. DB_PATH=/home/pi/familyhub-data/familyhub.sqlite3) so it survives a
// fresh `git clone` or a rebuild untouched. Without it, the file lives in
// server/data/, which is gitignored - safe from `git pull` on an existing
// checkout, but a brand new clone naturally starts with no data folder at all.
const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '..', 'data', 'familyhub.sqlite3');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  location TEXT DEFAULT '',
  member TEXT NOT NULL DEFAULT 'family', -- member_1 | member_2 | member_3 | family
  start_datetime TEXT NOT NULL, -- ISO 8601
  end_datetime TEXT,
  all_day INTEGER NOT NULL DEFAULT 0,
  recurring INTEGER NOT NULL DEFAULT 0,
  recurrence_days TEXT DEFAULT '[]', -- JSON array of 0-6 (Mon=0)
  is_reminder INTEGER NOT NULL DEFAULT 0, -- show as a big banner on the dashboard the day it's due
  source TEXT NOT NULL DEFAULT 'local', -- local | google
  google_event_id TEXT,
  photo_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chore_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  assigned_to TEXT NOT NULL DEFAULT 'family',
  active INTEGER NOT NULL DEFAULT 1,
  days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]', -- JSON array of 0-6 (Mon=0); which days it recurs on
  icon TEXT, -- manually-picked Squares-mode icon; NULL = guess one from the title
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  assigned_to TEXT NOT NULL DEFAULT 'family',
  recurring INTEGER NOT NULL DEFAULT 1,
  day_of_week INTEGER, -- 0-6 Mon-Sun, NULL = any day this week
  done INTEGER NOT NULL DEFAULT 0,
  week_start TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  template_id INTEGER REFERENCES chore_templates(id), -- set when auto-generated from a recurring template
  icon TEXT, -- copied from the template at generation time, if it had one set
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start TEXT NOT NULL,
  day_of_week INTEGER NOT NULL, -- 0-6 Mon-Sun (fixed slot position)
  name TEXT NOT NULL DEFAULT '',
  UNIQUE(week_start, day_of_week)
);

-- Superseded by lunch_days below (monthly calendar instead of a fixed Mon-Fri
-- week); kept as-is rather than dropped so nothing errors on an older DB file.
CREATE TABLE IF NOT EXISTS lunch (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start TEXT NOT NULL,
  day_of_week INTEGER NOT NULL, -- 0-4 Mon-Fri
  status TEXT NOT NULL DEFAULT 'home', -- 'school' | 'home'
  UNIQUE(week_start, day_of_week)
);

CREATE TABLE IF NOT EXISTS lunch_days (
  date TEXT PRIMARY KEY, -- YYYY-MM-DD
  status TEXT NOT NULL DEFAULT 'home', -- 'school' | 'home'
  no_school INTEGER NOT NULL DEFAULT 0,
  menu_item TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS daily_task_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  assigned_to TEXT NOT NULL DEFAULT 'family',
  active INTEGER NOT NULL DEFAULT 1,
  days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]', -- JSON array of 0-6 (Mon=0); which days it applies
  icon TEXT, -- manually-picked Squares-mode icon; NULL = guess one from the title
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Daily routine items (empty lunch box, practice clarinet, ...) - same
-- template/instance split as chores, but reset every DAY instead of every
-- week: bucketed by date rather than week_start.
CREATE TABLE IF NOT EXISTS daily_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  assigned_to TEXT NOT NULL DEFAULT 'family',
  done INTEGER NOT NULL DEFAULT 0,
  date TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  template_id INTEGER REFERENCES daily_task_templates(id),
  icon TEXT, -- copied from the template at generation time, if it had one set
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shopping_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  checked INTEGER NOT NULL DEFAULT 0,
  checked_at TEXT, -- when it was crossed off (assumed purchased); cleared if un-crossed
  sort_order INTEGER NOT NULL DEFAULT 0,
  image_path TEXT, -- set for a handwritten (ink) item instead of/alongside a typed name
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Smart-home devices (Lutron Caseta / LIFX). A 'lifx' device with an
-- external_id set is wired to a real bulb (see routes/smartDevices.js) -
-- toggling/dimming/coloring it calls the LIFX Cloud API, and the local row
-- is only updated once that call succeeds. Everything else (no external_id,
-- or platform 'caseta' - there's no real Lutron integration yet) stays the
-- original mock behavior: rows toggled straight from the dashboard with
-- nothing behind them.
CREATE TABLE IF NOT EXISTS smart_devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  room TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL, -- 'lifx' | 'caseta'
  kind TEXT NOT NULL DEFAULT 'light', -- 'light' (lifx, color) | 'dimmer' (caseta) | 'switch' (caseta)
  dimmable INTEGER NOT NULL DEFAULT 1,
  color_capable INTEGER NOT NULL DEFAULT 0,
  is_on INTEGER NOT NULL DEFAULT 0,
  brightness INTEGER NOT NULL DEFAULT 100, -- 0-100, meaningful only when dimmable
  color TEXT NOT NULL DEFAULT '#ffffff', -- meaningful only when color_capable
  external_id TEXT, -- the real LIFX light's selector (e.g. "id:d073d5..."), null for mock/Caseta devices
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A saved history of past whiteboard messages, one row per time the board
-- was cleared with something drawn on it - "post-it notes" you can look
-- back on, separate from the single current board image in settings.
CREATE TABLE IF NOT EXISTS whiteboard_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// Migration for databases created before chore_templates existed: CREATE TABLE
// IF NOT EXISTS above won't add a column to an already-existing chores table.
try {
  db.exec('ALTER TABLE chores ADD COLUMN template_id INTEGER REFERENCES chore_templates(id)');
} catch {
  // column already exists
}
try {
  db.exec('ALTER TABLE events ADD COLUMN is_reminder INTEGER NOT NULL DEFAULT 0');
} catch {
  // column already exists
}
try {
  db.exec("ALTER TABLE chore_templates ADD COLUMN days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]'");
} catch {
  // column already exists
}
try {
  db.exec('ALTER TABLE shopping_items ADD COLUMN image_path TEXT');
} catch {
  // column already exists
}
try {
  db.exec('ALTER TABLE shopping_items ADD COLUMN checked_at TEXT');
} catch {
  // column already exists
}
for (const table of ['chore_templates', 'chores', 'daily_task_templates', 'daily_tasks']) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN icon TEXT`);
  } catch {
    // column already exists
  }
}
try {
  // Which real LIFX bulb a 'lifx' device is wired to (its selector, e.g.
  // "id:d073d5..."), set when it's added via Discover rather than typed in
  // by hand - null for a manually-added or Caseta device, which stay
  // local-only. See routes/smartDevices.js.
  db.exec('ALTER TABLE smart_devices ADD COLUMN external_id TEXT');
} catch {
  // column already exists
}

// Seed a handful of example smart-home devices once, so the header quick-
// toggle strip and the Smart Home widget have something to show out of the
// box instead of starting empty. Guarded by a settings flag (not just "is
// the table empty") so deliberately deleting all of them later doesn't
// bring them back on the next server restart.
const SMART_DEVICES_SEEDED_KEY = 'smart_devices_seeded';
const alreadySeeded = db.prepare('SELECT value FROM settings WHERE key = ?').get(SMART_DEVICES_SEEDED_KEY);
if (!alreadySeeded) {
  const insertDevice = db.prepare(
    'INSERT INTO smart_devices (name, room, platform, kind, dimmable, color_capable, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  withTransaction(() => {
    insertDevice.run('Dining Room', 'Dining Room', 'caseta', 'dimmer', 1, 0, 0);
    insertDevice.run('Living Room', 'Living Room', 'caseta', 'dimmer', 1, 0, 1);
    insertDevice.run('Lamp', 'Living Room', 'lifx', 'light', 1, 1, 2);
    insertDevice.run('Kitchen Counter', 'Kitchen Counter', 'caseta', 'dimmer', 1, 0, 3);
  });
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
    SMART_DEVICES_SEEDED_KEY,
    '1'
  );
}

// node:sqlite's DatabaseSync has no built-in transaction() helper (unlike better-sqlite3),
// so batch writes (e.g. reordering a whole week of meals) use this instead.
export function withTransaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export default db;
