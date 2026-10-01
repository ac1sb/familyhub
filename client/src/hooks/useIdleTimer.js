import { useEffect, useRef, useState } from 'react';

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'pointerdown', 'touchstart', 'keydown', 'wheel'];
// mousemove fires many times a second - restarting the countdown more than
// once a second buys nothing for a timeout measured in minutes.
const RESET_THROTTLE_MS = 1000;

// Reports idle=true once `idleMs` has passed with no user interaction anywhere
// in the app. Pass enabled=false to fully disable listening (e.g. screensaver off).
export function useIdleTimer(idleMs, enabled) {
  const [idle, setIdle] = useState(false);
  const timerRef = useRef(null);
  const idleRef = useRef(false);
  const lastResetRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      idleRef.current = false;
      setIdle(false);
      return undefined;
    }

    function startTimer() {
      if (timerRef.current) clearTimeout(timerRef.current);
      lastResetRef.current = Date.now();
      timerRef.current = setTimeout(() => {
        idleRef.current = true;
        setIdle(true);
      }, idleMs);
    }

    function handleActivity() {
      if (idleRef.current) {
        idleRef.current = false;
        setIdle(false);
      } else if (Date.now() - lastResetRef.current < RESET_THROTTLE_MS) {
        return;
      }
      startTimer();
    }

    idleRef.current = false;
    setIdle(false);
    startTimer();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, handleActivity));
    };
  }, [idleMs, enabled]);

  return idle;
}
