import { useEffect, useRef, useState } from 'react';
import { api } from '../../api.js';

const ACTIVE_STATUSES = new Set(['starting', 'pulling', 'installing', 'building', 'restarting', 'reloading']);
const STATUS_LABEL = {
  starting: 'Starting update…',
  pulling: 'Pulling latest code…',
  installing: 'Installing dependencies…',
  building: 'Building the app…',
  restarting: 'Restarting the server…',
  reloading: 'Updated! Reloading…',
};
// Long enough for `npm install` + a client build on a Raspberry Pi, plus the
// several seconds a plain kill/respawn restart needs - past this, a poll
// that never comes back means something short of the update itself failed.
const MAX_FAILED_POLLS = 90; // ~3 minutes at a 2s interval

export default function UpdatePanel() {
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const [checkError, setCheckError] = useState(null);
  const [updateStatus, setUpdateStatus] = useState(null);
  const pollRef = useRef(null);
  const failedPollsRef = useRef(0);

  useEffect(() => () => clearInterval(pollRef.current), []);

  async function checkForUpdates() {
    setChecking(true);
    setCheckError(null);
    try {
      setCheckResult(await api.updateCheck());
    } catch (err) {
      setCheckError(err.message);
    } finally {
      setChecking(false);
    }
  }

  function pollStatus() {
    api
      .updateStatus()
      .then((status) => {
        failedPollsRef.current = 0;
        if (status.status === 'done') {
          clearInterval(pollRef.current);
          // Keep showing an active/"done" state (never falling back to the
          // idle button row) right up until the reload actually happens -
          // the freshly-rebuilt client bundle is what that reload picks up.
          setUpdateStatus({ status: 'reloading' });
          setTimeout(() => window.location.reload(), 1200);
        } else {
          setUpdateStatus(status);
          if (status.status === 'error') clearInterval(pollRef.current);
        }
      })
      .catch(() => {
        // Expected for a few seconds while the old process dies and the new
        // one comes up - only treat it as a real failure after a long streak.
        failedPollsRef.current += 1;
        if (failedPollsRef.current > MAX_FAILED_POLLS) {
          clearInterval(pollRef.current);
          setUpdateStatus({
            status: 'error',
            error: "The server didn't come back after restarting - check it directly.",
          });
        }
      });
  }

  async function runUpdate() {
    if (
      !window.confirm(
        'This pulls the latest code, reinstalls dependencies, rebuilds, and restarts the server. ' +
          'The display will go blank for a minute or two while it restarts. Continue?'
      )
    ) {
      return;
    }
    failedPollsRef.current = 0;
    setUpdateStatus({ status: 'starting' });
    try {
      await api.updateRun();
    } catch (err) {
      setUpdateStatus({ status: 'error', error: err.message });
      return;
    }
    pollRef.current = setInterval(pollStatus, 2000);
  }

  const isUpdating = updateStatus && ACTIVE_STATUSES.has(updateStatus.status);

  return (
    <div className="field" style={{ marginTop: 24 }}>
      <label>Software Update</label>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '0 0 8px' }}>
        Pulls the latest code from git, reinstalls dependencies, rebuilds, and restarts the server -
        the same steps as running <code>npm run update</code> by hand, from a button instead of SSH.
      </p>

      {!isUpdating && updateStatus?.status !== 'error' && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={checkForUpdates} disabled={checking}>
            {checking ? 'Checking…' : 'Check for updates'}
          </button>
          <button className="btn btn-primary" onClick={runUpdate}>
            Update now
          </button>
        </div>
      )}

      {checkError && <p style={{ color: 'var(--color-danger)' }}>{checkError}</p>}
      {checkResult && !checkError && !isUpdating && (
        <p style={{ fontWeight: 600, color: checkResult.upToDate ? 'var(--color-text-muted)' : 'var(--color-primary)' }}>
          {checkResult.upToDate
            ? "You're up to date."
            : `Update available (${checkResult.commitsBehind} commit${checkResult.commitsBehind === 1 ? '' : 's'} behind).`}
        </p>
      )}

      {isUpdating && (
        <p style={{ fontWeight: 600 }}>{STATUS_LABEL[updateStatus.status] || 'Updating…'}</p>
      )}
      {updateStatus?.status === 'error' && (
        <>
          <p style={{ color: 'var(--color-danger)' }}>{updateStatus.error}</p>
          <button className="btn btn-secondary" onClick={() => setUpdateStatus(null)}>Dismiss</button>
        </>
      )}
    </div>
  );
}
