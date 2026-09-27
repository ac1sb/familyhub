import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import ChoreSetup from './ChoreSetup.jsx';
import DailyTaskSetup from './DailyTaskSetup.jsx';
import ScreensaverSettings from './ScreensaverSettings.jsx';
import SmartHomeSetup from './SmartHomeSetup.jsx';
import FamilyPhotosSetup from './FamilyPhotosSetup.jsx';
import MusicSetup from './MusicSetup.jsx';
import DashboardWidgetsSetup from './DashboardWidgetsSetup.jsx';
import UpdatePanel from './UpdatePanel.jsx';

function GeneralSettings({ config, onConfigUpdated }) {
  const [names, setNames] = useState({ member_1: '', member_2: '', member_3: '' });
  const [zip, setZip] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (config) {
      setNames(config.members);
      setZip(config.weather_zip);
    }
  }, [config]);

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
    <div className="settings-content">
      <div className="settings-section">
        <div className="settings-section-title">Household</div>
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
      </div>

      <ShoppingSheetSettings />
      <SheetsServiceAccountSettings />
      <UpdatePanel />
    </div>
  );
}

function CalendarSettings({ config, onConfigUpdated }) {
  const names = config?.members || { member_1: '', member_2: '', member_3: '' };
  const [icalFeeds, setIcalFeeds] = useState([{ url: '', member: 'family' }]);
  const [googleCalendarId, setGoogleCalendarId] = useState('');
  const [googleEventsMember, setGoogleEventsMember] = useState('family');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [error, setError] = useState(null);

  const [googleStatus, setGoogleStatus] = useState(null);
  const [googleError, setGoogleError] = useState(null);

  useEffect(() => {
    if (config) {
      setIcalFeeds(config.ical_feeds?.length ? config.ical_feeds : [{ url: '', member: 'family' }]);
      setGoogleCalendarId(config.google_calendar_id || 'primary');
      setGoogleEventsMember(config.google_events_member || 'family');
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

  function updateFeed(index, patch) {
    setIcalFeeds((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function addFeedRow() {
    setIcalFeeds((prev) => [...prev, { url: '', member: 'family' }]);
  }

  function removeFeedRow(index) {
    setIcalFeeds((prev) => {
      const next = prev.filter((_, i) => i !== index);
      // Keep at least one (blank) row so there's always something to type into.
      return next.length ? next : [{ url: '', member: 'family' }];
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      const updated = await api.updateSettings({
        ical_feeds: icalFeeds,
        google_calendar_id: googleCalendarId,
        google_events_member: googleEventsMember,
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
    <div className="settings-content">
      <div className="settings-section">
        <div className="settings-section-title">Shared calendar feeds (optional)</div>
        <p className="settings-section-intro">
          Paste a calendar's "Secret address in iCal format" (Google Calendar &rarr; that calendar's
          Settings &rarr; Integrate calendar) to show its events on the agenda - read-only, and no
          Google sign-in needed. Add one per person to keep each on their own column. This is separate
          from the Google Calendar connection below, which is for two-way sync with your own account's
          calendar.
        </p>
        {icalFeeds.map((feed, i) => (
          <div className="ical-feed-row" key={i}>
            <input
              type="text"
              placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
              value={feed.url}
              onChange={(e) => updateFeed(i, { url: e.target.value })}
            />
            <select value={feed.member} onChange={(e) => updateFeed(i, { member: e.target.value })}>
              <option value="family">Family (all columns)</option>
              <option value="member_1">{names.member_1 || 'Member 1'}</option>
              <option value="member_2">{names.member_2 || 'Member 2'}</option>
              <option value="member_3">{names.member_3 || 'Member 3'}</option>
            </select>
            <button
              type="button"
              className="btn-icon"
              title="Remove this feed"
              onClick={() => removeFeedRow(i)}
              disabled={icalFeeds.length === 1 && !feed.url}
            >
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="btn-link" onClick={addFeedRow} style={{ marginTop: 4 }}>
          + Add another feed
        </button>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Google Calendar</div>
        {!googleStatus && <p>Checking status…</p>}
        {googleStatus && !googleStatus.configured && (
          <p style={{ color: 'var(--color-text-muted)' }}>
            Not configured. Add GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI to the server's .env file
            (see README) and restart the server.
          </p>
        )}
        {googleStatus && googleStatus.configured && (
          <div className="field">
            <p style={{ margin: 0 }}>
              {googleStatus.connected
                ? '✅ Connected — two-way sync: that calendar\'s events show up here, and events added in FamilyHub are pushed to it too.'
                : 'Not connected yet.'}
            </p>
            {googleStatus.connected ? (
              <button className="btn btn-secondary" onClick={disconnectGoogle} style={{ alignSelf: 'flex-start' }}>Disconnect</button>
            ) : (
              <button className="btn btn-primary" onClick={connectGoogle} style={{ alignSelf: 'flex-start' }}>Connect Google Calendar</button>
            )}
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', margin: 0 }}>
              Connected before and FamilyHub-created events aren't showing up on Google? That connection
              only granted read access - disconnect and reconnect once to approve the write permission
              two-way sync needs.
            </p>
          </div>
        )}
        {googleError && <p style={{ color: 'var(--color-danger)' }}>{googleError}</p>}

        {googleStatus?.connected && (
          <div className="field" style={{ marginTop: 18 }}>
            <label htmlFor="google-calendar-id">Google Calendar to sync events to</label>
            <input
              id="google-calendar-id"
              type="text"
              placeholder="primary"
              value={googleCalendarId}
              onChange={(e) => setGoogleCalendarId(e.target.value)}
            />
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', margin: 0 }}>
              Leave as "primary" to use the signed-in account's own calendar. To sync to a shared family
              calendar instead, share it with that account as an editor in Google Calendar, then paste its
              Calendar ID here (that calendar's Settings &rarr; Integrate calendar).
            </p>
          </div>
        )}
        {googleStatus?.connected && (
          <div className="field">
            <label htmlFor="google-events-member">Show its events under</label>
            <select
              id="google-events-member"
              value={googleEventsMember}
              onChange={(e) => setGoogleEventsMember(e.target.value)}
            >
              <option value="family">Family (all columns)</option>
              <option value="member_1">{names.member_1 || 'Member 1'}</option>
              <option value="member_2">{names.member_2 || 'Member 2'}</option>
              <option value="member_3">{names.member_3 || 'Member 3'}</option>
            </select>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', margin: 0 }}>
              If this connection is really one person's calendar rather than a shared household one, pin
              it to their column instead of showing it under all three.
            </p>
          </div>
        )}
      </div>

      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}
      {saveMessage && <p style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{saveMessage}</p>}

      <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  );
}

function ShoppingSheetSettings() {
  const [sheetId, setSheetId] = useState('');
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.shoppingSheetSettings().then((r) => {
      setSheetId(r.sheetId || '');
      setSaved(r.sheetId || '');
    }).catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const r = await api.saveShoppingSheetId(sheetId.trim());
      setSheetId(r.sheetId);
      setSaved(r.sheetId);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-section">
      <div className="settings-section-title">Shopping List Google Sheet</div>
      <div className="field">
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            id="shopping-sheet-id"
            type="text"
            placeholder="Google Sheet URL or ID"
            value={sheetId}
            onChange={(e) => setSheetId(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="btn btn-secondary" onClick={handleSave} disabled={saving || sheetId.trim() === saved}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', margin: 0 }}>
          Two-way with column F (row 2 down) on that spreadsheet's first tab, alongside whatever other
          columns are already there - column G quietly tracks which row is which item and can be ignored.
          Syncs automatically every few minutes once a sheet is set here (the "Sync with Sheet" button on
          the Shopping List page is just for pulling in a change right away). Type a new item into column
          F from your phone and it lands here on the next sync; an item added here gets a row there.
          Never deletes, clears, or shifts anything on either side - removing a row from the sheet
          doesn't remove it here (it'll just reappear there next sync, as long as it's still on the
          list). Requires the Google account connected in Settings &rarr; Calendar (or a Sheets service
          account below).
        </p>
      </div>
    </div>
  );
}

function SheetsServiceAccountSettings() {
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState(null);
  const [jsonInput, setJsonInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.sheetsServiceAccountStatus().then((r) => {
      setConnected(r.connected);
      setEmail(r.email);
    }).catch(() => {});
  }, []);

  async function handleSave() {
    if (!jsonInput.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const r = await api.saveSheetsServiceAccountKey(jsonInput.trim());
      setConnected(r.connected);
      setEmail(r.email);
      setJsonInput('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setSaving(true);
    try {
      await api.saveSheetsServiceAccountKey('');
      setConnected(false);
      setEmail(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-section">
      <div className="settings-section-title">Sheets Service Account (optional)</div>
      <p className="settings-section-intro">
        An alternative to the Google connection in Settings &rarr; Calendar, just for the Shopping
        List sheet sync - no sign-in or redirect URL needed, so it works before a stable host/IP is
        settled. Create a service account in Google Cloud Console, download its JSON key, share the
        target Google Sheet with its email as an Editor, then paste the whole downloaded file below.
        Used instead of that Google connection whenever it's set.
      </p>
      {connected ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="chore-tag family">✅ {email}</span>
          <button className="btn btn-secondary" onClick={handleRemove} disabled={saving}>Remove</button>
        </div>
      ) : (
        <>
          <textarea
            rows={6}
            placeholder="Paste the whole downloaded JSON key file here"
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.75rem' }}
          />
          <button
            className="btn btn-secondary"
            onClick={handleSave}
            disabled={saving || !jsonInput.trim()}
            style={{ marginTop: 6 }}
          >
            {saving ? 'Saving…' : 'Save Key'}
          </button>
        </>
      )}
      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}
    </div>
  );
}

const CONTROL_STYLES = [
  { id: 'flat', label: 'Flat', description: 'Thin borders, no shadows - the original minimal look.' },
  { id: 'soft', label: 'Soft', description: 'A gentle shadow and lift, so buttons and cards float a little above the background.' },
  { id: 'tactile', label: 'Tactile', description: 'Chamfered, beveled buttons with real weight, plus a pressed-in click when tapped.' },
];

function ControlStyleSettings({ uiStyle, onUiStyleChange }) {
  const active = CONTROL_STYLES.find((o) => o.id === uiStyle) || CONTROL_STYLES[0];
  return (
    <div className="settings-section">
      <div className="settings-section-title">Control Style</div>
      <p className="settings-section-intro">
        Adds depth to buttons and widget cards across the app. Purely visual, and per-device like the
        dashboard display styles - it applies immediately, no Save needed.
      </p>
      <div className="member-choice-row">
        {CONTROL_STYLES.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`member-choice family${uiStyle === opt.id ? ' selected' : ''}`}
            onClick={() => onUiStyleChange(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', margin: '10px 0 0' }}>
        {active.description}
      </p>
    </div>
  );
}

function AppearanceSettings({ config, onConfigUpdated, uiStyle, onUiStyleChange }) {
  const [themeMode, setThemeMode] = useState('auto');
  const [darkStart, setDarkStart] = useState('19:00');
  const [darkEnd, setDarkEnd] = useState('07:00');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (config?.theme) {
      setThemeMode(config.theme.theme_mode);
      setDarkStart(config.theme.dark_start);
      setDarkEnd(config.theme.dark_end);
    }
  }, [config]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      const updated = await api.updateSettings({ theme_mode: themeMode, dark_start: darkStart, dark_end: darkEnd });
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
    <div className="settings-content">
      <div className="settings-section">
        <div className="settings-section-title">Theme</div>
        <div className="field">
          <div className="member-choice-row">
            {[
              { id: 'auto', label: 'Automatic (schedule)' },
              { id: 'light', label: 'Always Light' },
              { id: 'dark', label: 'Always Dark' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`member-choice family${themeMode === opt.id ? ' selected' : ''}`}
                onClick={() => setThemeMode(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {themeMode === 'auto' && (
          <>
            <div className="field">
              <label htmlFor="dark-start">Switch to dark at</label>
              <input id="dark-start" type="time" value={darkStart} onChange={(e) => setDarkStart(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="dark-end">Switch back to light at</label>
              <input id="dark-end" type="time" value={darkEnd} onChange={(e) => setDarkEnd(e.target.value)} />
            </div>
          </>
        )}

        {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}
        {saveMessage && <p style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{saveMessage}</p>}

        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      <ControlStyleSettings uiStyle={uiStyle} onUiStyleChange={onUiStyleChange} />
    </div>
  );
}

const TABS = [
  { id: 'general', label: 'General', icon: '⚙️' },
  { id: 'calendar', label: 'Calendar', icon: '📅' },
  { id: 'appearance', label: 'Appearance', icon: '🎨' },
  { id: 'widgets', label: 'Dashboard Widgets', icon: '🧩' },
  { id: 'chores', label: 'Chore Setup', icon: '✅' },
  { id: 'daily', label: 'Daily Checklist Setup', icon: '📋' },
  { id: 'smarthome', label: 'Smart Home Setup', icon: '💡' },
  { id: 'familyphotos', label: 'Family Photos', icon: '📷' },
  { id: 'music', label: 'Music', icon: '🎵' },
  { id: 'screensaver', label: 'Screensaver', icon: '🖥️' },
];

export default function SettingsPanel({
  config,
  onConfigUpdated,
  screensaverSettings,
  onScreensaverSettingsChange,
  uiStyle,
  onUiStyleChange,
}) {
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
            <span className="settings-tab-icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'general' && <GeneralSettings config={config} onConfigUpdated={onConfigUpdated} />}
      {tab === 'calendar' && <CalendarSettings config={config} onConfigUpdated={onConfigUpdated} />}
      {tab === 'appearance' && (
        <AppearanceSettings
          config={config}
          onConfigUpdated={onConfigUpdated}
          uiStyle={uiStyle}
          onUiStyleChange={onUiStyleChange}
        />
      )}
      {tab === 'widgets' && <DashboardWidgetsSetup />}
      {tab === 'chores' && <ChoreSetup />}
      {tab === 'daily' && <DailyTaskSetup />}
      {tab === 'smarthome' && <SmartHomeSetup />}
      {tab === 'familyphotos' && <FamilyPhotosSetup />}
      {tab === 'music' && <MusicSetup />}
      {tab === 'screensaver' && (
        <ScreensaverSettings zip={config?.weather_zip} settings={screensaverSettings} onChange={onScreensaverSettingsChange} />
      )}
    </section>
  );
}
