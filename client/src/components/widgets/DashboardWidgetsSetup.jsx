import { useState } from 'react';
import {
  WIDGET_CATALOG,
  getEnabledWidgets,
  setEnabledWidgets,
  getWidgetColors,
  setWidgetColors,
  resetDashboardLayout,
  getDashboardLocked,
  setDashboardLocked,
} from '../../lib/dashboardLayout.js';
import { getWidgetDisplayMode, setWidgetDisplayMode } from '../../lib/widgetDisplayMode.js';
import { getDashboardBackgroundSettings, setDashboardBackgroundSettings } from '../../lib/dashboardBackgroundSettings.js';
import { THEMES } from '../../lib/photoLibrary.js';

// Just a neutral starting point for the color picker itself when a widget
// has no custom color yet - picking a color and saving is what actually
// sets it; leaving it alone keeps following the normal light/dark theme.
const PICKER_DEFAULT = '#ffffff';

// The widgets with a List/Squares/Carousel choice - set independently, so
// e.g. Chores can stay a list while Daily Checklist is a carousel.
const DISPLAY_MODE_WIDGETS = [
  { id: 'chores', label: 'Chores' },
  { id: 'daily', label: 'Daily Checklist' },
];

export default function DashboardWidgetsSetup() {
  const [enabled, setEnabled] = useState(() => getEnabledWidgets());
  const [colors, setColors] = useState(() => getWidgetColors());
  const [displayModes, setDisplayModes] = useState(() =>
    Object.fromEntries(DISPLAY_MODE_WIDGETS.map((w) => [w.id, getWidgetDisplayMode(w.id)]))
  );
  const [background, setBackground] = useState(() => getDashboardBackgroundSettings());
  const [locked, setLocked] = useState(() => getDashboardLocked());

  function toggleLocked() {
    setLocked((prev) => {
      const next = !prev;
      setDashboardLocked(next);
      return next;
    });
  }

  function updateBackground(patch) {
    setBackground((prev) => {
      const next = { ...prev, ...patch };
      setDashboardBackgroundSettings(next);
      return next;
    });
  }

  function chooseBackgroundTheme(theme) {
    // A different theme invalidates whatever's cached in Static mode, so the
    // dashboard fetches a fresh photo matching it next time it's open instead
    // of quietly keeping the old one until "New Photo" is clicked.
    updateBackground({ theme, photo: null });
  }

  function chooseDisplayMode(widgetId, mode) {
    setDisplayModes((prev) => ({ ...prev, [widgetId]: mode }));
    setWidgetDisplayMode(widgetId, mode);
  }

  function toggle(id) {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setEnabledWidgets(next);
      return next;
    });
  }

  function setColor(id, hex) {
    setColors((prev) => {
      const next = { ...prev, [id]: hex };
      setWidgetColors(next);
      return next;
    });
  }

  function clearColor(id) {
    setColors((prev) => {
      const next = { ...prev };
      delete next[id];
      setWidgetColors(next);
      return next;
    });
  }

  function handleReset() {
    setEnabled(resetDashboardLayout());
    setColors({});
  }

  return (
    <div className="settings-content">
      <div className="settings-section">
        <div className="settings-section-title">Widgets</div>
        <p className="settings-section-intro">
          Choose which widgets show on this device's Home dashboard - this is per-device, so a phone
          can show fewer widgets than the wall display. Turning one off doesn't delete its data or its
          saved position, and every widget stays reachable from the sidebar either way. Pick a background
          color for a widget to pin it to that color regardless of day/night theme; leave it alone and
          it keeps following the normal theme. Whenever a dashboard background photo is on (below), every
          widget - custom color or not - goes frosted/translucent instead of a flat fill, so the photo
          shows through the whole dashboard instead of just the gaps between widgets.
        </p>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Dashboard Background</div>
        <div className="mode-toggle-row">
          <button
            type="button"
            className={`mode-toggle-btn${background.mode === 'off' ? ' active' : ''}`}
            onClick={() => updateBackground({ mode: 'off' })}
          >
            Off
          </button>
          <button
            type="button"
            className={`mode-toggle-btn${background.mode === 'static' ? ' active' : ''}`}
            onClick={() => updateBackground({ mode: 'static' })}
          >
            Static
          </button>
          <button
            type="button"
            className={`mode-toggle-btn${background.mode === 'rotating' ? ' active' : ''}`}
            onClick={() => updateBackground({ mode: 'rotating' })}
          >
            Rotating
          </button>
        </div>

        {background.mode !== 'off' && (
          <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={background.theme} onChange={(e) => chooseBackgroundTheme(e.target.value)}>
              {THEMES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
            {background.mode === 'rotating' && (
              <select
                value={background.intervalMinutes}
                onChange={(e) => updateBackground({ intervalMinutes: Number(e.target.value) })}
              >
                {[5, 10, 15, 30, 60].map((m) => (
                  <option key={m} value={m}>Change every {m} min</option>
                ))}
              </select>
            )}
            {background.mode === 'static' && (
              <button type="button" className="btn btn-secondary" onClick={() => updateBackground({ photo: null })}>
                🔄 New photo
              </button>
            )}
          </div>
        )}

        {background.mode !== 'off' && (
          <div style={{ marginTop: 12 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>
              Widget frost level: {background.frostOpacity}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={background.frostOpacity}
              onChange={(e) => updateBackground({ frostOpacity: Number(e.target.value) })}
              style={{ width: '100%', maxWidth: 320 }}
            />
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', margin: '4px 0 0' }}>
              Lower = more see-through to the photo, higher = more solid/readable widgets. At 0% a
              widget has no tint at all - just the blurred photo behind its text.
            </p>
          </div>
        )}
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: 8, marginBottom: 0 }}>
          A photo behind the widgets, from the same free nature-photo library as the screensaver.
          Static picks one and keeps it (until you tap "New photo" or change the theme); Rotating
          changes it on the interval above. Turning this on also makes every widget frosted/
          translucent instead of a flat fill, so the photo shows through the whole dashboard - not
          just the gaps between widgets.
        </p>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Widget Display Style</div>
        {DISPLAY_MODE_WIDGETS.map((widget) => (
          <div className="checkbox-row" key={widget.id} style={{ marginBottom: 10 }}>
            <span style={{ flex: 1, fontWeight: 600 }}>{widget.label} widget style</span>
            <div className="mode-toggle-row">
              <button
                type="button"
                className={`mode-toggle-btn${displayModes[widget.id] === 'list' ? ' active' : ''}`}
                onClick={() => chooseDisplayMode(widget.id, 'list')}
              >
                List
              </button>
              <button
                type="button"
                className={`mode-toggle-btn${displayModes[widget.id] === 'squares' ? ' active' : ''}`}
                onClick={() => chooseDisplayMode(widget.id, 'squares')}
              >
                Squares
              </button>
              <button
                type="button"
                className={`mode-toggle-btn${displayModes[widget.id] === 'carousel' ? ' active' : ''}`}
                onClick={() => chooseDisplayMode(widget.id, 'carousel')}
              >
                Carousel
              </button>
            </div>
          </div>
        ))}
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: 0, marginBottom: 0 }}>
          List shows several items stacked as full-width bars. Squares shows them as a small-tile 2x2
          grid, sized to only take up as much height as it actually needs (2 tiles fill just the top
          row, not the whole box) - like List, it only ever shows the top 4; the rest are a tap away on
          "See all," so the widget stays the same size no matter how many items pile up. Carousel shows
          one big tile at a time - swipe it left/right (or use the arrow
          buttons) to move through the items. Tapping a tile/bar itself always toggles it done, in any
          style. Set independently for each, per-device, like everything else on this page.
        </p>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Layout Lock</div>
        <div className="checkbox-row">
          <input
            id="dashboard-locked"
            type="checkbox"
            checked={locked}
            onChange={toggleLocked}
          />
          <label htmlFor="dashboard-locked" style={{ margin: 0 }}>
            Lock dashboard layout on this device
          </label>
        </div>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: 6, marginBottom: 0 }}>
          Prevents dragging or resizing any widget on the Home dashboard - a stray drag on a
          touchscreen (or a curious kid) can't move anything out of place. Everything else still
          works as normal: checking off a chore, editing the menu, tapping "See all," and so on.
          Per-device, like the layout itself - turn it off here again any time you want to rearrange.
        </p>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Show/Hide &amp; Colors</div>
        {WIDGET_CATALOG.map((widget) => (
          <div className="field" key={widget.id}>
            <div className="checkbox-row">
              <input
                id={`widget-${widget.id}`}
                type="checkbox"
                checked={enabled.has(widget.id)}
                onChange={() => toggle(widget.id)}
              />
              <label htmlFor={`widget-${widget.id}`} style={{ margin: 0, flex: 1 }}>{widget.label}</label>
              <input
                type="color"
                aria-label={`${widget.label} background color`}
                value={colors[widget.id] || PICKER_DEFAULT}
                onChange={(e) => setColor(widget.id, e.target.value)}
                className="widget-color-swatch"
              />
              {colors[widget.id] && (
                <button
                  type="button"
                  className="btn-icon"
                  title="Use theme default instead"
                  onClick={() => clearColor(widget.id)}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}

        <button className="btn btn-secondary" onClick={handleReset} style={{ marginTop: 12 }}>
          &#8635; Reset to default layout
        </button>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: 8, marginBottom: 0 }}>
          Turns every widget back on, puts them back in their default positions/sizes, and clears any
          custom colors on this device - undoes any dragging, resizing, recoloring, or hiding done from
          the Home dashboard.
        </p>
      </div>
    </div>
  );
}
