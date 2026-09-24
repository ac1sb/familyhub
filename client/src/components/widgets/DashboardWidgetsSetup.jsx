import { useState } from 'react';
import {
  WIDGET_CATALOG,
  getEnabledWidgets,
  setEnabledWidgets,
  getWidgetColors,
  setWidgetColors,
  resetDashboardLayout,
} from '../../lib/dashboardLayout.js';

// Just a neutral starting point for the color picker itself when a widget
// has no custom color yet - picking a color and saving is what actually
// sets it; leaving it alone keeps following the normal light/dark theme.
const PICKER_DEFAULT = '#ffffff';

export default function DashboardWidgetsSetup() {
  const [enabled, setEnabled] = useState(() => getEnabledWidgets());
  const [colors, setColors] = useState(() => getWidgetColors());

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
    <div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: 0 }}>
        Choose which widgets show on this device's Home dashboard - this is per-device, so a phone
        can show fewer widgets than the wall display. Turning one off doesn't delete its data or its
        saved position, and every widget stays reachable from the sidebar either way. Pick a background
        color for a widget to pin it to that color regardless of day/night theme; leave it alone and it
        keeps following the normal theme.
      </p>

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
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: 8 }}>
        Turns every widget back on, puts them back in their default positions/sizes, and clears any
        custom colors on this device - undoes any dragging, resizing, recoloring, or hiding done from
        the Home dashboard.
      </p>
    </div>
  );
}
