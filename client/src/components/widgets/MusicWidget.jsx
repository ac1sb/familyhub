import { useEffect, useState } from 'react';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';

function formatMs(ms) {
  if (ms == null) return '';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function MusicWidget({ compact = false, onExpand }) {
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [devices, setDevices] = useState(null);
  const [showDevices, setShowDevices] = useState(false);
  const [transferring, setTransferring] = useState(null);

  useEffect(() => {
    api.spotifyStatus().then(setStatus).catch((err) => setStatusError(err.message));
  }, []);

  const connected = status?.connected;
  const { data, refresh } = usePolling(
    () => (connected ? api.spotifyNowPlaying() : Promise.resolve(null)),
    [connected],
    5000
  );

  async function loadDevices() {
    try {
      const r = await api.spotifyDevices();
      setDevices(r.devices);
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function runAction(fn) {
    setActionError(null);
    try {
      await fn();
      refresh();
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function handleTransfer(deviceId) {
    setTransferring(deviceId);
    try {
      await api.spotifyTransfer(deviceId);
      setShowDevices(false);
      refresh();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setTransferring(null);
    }
  }

  function toggleDevicePicker() {
    if (!showDevices) loadDevices();
    setShowDevices((v) => !v);
  }

  if (statusError) {
    return (
      <section className={`widget-card${compact ? ' compact' : ''}`}>
        <div className="widget-header"><h2>Music</h2></div>
        <p style={{ color: 'var(--color-danger)' }}>⚠️ {statusError}</p>
      </section>
    );
  }

  if (status && !status.configured) {
    return (
      <section className={`widget-card${compact ? ' compact' : ''}`}>
        <div className="widget-header"><h2>Music</h2></div>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Not configured. Add SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET / SPOTIFY_REDIRECT_URI to
          the server's .env file (see README) and restart the server.
        </p>
      </section>
    );
  }

  if (status && !status.connected) {
    return (
      <section className={`widget-card${compact ? ' compact' : ''}`}>
        <div className="widget-header"><h2>Music</h2></div>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Not connected yet - connect Spotify in Settings &rarr; Music.
        </p>
      </section>
    );
  }

  const track = data?.playing ? data.track : null;
  const device = data?.playing ? data.device : null;

  return (
    <section className={`widget-card${compact ? ' compact' : ''}`}>
      <div className="widget-header">
        <h2>Music</h2>
        {compact && onExpand && <button className="see-all" onClick={onExpand}>See all &rarr;</button>}
      </div>

      {actionError && <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>⚠️ {actionError}</p>}

      {!track && (
        <p style={{ color: 'var(--color-text-muted)' }}>
          Nothing playing. {!compact && 'Start something on Spotify, then pick a device below to move it here.'}
        </p>
      )}

      {track && (
        <div className="music-now-playing">
          {track.albumArtUrl && <img className="music-album-art" src={track.albumArtUrl} alt={track.album || ''} />}
          <div className="music-track-info">
            <div className="music-track-title">{track.name}</div>
            <div className="music-track-artist">{track.artists}</div>
            {!compact && (
              <div className="music-track-progress">
                {formatMs(data.progressMs)} / {formatMs(track.durationMs)}
              </div>
            )}
            {!compact && device && <div className="music-device-name">🔊 {device.name}</div>}
          </div>
        </div>
      )}

      <div className="music-controls">
        <button className="btn-icon" onClick={() => runAction(api.spotifyPrevious)} title="Previous">⏮</button>
        <button
          className="btn-icon"
          onClick={() => runAction(data?.isPlaying ? api.spotifyPause : api.spotifyPlay)}
          title={data?.isPlaying ? 'Pause' : 'Play'}
        >
          {data?.isPlaying ? '⏸' : '▶️'}
        </button>
        <button className="btn-icon" onClick={() => runAction(api.spotifyNext)} title="Next">⏭</button>
      </div>

      {!compact && (
        <>
          {device && (
            <div className="field" style={{ marginTop: 10 }}>
              <label htmlFor="music-volume">Volume</label>
              <input
                id="music-volume"
                type="range"
                min={0}
                max={100}
                defaultValue={device.volumePercent ?? 50}
                onChange={(e) => runAction(() => api.spotifySetVolume(Number(e.target.value)))}
              />
            </div>
          )}

          <button className="btn btn-secondary" onClick={toggleDevicePicker} style={{ marginTop: 6 }}>
            {showDevices ? 'Hide devices' : 'Change device'}
          </button>
          {showDevices && (
            <div style={{ marginTop: 8 }}>
              {devices === null && <p style={{ color: 'var(--color-text-muted)' }}>Loading devices…</p>}
              {devices?.length === 0 && (
                <p style={{ color: 'var(--color-text-muted)' }}>
                  No devices found - open Spotify somewhere, or make sure librespot is running on the Pi.
                </p>
              )}
              {devices?.map((d) => (
                <div className="chore-row" key={d.id}>
                  <span className="chore-title">{d.name}</span>
                  {d.isActive && <span className="chore-tag family">Active</span>}
                  <button
                    className="btn btn-primary"
                    onClick={() => handleTransfer(d.id)}
                    disabled={d.isActive || transferring === d.id}
                  >
                    {transferring === d.id ? 'Switching…' : d.isActive ? 'Playing here' : 'Play here'}
                  </button>
                </div>
              ))}
            </div>
          )}

          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: 10, marginBottom: 0 }}>
            Controls whatever device is active on this Spotify account - including a Raspberry Pi
            running librespot as a real Spotify Connect speaker (Settings &rarr; Music has the setup
            notes). Requires Spotify Premium.
          </p>
        </>
      )}
    </section>
  );
}
