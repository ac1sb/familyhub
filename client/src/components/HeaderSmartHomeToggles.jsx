import { useEffect, useRef, useState } from 'react';
import { usePolling } from '../hooks/usePolling.js';
import { usePressHold } from '../hooks/usePressHold.js';
import { useCountdown, formatCountdown } from '../hooks/useCountdown.js';
import { api } from '../api.js';

function HeaderToggle({ device, onToggle, onSetBrightness }) {
  const [showDimmer, setShowDimmer] = useState(false);
  const wrapRef = useRef(null);
  const pressHandlers = usePressHold(() => onToggle(device), () => setShowDimmer(true), {
    enabled: device.dimmable,
  });

  // Tapping anywhere outside the popover closes it, same as any other
  // lightweight overlay in the app.
  useEffect(() => {
    if (!showDimmer) return;
    function handleOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowDimmer(false);
    }
    document.addEventListener('pointerdown', handleOutside, true);
    return () => document.removeEventListener('pointerdown', handleOutside, true);
  }, [showDimmer]);

  return (
    <div className="header-toggle-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`header-toggle${device.is_on ? ' on' : ''}`}
        {...pressHandlers}
        title={device.dimmable ? 'Tap to toggle - press and hold to dim' : 'Tap to toggle'}
      >
        <span className="header-toggle-dot" />
        <span className="header-toggle-name">{device.name}</span>
      </button>

      {showDimmer && (
        <div className="header-toggle-popover">
          <div className="header-toggle-popover-title">{device.name}</div>
          <input
            type="range"
            min={1}
            max={100}
            value={device.brightness}
            onChange={(e) => onSetBrightness(device, Number(e.target.value))}
          />
          <button type="button" className="btn-link" onClick={() => setShowDimmer(false)}>Done</button>
        </div>
      )}
    </div>
  );
}

// A washer/dryer's header chip is read-only status, not a toggle - the
// point is a glance at "still running" vs "done" without opening the Smart
// Home page, with a live ticking countdown (not just whatever number the
// last poll happened to report) while it's actually running. The state
// label itself (not just the countdown) is what answers "is it done yet" -
// so unlike the toggle chips, this never hides itself.
function HeaderThinqChip({ device }) {
  const isRunning = device.state === 'Running';
  const msLeft = useCountdown(isRunning ? device.remainMinutes : null);

  return (
    <div className={`header-toggle thinq-status${isRunning ? ' on' : ''}`} title={device.name}>
      <span className="header-toggle-name">🧺 {device.name}</span>
      <span className="header-thinq-state">
        {device.thinq_error ? '⚠️' : device.state || 'Unknown'}
        {isRunning && msLeft != null ? ` · ${formatCountdown(msLeft)}` : ''}
      </span>
    </div>
  );
}

// A quick-access strip of smart-home toggles, always visible right below
// the date/time (not just on the Home dashboard) - a single tap flips a
// device on/off, and pressing and holding one that supports dimming opens
// a small brightness slider instead. A LIFX device added via Discover
// (Settings -> Smart Home Setup) is real here too, same PUT endpoint as
// the Smart Home widget - everything else stays the local-only mock.
export default function HeaderSmartHomeToggles() {
  const { data, setData, refresh } = usePolling(() => api.smartDevices(), [], 15000);
  const devices = data?.devices || [];

  function patchLocal(id, patch) {
    setData((prev) => ({ devices: prev.devices.map((d) => (d.id === id ? { ...d, ...patch } : d)) }));
  }

  // A real LIFX call can fail (bulb offline, bad token, ...) where the old
  // local-only mock never could - on failure, undo the optimistic patch by
  // re-fetching the server's actual (unchanged) state.
  async function applyChange(device, patch) {
    patchLocal(device.id, patch);
    try {
      await api.updateSmartDevice(device.id, patch);
    } catch {
      refresh();
    }
  }

  function toggle(device) {
    return applyChange(device, { is_on: !device.is_on });
  }

  function setBrightness(device, brightness) {
    return applyChange(device, { brightness });
  }

  if (devices.length === 0) return null;

  return (
    <div className="topbar-smarthome-group">
      {devices.map((device) =>
        device.platform === 'lg_thinq' ? (
          <HeaderThinqChip key={device.id} device={device} />
        ) : (
          <HeaderToggle key={device.id} device={device} onToggle={toggle} onSetBrightness={setBrightness} />
        )
      )}
    </div>
  );
}
