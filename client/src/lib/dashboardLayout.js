const KEY = 'familyhub.dashboardLayout.v1';

// x/y/w/h are in grid units (12 columns wide). Sized for the "daily
// briefing" dashboard - today/tomorrow-focused, condensed widgets - rather
// than the old full-week views; each one expands to full detail on its own
// tabbed page.
export const DEFAULT_LAYOUT = [
  { i: 'calendar', x: 0, y: 0, w: 8, h: 15, minW: 3, minH: 6 },
  { i: 'weather', x: 8, y: 0, w: 4, h: 5, minW: 2, minH: 3 },
  { i: 'lunch', x: 8, y: 5, w: 4, h: 5, minW: 2, minH: 3 },
  { i: 'chores', x: 8, y: 10, w: 4, h: 7, minW: 2, minH: 3 },
  { i: 'daily', x: 8, y: 17, w: 4, h: 7, minW: 2, minH: 3 },
  { i: 'meals', x: 8, y: 24, w: 4, h: 6, minW: 2, minH: 3 },
  { i: 'shopping', x: 8, y: 30, w: 4, h: 7, minW: 2, minH: 3 },
  { i: 'whiteboard', x: 8, y: 37, w: 4, h: 8, minW: 2, minH: 4 },
  { i: 'smarthome', x: 8, y: 45, w: 4, h: 7, minW: 2, minH: 3 },
];

export function getDashboardLayout() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_LAYOUT;

    // Merge rather than discard: keep every saved position/size for a widget
    // that still exists, and slot in any new one introduced since this
    // layout was saved (e.g. an update adds a widget) below everything else
    // - a saved layout missing an entry used to mean the whole customization
    // got silently wiped back to defaults on the very next update that added
    // a dashboard widget.
    const savedById = new Map(parsed.map((item) => [item.i, item]));
    const kept = [];
    const newOnes = [];
    for (const defaultItem of DEFAULT_LAYOUT) {
      const saved = savedById.get(defaultItem.i);
      if (saved) kept.push(saved);
      else newOnes.push(defaultItem);
    }
    if (newOnes.length === 0) return kept;

    // A new widget's raw default x/y can overlap oddly with an already-
    // customized layout, so stack new ones below everything else instead -
    // vertical compaction then settles the exact positions.
    let cursor = kept.reduce((max, item) => Math.max(max, item.y + item.h), 0);
    for (const item of newOnes) {
      kept.push({ ...item, y: cursor });
      cursor += item.h;
    }
    return kept;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function setDashboardLayout(layout) {
  try {
    localStorage.setItem(KEY, JSON.stringify(layout));
  } catch {
    // private browsing / storage blocked - layout just won't persist on this device
  }
}
