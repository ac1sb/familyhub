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
// a small brightness slider instead. Still the same mock backend as the
// Smart Home widget/page: nothing here talks to a real bulb or bridge yet.
export default function HeaderSmartHomeToggles() {
  const { data, setData } = usePolling(() => api.smartDevices(), [], 15000);
  const devices = data?.devices || [];

  function patchLocal(id, patch) {
    setData((prev) => ({ devices: prev.devices.map((d) => (d.id === id ? { ...d, ...patch } : d)) }));
  }

  async function toggle(device) {
    patchLocal(device.id, { is_on: !device.is_on });
    await api.updateSmartDevice(device.id, { is_on: !device.is_on });
  }

  async function setBrightness(device, brightness) {
    patchLocal(device.id, { brightness });
    await api.updateSmartDevice(device.id, { brightness });
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
