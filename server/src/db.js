import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'familyhub.sqlite3'));
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
  source TEXT NOT NULL DEFAULT 'local', -- local | google
  google_event_id TEXT,
  photo_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start TEXT NOT NULL,
  day_of_week INTEGER NOT NULL, -- 0-6 Mon-Sun (fixed slot position)
  name TEXT NOT NULL DEFAULT '',
  UNIQUE(week_start, day_of_week)
);

CREATE TABLE IF NOT EXISTS lunch (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start TEXT NOT NULL,
  day_of_week INTEGER NOT NULL, -- 0-4 Mon-Fri
  status TEXT NOT NULL DEFAULT 'home', -- 'school' | 'home'
  UNIQUE(week_start, day_of_week)
);

CREATE TABLE IF NOT EXISTS shopping_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  checked INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);

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
