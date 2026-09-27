import { useEffect, useRef, useState } from 'react';
import { usePolling } from '../../hooks/usePolling.js';
import { usePressHold } from '../../hooks/usePressHold.js';
import { useCountdown, formatCountdown } from '../../hooks/useCountdown.js';
import { api } from '../../api.js';

const PLATFORM_ICON = { lifx: '💡', caseta: '🔘', lg_thinq: '🧺' };

// A LIFX bulb's color is whatever the person (or the bulb itself) picked -
// unlike the app's own curated palette (member colors, chore tags), it's
// not guaranteed to contrast with white text. A light color (a bulb set to
// white/daylight, easy to hit) would otherwise render as pale text on a
// near-white tile.
function pickTextColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#fff';
  const int = parseInt(m[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  const luminance = (r * 299 + g * 587 + b * 114) / 1000;
  return luminance > 175 ? '#1a1a1a' : '#fff';
}

function groupByRoom(devices) {
  const groups = new Map();
  for (const device of devices) {
    const room = device.room || 'Other';
    if (!groups.has(room)) groups.set(room, []);
    groups.get(room).push(device);
  }
  return [...groups.entries()];
}

// The washer/dryer tile: read-only status, plus a live ticking countdown
// (not just whatever number the last poll happened to report) while it's
// actually running - hidden entirely otherwise, since a remaining time on a
// finished or idle cycle isn't meaningful.
function ThinqTile({ device }) {
  const isRunning = device.state === 'Running';
  const msLeft = useCountdown(isRunning ? device.remainMinutes : null);

  return (
    <div className={`smart-tile thinq${device.thinq_error ? ' error' : ''}`}>
      <span className="smart-tile-icon">{PLATFORM_ICON.lg_thinq}</span>
      <span className="smart-tile-name">{device.name}</span>
      <span className="smart-tile-status">{device.thinq_error ? `⚠️ ${device.thinq_error}` : device.state || 'Unknown'}</span>
      {isRunning && msLeft != null && <span className="smart-tile-timer">⏱ {formatCountdown(msLeft)}</span>}
    </div>
  );
}

function DeviceTile({ device, onToggle, onBrightness, onColor }) {
  const [showPopover, setShowPopover] = useState(false);
  const wrapRef = useRef(null);
  const hasPopover = device.dimmable || device.color_capable;

  const pressHandlers = usePressHold(() => onToggle(device), () => setShowPopover(true), {
    enabled: hasPopover,
  });

  // Tapping anywhere outside the popover closes it, same as the header's
  // own dimmer popover.
  useEffect(() => {
    if (!showPopover) return;
    function handleOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowPopover(false);
    }
    document.addEventListener('pointerdown', handleOutside, true);
    return () => document.removeEventListener('pointerdown', handleOutside, true);
  }, [showPopover]);

  if (device.platform === 'lg_thinq') return <ThinqTile device={device} />;

  return (
    <div className="smart-tile-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`smart-tile${device.is_on ? ' on' : ''}`}
        style={
          device.is_on && device.color_capable
            ? { '--tile-on-color': device.color, '--tile-on-text': pickTextColor(device.color) }
            : undefined
        }
        {...pressHandlers}
        title={hasPopover ? 'Tap to toggle - press and hold to adjust' : 'Tap to toggle'}
      >
        <span className="smart-tile-icon">{PLATFORM_ICON[device.platform] || '🔌'}</span>
        <span className="smart-tile-name">{device.name}</span>
        {device.room && <span className="smart-tile-room">{device.room}</span>}
      </button>

      {showPopover && (
        <div className="header-toggle-popover smart-tile-popover">
          <div className="header-toggle-popover-title">{device.name}</div>
          {device.dimmable && (
            <input
              type="range"
              min={1}
              max={100}
              value={device.brightness}
              onChange={(e) => onBrightness(device, Number(e.target.value))}
              title="Brightness"
            />
          )}
          {device.color_capable && (
            <input
              type="color"
              className="smart-device-color"
              value={device.color}
              onChange={(e) => onColor(device, e.target.value)}
              title="Color"
            />
          )}
          <button type="button" className="btn-link" onClick={() => setShowPopover(false)}>Done</button>
        </div>
      )}
    </div>
  );
}

export default function SmartHomeWidget({ compact = false, onExpand }) {
  const { data, setData, refresh } = usePolling(() => api.smartDevices(), [], 15000);
  const [deviceError, setDeviceError] = useState(null);
  const devices = data?.devices || [];

  function patchLocal(id, patch) {
    setData((prev) => ({
      devices: prev.devices.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    }));
  }

  // A real LIFX call can fail (bulb offline, bad token, ...) where the old
  // local-only mock never could - on failure, undo the optimistic patch by
  // re-fetching the server's actual (unchanged) state instead of leaving
  // the tile showing something that never really happened.
  async function applyChange(device, patch) {
    patchLocal(device.id, patch);
    try {
      await api.updateSmartDevice(device.id, patch);
      setDeviceError(null);
      refresh();
    } catch (err) {
      setDeviceError(`${device.name}: ${err.message}`);
      refresh();
    }
  }

  function toggleOn(device) {
    return applyChange(device, { is_on: !device.is_on });
  }

  function setBrightness(device, brightness) {
    return applyChange(device, { brightness });
  }

  function setColor(device, color) {
    return applyChange(device, { color });
  }

  const tileProps = { onToggle: toggleOn, onBrightness: setBrightness, onColor: setColor };

  return (
    <section className={`widget-card${compact ? ' compact' : ''}`}>
      <div className="widget-header">
        <h2>Smart Home</h2>
        {compact && onExpand && <button className="see-all" onClick={onExpand}>See all &rarr;</button>}
      </div>

      {data && devices.length === 0 && (
        <p style={{ color: 'var(--color-text-muted)' }}>
          No devices yet. Add your Caseta switches, LIFX bulbs, or LG appliances in Settings &rarr; Smart Home Setup.
        </p>
      )}

      {deviceError && <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>⚠️ {deviceError}</p>}

      {compact
        ? (
          <div className="smart-tile-grid">
            {devices.map((device) => (
              <DeviceTile key={device.id} device={device} {...tileProps} />
            ))}
          </div>
        )
        : groupByRoom(devices).map(([room, roomDevices]) => (
            <div className="smart-room-group" key={room}>
              <h3 className="smart-room-title">{room}</h3>
              <div className="smart-tile-grid">
                {roomDevices.map((device) => (
                  <DeviceTile key={device.id} device={device} {...tileProps} />
                ))}
              </div>
            </div>
          ))}

      {!compact && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: 10, marginBottom: 0 }}>
          A LIFX bulb added via Discover (Settings &rarr; Smart Home Setup) is real - tap to toggle,
          press and hold to adjust brightness/color. Caseta switches and manually-typed devices are
          still a local-only mockup with nothing behind them yet. An LG ThinQ washer/dryer shows its
          real status (fetched fresh each time) with a live countdown while it's running - status
          only, no remote control.
        </p>
      )}
    </section>
  );
}
