import { useEffect, useState } from 'react';

// Re-renders once a minute, right on the minute - an interval started at an
// arbitrary second would leave a minute-precision clock up to 59s behind.
// Re-aligns every tick, so timer drift never accumulates.
export function useMinuteClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let id;
    function schedule() {
      id = setTimeout(() => {
        setNow(new Date());
        schedule();
      }, 60000 - (Date.now() % 60000) + 50);
    }
    schedule();
    return () => clearTimeout(id);
  }, []);
  return now;
}
