import { useEffect, useState } from 'react';
import { api } from '../../api.js';

export default function SettingsPanel({ config }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.googleStatus().then(setStatus).catch((err) => setError(err.message));
  }, []);

  async function connect() {
    try {
      const { url } = await api.googleAuthUrl();
      window.open(url, '_blank');
    } catch (err) {
      setError(err.message);
    }
  }

  async function disconnect() {
    await api.googleDisconnect();
    setStatus(await api.googleStatus());
  }

  return (
    <section className="widget-card">
      <div className="widget-header">
        <h2>Settings</h2>
      </div>

      <div className="field">
        <label>Google Calendar</label>
        {!status && <p>Checking status…</p>}
        {status && !status.configured && (
          <p style={{ color: 'var(--color-text-muted)' }}>
            Not configured. Add GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI to the server's .env file
            (see README) and restart the server.
          </p>
        )}
        {status && status.configured && (
          <div>
            <p>{status.connected ? '✅ Connected — Google Calendar events appear on the agenda.' : 'Not connected yet.'}</p>
            {status.connected ? (
              <button className="btn btn-secondary" onClick={disconnect}>Disconnect</button>
            ) : (
              <button className="btn btn-primary" onClick={connect}>Connect Google Calendar</button>
            )}
          </div>
        )}
        {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}
      </div>

      <div className="field">
        <label>Household members</label>
        <p style={{ color: 'var(--color-text-muted)' }}>
          {config ? Object.values(config.members).join(' · ') : '…'} — edit member names via MEMBER_1_NAME / MEMBER_2_NAME /
          MEMBER_3_NAME in the server .env file.
        </p>
      </div>

      <div className="field">
        <label>Weather location</label>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Zip code {config?.weather_zip} — change with WEATHER_ZIP in the server .env file.
        </p>
      </div>
    </section>
  );
}
