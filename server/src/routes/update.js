import { Router } from 'express';
import { execSync, spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..', '..', '..');
const statusPath = path.join(__dirname, '..', '..', 'data', 'update-status.json');
const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'self-update.mjs');

const ACTIVE_STATUSES = new Set(['starting', 'pulling', 'installing', 'building', 'restarting']);

const router = Router();

function readStatus() {
  try {
    return JSON.parse(fs.readFileSync(statusPath, 'utf8'));
  } catch {
    return { status: 'idle' };
  }
}

function writeStatus(status, extra = {}) {
  fs.mkdirSync(path.dirname(statusPath), { recursive: true });
  fs.writeFileSync(
    statusPath,
    JSON.stringify({ status, updated_at: new Date().toISOString(), ...extra }, null, 2)
  );
}

// A read-only preview - fetches from origin and compares HEADs without
// touching the working tree, so it's safe to call anytime (e.g. just to
// badge a "Check for updates" button) independent of actually running one.
router.get('/check', (req, res) => {
  try {
    execSync('git fetch', { cwd: repoRoot, stdio: 'pipe' });
    const local = execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
    const remote = execSync('git rev-parse @{u}', { cwd: repoRoot, encoding: 'utf8' }).trim();
    const commitsBehind =
      local === remote
        ? 0
        : Number(execSync(`git rev-list --count ${local}..${remote}`, { cwd: repoRoot, encoding: 'utf8' }).trim());
    res.json({ upToDate: commitsBehind === 0, commitsBehind });
  } catch (err) {
    res.status(502).json({ error: `Could not check for updates: ${err.message}` });
  }
});

router.get('/status', (req, res) => {
  res.json(readStatus());
});

// Kicks off server/scripts/self-update.mjs as a fully detached process (its
// own process group, stdio ignored) so it survives this very server being
// killed partway through - see that script for the actual step-by-step
// ordering and why. Responds immediately; progress is polled from
// GET /status, which reads the same status file the script writes to.
router.post('/run', (req, res) => {
  const current = readStatus();
  if (ACTIVE_STATUSES.has(current.status)) {
    return res.status(409).json({ error: 'An update is already in progress.' });
  }

  writeStatus('starting');

  const child = spawn(
    process.execPath,
    [scriptPath, String(process.pid), process.env.UPDATE_RESTART_CMD || ''],
    { cwd: repoRoot, detached: true, stdio: 'ignore' }
  );
  child.unref();

  res.json({ started: true });
});

export default router;
