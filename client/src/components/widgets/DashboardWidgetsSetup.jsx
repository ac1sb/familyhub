import { useState } from 'react';
import { WIDGET_CATALOG, getEnabledWidgets, setEnabledWidgets, resetDashboardLayout } from '../../lib/dashboardLayout.js';

export default function DashboardWidgetsSetup() {
  const [enabled, setEnabled] = useState(() => getEnabledWidgets());

  function toggle(id) {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setEnabledWidgets(next);
      return next;
    });
  }

  function handleReset() {
    setEnabled(resetDashboardLayout());
  }

  return (
    <div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: 0 }}>
        Choose which widgets show on this device's Home dashboard - this is per-device, so a phone
        can show fewer widgets than the wall display. Turning one off doesn't delete its data or its
        saved position, and every widget stays reachable from the sidebar either way.
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
            <label htmlFor={`widget-${widget.id}`} style={{ margin: 0 }}>{widget.label}</label>
          </div>
        </div>
      ))}

      <button className="btn btn-secondary" onClick={handleReset} style={{ marginTop: 12 }}>
        &#8635; Reset to default layout
      </button>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: 8 }}>
        Turns every widget back on and puts them back in their default positions/sizes on this device -
        undoes any dragging, resizing, or hiding done from the Home dashboard.
      </p>
    </div>
  );
}
