import { useEffect, useState } from 'react';
import { api } from '../../api.js';

export default function MusicSetup() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  function refresh() {
    api.spotifyStatus().then(setStatus).catch((err) => setError(err.message));
  }

  useEffect(refresh, []);

  async function connect() {
    try {
      const { url } = await api.spotifyAuthUrl();
      window.open(url, '_blank');
    } catch (err) {
      setError(err.message);
    }
  }

  async function disconnect() {
    await api.spotifyDisconnect();
    refresh();
  }

  return (
    <div className="settings-content">
      <div className="settings-section">
        <div className="settings-section-title">Spotify</div>
        <p className="settings-section-intro">
          Controls Spotify playback on whatever device is active on the account - including a
          Raspberry Pi running <strong>librespot</strong>, an open-source Spotify Connect client that
          makes the Pi itself (plus whatever speaker it's wired to, aux or Bluetooth) a real,
          selectable speaker rather than just a remote. Requires <strong>Spotify Premium</strong> -
          free accounts can't be controlled this way, and librespot itself needs a Premium login to
          act as a Connect device at all. See the README's "Spotify / Music" section for the full
          librespot setup (it needs to run directly on the Pi, not something this Settings page can
          do for you).
        </p>

        {!status && !error && <p>Checking status…</p>}
        {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}
        {status && !status.configured && (
          <p style={{ color: 'var(--color-text-muted)' }}>
            Not configured. Add SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET / SPOTIFY_REDIRECT_URI to
            the server's .env file (see README) and restart the server.
          </p>
        )}
        {status?.configured && (
          <div>
            <p>{status.connected ? '✅ Connected' : 'Not connected yet.'}</p>
            {status.connected ? (
              <button className="btn btn-secondary" onClick={disconnect}>Disconnect</button>
            ) : (
              <button className="btn btn-primary" onClick={connect}>Connect Spotify</button>
            )}
          </div>
        )}

        <p className="settings-section-intro" style={{ marginTop: 14, marginBottom: 0 }}>
          Once connected, the Music page controls whatever's active - press play on a phone first,
          then use Music &rarr; "Change device" to move playback to the Pi once librespot is running
          there.
        </p>
      </div>
    </div>
  );
}
