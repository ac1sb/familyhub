import { useEffect, useRef } from 'react';
import { api } from '../api.js';

const ADJUST_WRITE_DELAY_MS = 250;

// Shared by the header strip and the Smart Home widget. On/off goes out
// immediately. Brightness/color come from a slider or color picker that fires
// on every step of a drag, so those update the tile instantly but only send
// the latest value once the drag pauses - one bulb call per adjustment
// instead of dozens. A failed write re-fetches the real state to undo the
// optimistic update (a real LIFX bulb can be offline; the old mock never was).
export function useSmartDeviceControls({ setData, refresh, onError, onSuccess }) {
  const pendingRef = useRef(new Map());

  function patchLocal(id, patch) {
    setData((prev) => (prev ? { ...prev, devices: prev.devices.map((d) => (d.id === id ? { ...d, ...patch } : d)) } : prev));
  }

  async function send(device, patch) {
    try {
      await api.updateSmartDevice(device.id, patch);
      onSuccess?.();
    } catch (err) {
      onError?.(device, err);
      refresh();
    }
  }

  function adjust(device, patch) {
    patchLocal(device.id, patch);
    const key = `${device.id}:${Object.keys(patch).join(',')}`;
    const pending = pendingRef.current.get(key);
    if (pending) clearTimeout(pending.timer);
    const timer = setTimeout(() => {
      pendingRef.current.delete(key);
      send(device, patch);
    }, ADJUST_WRITE_DELAY_MS);
    pendingRef.current.set(key, { timer, device, patch });
  }

  // Navigating away mid-adjustment still sends the last value.
  useEffect(() => () => {
    for (const { timer, device, patch } of pendingRef.current.values()) {
      clearTimeout(timer);
      api.updateSmartDevice(device.id, patch).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    toggle(device) {
      patchLocal(device.id, { is_on: !device.is_on });
      return send(device, { is_on: !device.is_on });
    },
    setBrightness: (device, brightness) => adjust(device, { brightness }),
    setColor: (device, color) => adjust(device, { color }),
  };
}
