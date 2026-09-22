import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import ChoreSetup from './ChoreSetup.jsx';

function GeneralSettings({ config, onConfigUpdated }) {
  const [names, setNames] = useState({ member_1: '', member_2: '', member_3: '' });
  const [zip, setZip] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [error, setError] = useState(null);

  const [googleStatus, setGoogleStatus] = useState(null);
  const [googleError, setGoogleError] = useState(null);

  useEffect(() => {
    if (config) {
      setNames(config.members);
      setZip(config.weather_zip);
    }
  }, [config]);

  useEffect(() => {
    api.googleStatus().then(setGoogleStatus).catch((err) => setGoogleError(err.message));
  }, []);

  async function connectGoogle() {
    try {
      const { url } = await api.googleAuthUrl();
      window.open(url, '_blank');
    } catch (err) {
      setGoogleError(err.message);
    }
  }

  async function disconnectGoogle() {
    await api.googleDisconnect();
    setGoogleStatus(await api.googleStatus());
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      const updated = await api.updateSettings({
        member_1: names.member_1,
        member_2: names.member_2,
        member_3: names.member_3,
        weather_zip: zip,
      });
      onConfigUpdated?.(updated);
      setSaveMessage('Saved!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="field">
        <label htmlFor="name-member-1">Member 1 name</label>
        <input
          id="name-member-1"
          type="text"
          value={names.member_1}
          onChange={(e) => setNames((n) => ({ ...n, member_1: e.target.value }))}
        />
      </div>
      <div className="field">
        <label htmlFor="name-member-2">Member 2 name</label>
        <input
          id="name-member-2"
          type="text"
          value={names.member_2}
          onChange={(e) => setNames((n) => ({ ...n, member_2: e.target.value }))}
        />
      </div>
      <div className="field">
        <label htmlFor="name-member-3">Member 3 name (lunch tracker child)</label>
        <input
          id="name-member-3"
          type="text"
          value={names.member_3}
          onChange={(e) => setNames((n) => ({ ...n, member_3: e.target.value }))}
        />
      </div>
      <div className="field">
        <label htmlFor="weather-zip">Weather zip code</label>
        <input id="weather-zip" type="text" inputMode="numeric" maxLength={5} value={zip} onChange={(e) => setZip(e.target.value)} />
      </div>

      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}
      {saveMessage && <p style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{saveMessage}</p>}

      <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save Changes'}
      </button>

      <div className="field" style={{ marginTop: 24 }}>
        <label>Google Calendar</label>
        {!googleStatus && <p>Checking status…</p>}
        {googleStatus && !googleStatus.configured && (
          <p style={{ color: 'var(--color-text-muted)' }}>
            Not configured. Add GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI to the server's .env file
            (see README) and restart the server.
          </p>
        )}
        {googleStatus && googleStatus.configured && (
          <div>
            <p>{googleStatus.connected ? '✅ Connected — Google Calendar events appear on the agenda.' : 'Not connected yet.'}</p>
            {googleStatus.connected ? (
              <button className="btn btn-secondary" onClick={disconnectGoogle}>Disconnect</button>
            ) : (
              <button className="btn btn-primary" onClick={connectGoogle}>Connect Google Calendar</button>
            )}
          </div>
        )}
        {googleError && <p style={{ color: 'var(--color-danger)' }}>{googleError}</p>}
      </div>
    </>
  );
}

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'chores', label: 'Chore Setup' },
];

export default function SettingsPanel({ config, onConfigUpdated }) {
  const [tab, setTab] = useState('general');

  return (
    <section className="widget-card">
      <div className="widget-header">
        <h2>Settings</h2>
      </div>

      <div className="settings-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`settings-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && <GeneralSettings config={config} onConfigUpdated={onConfigUpdated} />}
      {tab === 'chores' && <ChoreSetup members={config?.members} />}
    </section>
  );
}
