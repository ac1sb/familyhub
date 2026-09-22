const KEY = 'familyhub.dashboardLayout.v1';

// x/y/w/h are in grid units (12 columns wide); roughly mirrors the previous
// fixed 2fr:1fr layout (calendar w=8 of 12 ≈ 2/3, the rest w=4 ≈ 1/3).
export const DEFAULT_LAYOUT = [
  { i: 'calendar', x: 0, y: 0, w: 8, h: 20, minW: 3, minH: 6 },
  { i: 'weather', x: 8, y: 0, w: 4, h: 6, minW: 2, minH: 3 },
  { i: 'lunch', x: 8, y: 6, w: 4, h: 6, minW: 2, minH: 3 },
  { i: 'chores', x: 8, y: 12, w: 4, h: 7, minW: 2, minH: 3 },
  { i: 'meals', x: 8, y: 19, w: 4, h: 7, minW: 2, minH: 3 },
  { i: 'shopping', x: 8, y: 26, w: 4, h: 7, minW: 2, minH: 3 },
];

export function getDashboardLayout() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_LAYOUT;
    // If a future update adds/removes a dashboard widget, fall back to the
    // default rather than rendering a layout missing an entry.
    const ids = new Set(parsed.map((item) => item.i));
    if (!DEFAULT_LAYOUT.every((item) => ids.has(item.i))) return DEFAULT_LAYOUT;
    return parsed;
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
