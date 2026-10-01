import { useCallback, useEffect, useRef, useState } from 'react';

// Polls a fetcher on an interval so changes made from other devices (phone, tablet, etc.)
// show up on this display without a manual refresh. Returns data plus a manual refresh + local mutate.
//
// Only the newest request's response is ever applied - when deps change
// (e.g. paging the calendar to another week) a slower, older response that
// lands afterwards would otherwise overwrite the newer data with the wrong
// week. Polling also pauses while the page is hidden (a backgrounded phone
// tab) and catches up immediately when it's shown again.
export function usePolling(fetcher, deps = [], intervalMs = 15000) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const latestRequestRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++latestRequestRef.current;
    try {
      const result = await fetcherRef.current();
      if (requestId !== latestRequestRef.current) return;
      setData(result);
      setError(null);
    } catch (err) {
      if (requestId !== latestRequestRef.current) return;
      setError(err);
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh();
    const id = setInterval(() => {
      if (!document.hidden) refresh();
    }, intervalMs);
    function handleVisibility() {
      if (!document.hidden) refresh();
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', handleVisibility);
      // Invalidate anything still in flight for the old deps.
      latestRequestRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, intervalMs]);

  return { data, setData, error, loading, refresh };
}
