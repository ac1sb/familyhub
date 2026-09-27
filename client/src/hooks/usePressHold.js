import { useRef } from 'react';

const DEFAULT_HOLD_MS = 450;

// Tap vs. press-and-hold on the same element: a plain tap fires onTap;
// holding past holdMs fires onHold instead and suppresses the tap that
// would otherwise fire on release. Shared by the header smart-home toggles
// and the Smart Home widget's tiles - tap flips a device on/off, hold opens
// its dimmer/color popover.
export function usePressHold(onTap, onHold, { holdMs = DEFAULT_HOLD_MS, enabled = true } = {}) {
  const timerRef = useRef(null);
  const heldRef = useRef(false);

  function startPress(e) {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    heldRef.current = false;
    if (!enabled) return; // nothing to hold for - a plain tap is all it does
    timerRef.current = setTimeout(() => {
      heldRef.current = true;
      onHold();
    }, holdMs);
  }

  function endPress() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!heldRef.current) onTap();
  }

  function cancelPress() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  return { onPointerDown: startPress, onPointerUp: endPress, onPointerLeave: cancelPress, onPointerCancel: cancelPress };
}
