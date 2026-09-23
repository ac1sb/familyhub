#!/usr/bin/env node
// Runs detached from the server process that spawned it (see
// server/src/routes/update.js), so killing that process partway through
// doesn't also kill this script. Every step's outcome is written to
// update-status.json instead of stdout, since there's no terminal attached
// once the triggering server has restarted - the API reads that same file
// back to answer GET /api/update/status regardless of which process (old
// or new) happens to be alive when it's asked.
//
// Order matters: git pull / npm install / npm run build all happen BEFORE
// anything is killed. If any of those fail, the currently-running server is
// left completely alone - a failed update should never take the display
// offline, only a successful one should.
import { execSync, spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..', '..');
const serverDir = path.join(repoRoot, 'server');
const statusPath = path.join(serverDir, 'data', 'update-status.json');

const [, , oldPidArg, restartCmdArg] = process.argv;
const oldPid = oldPidArg ? Number(oldPidArg) : null;
const restartCmd = (restartCmdArg || '').trim();

function writeStatus(status, extra = {}) {
  fs.mkdirSync(path.dirname(statusPath), { recursive: true });
  fs.writeFileSync(
    statusPath,
    JSON.stringify({ status, updated_at: new Date().toISOString(), ...extra }, null, 2)
  );
}

function run(cmd) {
  return execSync(cmd, { cwd: repoRoot, stdio: 'pipe', encoding: 'utf8' });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  try {
    writeStatus('pulling');
    run('git pull');

    writeStatus('installing');
    run('npm install --prefix server');
    run('npm install --prefix client');

    writeStatus('building');
    run('npm run build --prefix client');
  } catch (err) {
    writeStatus('error', { error: String(err.stderr || err.message || err).slice(0, 2000) });
    return;
  }

  // Everything needed is on disk and built - only now is it safe to touch
  // the running process.
  writeStatus('restarting');

  if (restartCmd) {
    // A supervisor (pm2, systemd, ...) owns starting/stopping the process -
    // let it do both instead of also killing the PID ourselves, which would
    // just race whatever restart policy it already has.
    try {
      run(restartCmd);
      writeStatus('done');
    } catch (err) {
      writeStatus('error', { error: String(err.stderr || err.message || err).slice(0, 2000) });
    }
    return;
  }

  // No supervisor configured - stop the old process ourselves and start a
  // fresh one, detached so it outlives this script.
  if (oldPid) {
    try {
      process.kill(oldPid, 'SIGTERM');
    } catch {
      // already gone
    }
  }
  await sleep(1500); // let the OS free the port before rebinding it

  const child = spawn(
    process.execPath,
    ['--disable-warning=ExperimentalWarning', 'src/index.js'],
    { cwd: serverDir, detached: true, stdio: 'ignore' }
  );
  child.unref();

  writeStatus('done');
}

main();
