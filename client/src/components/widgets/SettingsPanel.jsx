import { useEffect, useRef, useState } from 'react';
import { api } from '../../api.js';
import { WEEKDAY_LABELS } from '../../lib/week.js';
import ChoreSetup from './ChoreSetup.jsx';
import DailyTaskSetup from './DailyTaskSetup.jsx';
import ScreensaverSettings from './ScreensaverSettings.jsx';
import SmartHomeSetup from './SmartHomeSetup.jsx';
import FamilyPhotosSetup from './FamilyPhotosSetup.jsx';
import MusicSetup from './MusicSetup.jsx';
import DashboardWidgetsSetup from './DashboardWidgetsSetup.jsx';
import UpdatePanel from './UpdatePanel.jsx';

// One family member's avatar row in Settings - a live preview (photo or
// colored initial, matching what the actual dashboard widget shows) plus a
// color picker and upload/remove controls. Saves each change immediately
// (no "Save Changes" needed) since there's nothing here that benefits from
// batching, unlike the member name fields above it.
function AvatarEditor({ member, name }) {
  const [avatar, setAvatar] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    api.avatars().then((all) => setAvatar(all[member])).catch((err) => setError(err.message));
  }, [member]);

  async function handleColorChange(e) {
    const color = e.target.value;
    setAvatar((prev) => ({ ...prev, color }));
    try {
      const updated = await api.setAvatarColor(member, color);
      setAvatar(updated[member]);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const updated = await api.uploadAvatarPhoto(member, file);
      setAvatar(updated[member]);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleRemovePhoto() {
    try {
      const updated = await api.removeAvatarPhoto(member);
      setAvatar(updated[member]);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!avatar) return null;
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';

  return (
    <div className="avatar-editor-row">
      <div className="avatar-circle avatar-circle-small" style={!avatar.photo ? { background: avatar.color } : undefined}>
        {avatar.photo ? (
          <img src={avatar.photo} alt={name} className="avatar-photo" />
        ) : (
          <span className="avatar-initial">{initial}</span>
        )}
      </div>
      <span className="avatar-editor-name">{name || 'Unnamed'}</span>
      <input
        type="color"
        value={avatar.color}
        onChange={handleColorChange}
        className="widget-color-swatch"
        aria-label={`${name}'s avatar color`}
      />
      <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
        {uploading ? 'Uploading…' : 'Upload photo'}
      </button>
      {avatar.photo && (
        <button type="button" className="btn-icon" title="Remove photo" onClick={handleRemovePhoto}>
          ✕
        </button>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
      {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.8rem', margin: '0 0 0 8px' }}>{error}</p>}
    </div>
  );
}

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

      <div className="settings-section">
        <div className="settings-section-title">Avatars</div>
        <p className="settings-section-intro">
          Shown on each person's Avatar dashboard widget (turn those on in Settings &rarr; Dashboard
          Widgets). Pick a color for the circle behind their initial, or upload a photo to replace the
          initial entirely - saves immediately, no "Save Changes" needed.
        </p>
        <AvatarEditor member="member_1" name={names.member_1} />
        <AvatarEditor member="member_2" name={names.member_2} />
        <AvatarEditor member="member_3" name={names.member_3} />
      </div>

      <ShoppingSheetSettings />
      <SheetsServiceAccountSettings />
      <MealPlanPhotoSettings />
      <UpdatePanel />
    </div>
  );
}

// A Calendar ID is never a URL (it's "primary", an email address, or a
// xxxx@group.calendar.google.com string) - if someone pastes a link here,
// it's almost always the "Secret address in iCal format" meant for the
// read-only Shared calendar feeds section above instead, and would
// otherwise just fail silently against the Calendar API.
function looksLikeCalendarUrl(value) {
  return /^https?:\/\//i.test(value.trim());
}

function CalendarIdUrlWarning({ value }) {
  if (!looksLikeCalendarUrl(value)) return null;
  return (
    <p style={{ color: 'var(--color-danger)', fontSize: '0.8rem', margin: '4px 0 0' }}>
      That looks like a calendar link (the "Secret address in iCal format"), not a Calendar ID - this
      field needs just the ID itself, e.g. "primary" or an email address like name@gmail.com. A link
      like this belongs in the read-only "Shared calendar feeds" section above instead.
    </p>
  );
}

function CalendarSettings({ config, onConfigUpdated }) {
  const names = config?.members || { member_1: '', member_2: '', member_3: '' };
  const [icalFeeds, setIcalFeeds] = useState([{ url: '', member: 'family', label: '' }]);
  const [googleCalendarId, setGoogleCalendarId] = useState('');
  const [googleEventsMember, setGoogleEventsMember] = useState('family');
  const [memberCalendars, setMemberCalendars] = useState({ member_1: '', member_2: '' });
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [error, setError] = useState(null);

  const [googleStatus, setGoogleStatus] = useState(null);
  const [googleError, setGoogleError] = useState(null);

  useEffect(() => {
    if (config) {
      setIcalFeeds(config.ical_feeds?.length ? config.ical_feeds : [{ url: '', member: 'family', label: '' }]);
      setGoogleCalendarId(config.google_calendar_id || 'primary');
      setGoogleEventsMember(config.google_events_member || 'family');
      setMemberCalendars(config.google_member_calendars || { member_1: '', member_2: '' });
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
    setIcalFeeds((prev) => [...prev, { url: '', member: 'family', label: '' }]);
  }

  function removeFeedRow(index) {
    setIcalFeeds((prev) => {
      const next = prev.filter((_, i) => i !== index);
      // Keep at least one (blank) row so there's always something to type into.
      return next.length ? next : [{ url: '', member: 'family', label: '' }];
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
        google_member_calendars: memberCalendars,
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
          calendar. The label is just for you - a reminder of whose calendar a cryptic ics link actually
          is; it's never shown anywhere outside this page.
        </p>
        {icalFeeds.map((feed, i) => (
          <div className="ical-feed-group" key={i}>
            <input
              type="text"
              className="ical-feed-label"
              placeholder="Label (e.g. Reed's school calendar)"
              value={feed.label || ''}
              onChange={(e) => updateFeed(i, { label: e.target.value })}
            />
            <div className="ical-feed-row">
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
            <CalendarIdUrlWarning value={googleCalendarId} />
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
        {googleStatus?.connected && (
          <div className="field" style={{ marginTop: 18 }}>
            <label>Push each person's events onto their own Google Calendar</label>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', margin: '0 0 8px' }}>
              Optional, and separate from the calendar above. Have {names.member_1 || 'Member 1'} and{' '}
              {names.member_2 || 'Member 2'} each share their personal Google Calendar with the connected
              account as an editor, then paste each one's Calendar ID here - an event added under that
              person in FamilyHub is pushed straight onto their own calendar too.{' '}
              {names.member_3 || 'Member 3'}'s events go onto <strong>both</strong> calendars below (there's
              no separate field for a third calendar), so both parents see a child's events without the
              child needing a Google account of their own.
            </p>
            <label htmlFor="google-calendar-id-member-1" style={{ fontWeight: 400, fontSize: '0.85rem' }}>
              {names.member_1 || 'Member 1'}'s Google Calendar ID
            </label>
            <input
              id="google-calendar-id-member-1"
              type="text"
              placeholder="e.g. amber@gmail.com"
              value={memberCalendars.member_1}
              onChange={(e) => setMemberCalendars((prev) => ({ ...prev, member_1: e.target.value }))}
            />
            <CalendarIdUrlWarning value={memberCalendars.member_1} />
            <label htmlFor="google-calendar-id-member-2" style={{ fontWeight: 400, fontSize: '0.85rem', marginTop: 8 }}>
              {names.member_2 || 'Member 2'}'s Google Calendar ID
            </label>
            <input
              id="google-calendar-id-member-2"
              type="text"
              placeholder="e.g. ben@gmail.com"
              value={memberCalendars.member_2}
              onChange={(e) => setMemberCalendars((prev) => ({ ...prev, member_2: e.target.value }))}
            />
            <CalendarIdUrlWarning value={memberCalendars.member_2} />
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

function MealPlanPhotoSettings() {
  const [folderId, setFolderId] = useState('');
  const [savedFolderId, setSavedFolderId] = useState('');
  const [skipDay, setSkipDay] = useState(5);
  const [savedSkipDay, setSavedSkipDay] = useState(5);
  const [saving, setSaving] = useState(false);
  const [syncs, setSyncs] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);

  function loadSyncs() {
    api.mealPlanPhotoSyncs().then((r) => setSyncs(r.syncs)).catch(() => {});
  }

  useEffect(() => {
    api.mealPlanPhotoSettings().then((r) => {
      setFolderId(r.folderId || '');
      setSavedFolderId(r.folderId || '');
      setSkipDay(r.skipDay);
      setSavedSkipDay(r.skipDay);
    }).catch(() => {});
    loadSyncs();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const r = await api.saveMealPlanPhotoSettings(folderId.trim(), skipDay);
      setFolderId(r.folderId);
      setSavedFolderId(r.folderId);
      setSkipDay(r.skipDay);
      setSavedSkipDay(r.skipDay);
    } finally {
      setSaving(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncError(null);
    try {
      await api.syncMealPlanPhotos();
      loadSyncs();
    } catch (err) {
      setSyncError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="settings-section">
      <div className="settings-section-title">Meal Plan Photos</div>
      <p className="settings-section-intro">
        Drop a screenshot of your meal delivery's recipe list (e.g. Hungryroot's order slip) into a
        shared Google Drive folder, and it gets read automatically and written straight onto the
        upcoming Dinner Menu - no typing, no button to press. There's no review step: whatever OCR
        reads off the photo goes straight onto the menu, so double-check the result after the first
        try. Requires the Google account connected in Settings &rarr; Calendar.
      </p>
      <div className="field">
        <label htmlFor="meal-plan-folder">Google Drive folder</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            id="meal-plan-folder"
            type="text"
            placeholder="https://drive.google.com/drive/folders/..."
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="meal-plan-skip-day">Never fill in a meal on</label>
        <select id="meal-plan-skip-day" value={skipDay} onChange={(e) => setSkipDay(Number(e.target.value))}>
          {WEEKDAY_LABELS.map((label, i) => (
            <option key={i} value={i}>{label}</option>
          ))}
        </select>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', margin: '4px 0 0' }}>
          Recipes fill in the next empty days starting the day after the delivery date printed on the
          photo, skipping this day each time - e.g. a Friday delivery with Sunday-Friday in the rotation
          should skip Saturday (the default). A day that already has a meal in it, typed in by hand or
          from an earlier sync, is left alone. Falls back to starting the day after the sync runs if a
          photo has no readable date.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
        <button className="btn btn-secondary" onClick={handleSave} disabled={saving || (folderId.trim() === savedFolderId && skipDay === savedSkipDay)}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {savedFolderId && (
          <button className="btn btn-secondary" onClick={handleSync} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
        )}
      </div>
      {syncError && <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>⚠️ {syncError}</p>}

      {syncs.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="settings-section-title" style={{ marginBottom: 8 }}>Recent Syncs</div>
          {syncs.map((s) => (
            <div key={s.id} style={{ marginBottom: 8, fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>
                {new Date(s.syncedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </span>
              {s.recipeNames.length === 0 ? (
                <p style={{ margin: '2px 0 0', color: 'var(--color-danger)' }}>⚠️ No recipes found in that photo</p>
              ) : (
                <p style={{ margin: '2px 0 0' }}>{s.recipeNames.join(', ')}</p>
              )}
            </div>
          ))}
        </div>
      )}
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
