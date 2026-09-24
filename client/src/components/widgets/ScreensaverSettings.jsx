import { useState } from 'react';
import { THEMES } from '../../lib/photoLibrary.js';
import Screensaver from '../Screensaver.jsx';

export default function ScreensaverSettings({ zip, settings, onChange }) {
  const [previewing, setPreviewing] = useState(false);

  function update(partial) {
    onChange({ ...settings, ...partial });
  }

  return (
    <div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: 0 }}>
        These settings only apply to this device/browser — turn the screensaver on for the wall
        display's browser, and leave it off on phones and tablets.
      </p>

      <div className="field">
        <div className="checkbox-row">
          <input
            id="ss-enabled"
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
          />
          <label htmlFor="ss-enabled" style={{ margin: 0 }}>Enable screensaver on this device</label>
        </div>
      </div>

      <div className="field">
        <div className="checkbox-row">
          <input
            id="ss-whiteboard"
            type="checkbox"
            checked={settings.showWhiteboard}
            onChange={(e) => update({ showWhiteboard: e.target.checked })}
          />
          <label htmlFor="ss-whiteboard" style={{ margin: 0 }}>
            Show the whiteboard as a sticky note overlay
          </label>
        </div>
      </div>

      <div className="field">
        <div className="checkbox-row">
          <input
            id="ss-briefing"
            type="checkbox"
            checked={settings.showDailyBriefing}
            onChange={(e) => update({ showDailyBriefing: e.target.checked })}
          />
          <label htmlFor="ss-briefing" style={{ margin: 0 }}>
            Show today's calendar events starting at 5am (daily briefing)
          </label>
        </div>
      </div>

      <div className="field">
        <label htmlFor="ss-idle">Start after idle for</label>
        <select id="ss-idle" value={settings.idleMinutes} onChange={(e) => update({ idleMinutes: Number(e.target.value) })}>
          {[5, 10, 15, 30].map((m) => (
            <option key={m} value={m}>{m} minutes</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="ss-interval">Change photo every</label>
        <select
          id="ss-interval"
          value={settings.photoIntervalSeconds}
          onChange={(e) => update({ photoIntervalSeconds: Number(e.target.value) })}
        >
          {[15, 30, 60, 120].map((s) => (
            <option key={s} value={s}>{s} seconds</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="ss-theme">Photo theme</label>
        <select id="ss-theme" value={settings.theme} onChange={(e) => update({ theme: e.target.value })}>
          {THEMES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>

      <button className="btn btn-primary" onClick={() => setPreviewing(true)}>Preview</button>

      {previewing && <Screensaver settings={settings} zip={zip} onDismiss={() => setPreviewing(false)} />}
    </div>
  );
}
