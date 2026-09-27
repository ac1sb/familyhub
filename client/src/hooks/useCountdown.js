import { useEffect, useRef, useState } from 'react';

// Ticks a "minutes remaining" value (as reported by a device polled every
// several seconds, e.g. a washer/dryer's timer) down to the second on the
// client, so it reads as a live countdown instead of a number that only
// changes on the next poll. Resyncs to whatever fresh value comes in -
// null/undefined (not running, or unknown) just stops the clock.
export function useCountdown(remainMinutes) {
  const [msLeft, setMsLeft] = useState(remainMinutes != null ? remainMinutes * 60000 : null);
  const endsAtRef = useRef(null);

  useEffect(() => {
    if (remainMinutes == null) {
      endsAtRef.current = null;
      setMsLeft(null);
      return undefined;
    }
    endsAtRef.current = Date.now() + remainMinutes * 60000;
    setMsLeft(remainMinutes * 60000);

    const id = setInterval(() => {
      setMsLeft(Math.max(0, endsAtRef.current - Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, [remainMinutes]);

  return msLeft;
}

export function formatCountdown(ms) {
  if (ms == null) return null;
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : m;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
