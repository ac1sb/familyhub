import { useEffect, useRef, useState } from 'react';
import { usePolling } from '../hooks/usePolling.js';
import { api } from '../api.js';

const HOLD_MS = 450;

function HeaderToggle({ device, onToggle, onSetBrightness }) {
  const [showDimmer, setShowDimmer] = useState(false);
  const timerRef = useRef(null);
  const heldRef = useRef(false);
  const wrapRef = useRef(null);

  function startPress(e) {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    heldRef.current = false;
    if (!device.dimmable) return; // nothing to show on hold - a plain tap is all it does
    timerRef.current = setTimeout(() => {
      heldRef.current = true;
      setShowDimmer(true);
    }, HOLD_MS);
  }

  function endPress() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!heldRef.current) onToggle(device);
  }

  function cancelPress() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

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
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={cancelPress}
        onPointerCancel={cancelPress}
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
      {devices.map((device) => (
        <HeaderToggle key={device.id} device={device} onToggle={toggle} onSetBrightness={setBrightness} />
      ))}
    </div>
  );
}
