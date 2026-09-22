import { useEffect, useRef, useState } from 'react';

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'pointerdown', 'touchstart', 'keydown', 'wheel'];

// Reports idle=true once `idleMs` has passed with no user interaction anywhere
// in the app. Pass enabled=false to fully disable listening (e.g. screensaver off).
export function useIdleTimer(idleMs, enabled) {
  const [idle, setIdle] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      setIdle(false);
      return undefined;
    }

    function resetTimer() {
      setIdle(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setIdle(true), idleMs);
    }

    resetTimer();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [idleMs, enabled]);

  return idle;
}
