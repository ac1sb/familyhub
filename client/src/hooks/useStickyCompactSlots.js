import { useLayoutEffect, useState } from 'react';

// Keeps up to `limit` items pinned in stable slots for a compact "glance"
// widget (Chores/Daily Checklist on the dashboard). Checking an item off
// marks it done and shows its strikethrough right where it already was,
// instead of yanking it out of view the instant it's checked. A displayed
// item only rolls off - replaced by the next not-yet-shown open item - once
// there's an open item waiting that isn't already being shown; with `limit`
// or fewer items total there's never anything waiting, so nothing ever
// rolls off and everything just accumulates strikethroughs in place.
//
// useLayoutEffect (not useEffect) so this settles before the browser paints -
// otherwise the very first render after data loads would briefly flash an
// empty widget before the initial slots got picked.
export function useStickyCompactSlots(items, limit) {
  const [displayedIds, setDisplayedIds] = useState([]);

  useLayoutEffect(() => {
    setDisplayedIds((prevIds) => {
      const byId = new Map(items.map((i) => [i.id, i]));
      let ids = prevIds.filter((id) => byId.has(id));
      const shown = new Set(ids);
      const waiting = items.filter((i) => !i.done && !shown.has(i.id));

      // A displayed slot whose item is now done gives up its spot to the
      // next waiting (not yet shown, still open) item, if any.
      ids = ids.map((id) => {
        const item = byId.get(id);
        if (item.done && waiting.length > 0) {
          const next = waiting.shift();
          shown.add(next.id);
          return next.id;
        }
        return id;
      });

      // Fill any empty slots (first load, or a slot's item was deleted).
      while (ids.length < limit && waiting.length > 0) {
        const next = waiting.shift();
        ids.push(next.id);
        shown.add(next.id);
      }

      const unchanged = ids.length === prevIds.length && ids.every((id, i) => id === prevIds[i]);
      return unchanged ? prevIds : ids;
    });
  }, [items, limit]);

  const byId = new Map(items.map((i) => [i.id, i]));
  return displayedIds.map((id) => byId.get(id)).filter(Boolean);
}
