import { useEffect, useRef, useState } from 'react';
import { usePolling } from '../hooks/usePolling.js';
import { usePressHold } from '../hooks/usePressHold.js';
import { useCountdown, formatCountdown } from '../hooks/useCountdown.js';
import { useSmartDeviceControls } from '../hooks/useSmartDeviceControls.js';
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
// last poll happened to report) while it's actually running.
function HeaderThinqChip({ device, collapsed }) {
  const isRunning = device.state === 'Running';
  const msLeft = useCountdown(isRunning ? device.remainMinutes : null);

  return (
    <div
      className={`header-toggle thinq-status${isRunning ? ' on' : ''}${collapsed ? ' chip-collapsed' : ''}`}
      title={device.name}
    >
      <span className="header-toggle-name">🧺 {device.name}</span>
      <span className="header-thinq-state">
        {device.thinq_error ? '⚠️' : device.state || 'Unknown'}
        {isRunning && msLeft != null ? ` · ${formatCountdown(msLeft)}` : ''}
      </span>
    </div>
  );
}

// How long a finished washer/dryer's chip stays up after its cycle ends,
// and how long the collapse/expand transition takes - kept in sync with the
// .chip-collapsed transition durations in styles.css.
const THINQ_DONE_VISIBLE_MS = 60 * 60 * 1000;
const THINQ_CHIP_TRANSITION_MS = 320;

function shouldShowThinqChip(device) {
  if (device.state === 'Running') return true;
  if (!device.thinq_finished_at) return false;
  const finishedMs = Date.parse(device.thinq_finished_at);
  if (Number.isNaN(finishedMs)) return false;
  return Date.now() - finishedMs < THINQ_DONE_VISIBLE_MS;
}

// Tracks which lg_thinq devices should currently render a header chip, and
// gives each one a brief 'entering'/'leaving' phase around that change so it
// can slide/fade in or out instead of just popping - the flex row it sits in
// naturally closes the gap left behind once a leaving chip is actually
// removed. Keyed by device id rather than holding the device objects
// themselves, so the caller can keep rendering off the live `devices` array
// (which always includes every device, shown or not) in its original order.
function useThinqChipTransitions(devices) {
  // The map lives in a ref, mutated in place, with a counter just to force a
  // re-render when it changes - not React state directly, because the
  // bookkeeping below (starting/cancelling timers, remembering which ids
  // were already known) is side-effecting, and a setState *updater*
  // function doing that breaks under React 18 Strict Mode, which invokes
  // updater functions twice and discards the first result: the ref mutation
  // from that discarded first call was still visible to the second call,
  // silently corrupting the real update.
  const mapRef = useRef(new Map());
  const knownRef = useRef(new Set());
  const timersRef = useRef(new Map());
  const [, setTick] = useState(0);
  const rerender = () => setTick((n) => n + 1);

  useEffect(() => () => {
    for (const t of timersRef.current.values()) clearTimeout(t);
  }, []);

  useEffect(() => {
    const wantedIds = new Set(
      devices.filter((d) => d.platform === 'lg_thinq' && shouldShowThinqChip(d)).map((d) => d.id)
    );
    const map = mapRef.current;
    let changed = false;

    for (const id of wantedIds) {
      if (!knownRef.current.has(id)) {
        map.set(id, 'entering');
        changed = true;
      } else if (map.get(id) === 'leaving') {
        // Started running again before its hour was up - cancel the exit.
        const t = timersRef.current.get(id);
        if (t) clearTimeout(t);
        timersRef.current.delete(id);
        map.delete(id);
        changed = true;
      }
    }

    for (const id of knownRef.current) {
      if (!wantedIds.has(id) && map.get(id) !== 'leaving') {
        map.set(id, 'leaving');
        changed = true;
        const timer = setTimeout(() => {
          mapRef.current.delete(id);
          timersRef.current.delete(id);
          rerender();
        }, THINQ_CHIP_TRANSITION_MS);
        timersRef.current.set(id, timer);
      }
    }

    knownRef.current = new Set([...wantedIds, ...map.keys()]);
    if (changed) rerender();
  }, [devices]);

  // Freshly-added chips start collapsed (see render below); flip them to
  // full size on the next frame so there's something for the CSS transition
  // to animate from. Runs after every render (cheap, and guarded below) since
  // it needs to react to entries this same hook just mutated into the map.
  useEffect(() => {
    if (![...mapRef.current.values()].includes('entering')) return;
    let raf2;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        let flipped = false;
        for (const [id, status] of mapRef.current) {
          if (status === 'entering') {
            mapRef.current.set(id, 'present');
            flipped = true;
          }
        }
        if (flipped) rerender();
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  });

  return mapRef.current;
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
  const thinqTransitions = useThinqChipTransitions(devices);
  const { toggle, setBrightness } = useSmartDeviceControls({ setData, refresh });

  const hasVisibleToggle = devices.some((d) => d.platform !== 'lg_thinq');
  if (!hasVisibleToggle && thinqTransitions.size === 0) return null;

  return (
    <div className="topbar-smarthome-group">
      {devices.map((device) => {
        if (device.platform !== 'lg_thinq') {
          return <HeaderToggle key={device.id} device={device} onToggle={toggle} onSetBrightness={setBrightness} />;
        }
        const status = thinqTransitions.get(device.id);
        if (!status) return null;
        return <HeaderThinqChip key={device.id} device={device} collapsed={status !== 'present'} />;
      })}
    </div>
  );
}
