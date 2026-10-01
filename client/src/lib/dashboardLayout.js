const KEY = 'familyhub.dashboardLayout.v1';
const WIDGETS_KEY = 'familyhub.dashboardWidgets.v1';
const COLORS_KEY = 'familyhub.dashboardColors.v1';
const LOCKED_KEY = 'familyhub.dashboardLocked.v1';

// The catalog of every widget the Home dashboard can show, in the order
// they're offered in Settings - independent of DEFAULT_LAYOUT's ids so
// Settings has a human label for each one.
export const WIDGET_CATALOG = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'weather', label: 'Weather' },
  { id: 'chores', label: 'Chores' },
  { id: 'daily', label: 'Daily Checklist' },
  { id: 'meals', label: 'Dinner & Lunch' },
  { id: 'shopping', label: 'Shopping List' },
  { id: 'whiteboard', label: 'Whiteboard' },
  { id: 'smarthome', label: 'Smart Home' },
  { id: 'music', label: 'Music' },
  { id: 'avatar_member_1', label: 'Member 1 Avatar' },
  { id: 'avatar_member_2', label: 'Member 2 Avatar' },
  { id: 'avatar_member_3', label: 'Member 3 Avatar' },
];

// x/y/w/h are in grid units (12 columns wide). Sized for the "daily
// briefing" dashboard - today/tomorrow-focused, condensed widgets - rather
// than the old full-week views; each one expands to full detail on its own
// tabbed page. `page` (0 or 1) is which of the two swipeable Home pages a
// widget lives on - every default widget starts on page 0 so an existing,
// already-customized device sees no change; page 1 starts empty and is
// populated by moving widgets onto it from Settings -> Dashboard Widgets.
export const DEFAULT_LAYOUT = [
  { i: 'calendar', x: 0, y: 0, w: 8, h: 15, minW: 3, minH: 6, page: 0 },
  { i: 'weather', x: 8, y: 0, w: 4, h: 5, minW: 2, minH: 3, page: 0 },
  // Chores/Daily show a status line plus up to 4 items (or one big tile in
  // Carousel mode); Shopping stays at 3 items plus its quick-add row. Meals
  // is taller than it used to be - each of its 5 day boxes now carries a
  // lunch row (see MealPlanner.jsx) on top of the dinner input.
  { i: 'chores', x: 8, y: 5, w: 4, h: 7, minW: 2, minH: 2, page: 0 },
  { i: 'daily', x: 8, y: 12, w: 4, h: 7, minW: 2, minH: 2, page: 0 },
  { i: 'meals', x: 8, y: 19, w: 4, h: 9, minW: 2, minH: 4, page: 0 },
  { i: 'shopping', x: 8, y: 28, w: 4, h: 6, minW: 2, minH: 2, page: 0 },
  { i: 'whiteboard', x: 8, y: 34, w: 4, h: 8, minW: 2, minH: 4, page: 0 },
  { i: 'smarthome', x: 8, y: 42, w: 4, h: 7, minW: 2, minH: 3, page: 0 },
  { i: 'music', x: 8, y: 49, w: 4, h: 6, minW: 2, minH: 3, page: 0 },
  // Small enough to tuck into a corner or a narrow column - just a name and
  // a circle, no content that needs real width or height to be useful.
  { i: 'avatar_member_1', x: 0, y: 15, w: 3, h: 6, minW: 2, minH: 4, page: 0 },
  { i: 'avatar_member_2', x: 3, y: 15, w: 3, h: 6, minW: 2, minH: 4, page: 0 },
  // w: 2, not 3 - the three avatars share the calendar's 8 columns; a third
  // 3-wide tile would spill into column 8 and overlap the right-hand widgets.
  { i: 'avatar_member_3', x: 6, y: 15, w: 2, h: 6, minW: 2, minH: 4, page: 0 },
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
      // A layout saved before the swipeable second page existed has no
      // `page` field at all - treat that the same as page 0, exactly where
      // every widget already visually was.
      if (saved) kept.push({ ...saved, page: saved.page ?? 0 });
      else newOnes.push(defaultItem);
    }
    if (newOnes.length === 0) return kept;

    // A new widget's raw default x/y can overlap oddly with an already-
    // customized layout, so stack new ones below everything else on page 0
    // (where every new-widget default lives) instead - vertical compaction
    // then settles the exact positions.
    let cursor = kept
      .filter((item) => item.page === 0)
      .reduce((max, item) => Math.max(max, item.y + item.h), 0);
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

// Which of the two swipeable Home pages a widget currently lives on.
export function getWidgetPage(id) {
  const item = getDashboardLayout().find((it) => it.i === id);
  return item?.page ?? 0;
}

// Moves a widget to the other page without disturbing its x/y/w/h - it keeps
// its size and just needs a spot on the new page, so it's dropped at the
// bottom of whatever's already there rather than at its old (likely
// occupied) coordinates.
export function setWidgetPage(id, page) {
  const layout = getDashboardLayout();
  const item = layout.find((it) => it.i === id);
  if (!item || item.page === page) return;
  const cursor = layout
    .filter((it) => it.page === page)
    .reduce((max, it) => Math.max(max, it.y + it.h), 0);
  const next = layout.map((it) => (it.i === id ? { ...it, page, x: 0, y: cursor } : it));
  setDashboardLayout(next);
}

// Which widgets show on the Home dashboard at all, separate from where
// they're positioned - per-device like the layout itself, since a phone
// might reasonably want a smaller set than the kitchen kiosk. Everything
// is shown by default (a missing/blank entry means "not customized yet",
// not "hide everything").
export function getEnabledWidgets() {
  try {
    const raw = localStorage.getItem(WIDGETS_KEY);
    if (!raw) return new Set(WIDGET_CATALOG.map((w) => w.id));
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set(WIDGET_CATALOG.map((w) => w.id));
    return new Set(parsed);
  } catch {
    return new Set(WIDGET_CATALOG.map((w) => w.id));
  }
}

export function setEnabledWidgets(idsSet) {
  try {
    localStorage.setItem(WIDGETS_KEY, JSON.stringify([...idsSet]));
  } catch {
    // private browsing / storage blocked - choice just won't persist on this device
  }
}

// Per-widget background color override, keyed by widget id - per-device like
// the layout/enabled-widgets choices above. A widget with no entry here just
// uses the theme's normal card color (and still follows day/night switching);
// picking a color here pins that one widget to it regardless of theme.
export function getWidgetColors() {
  try {
    const raw = localStorage.getItem(COLORS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function setWidgetColors(colors) {
  try {
    localStorage.setItem(COLORS_KEY, JSON.stringify(colors));
  } catch {
    // private browsing / storage blocked - choice just won't persist on this device
  }
}

// Per-device, like the layout itself - freezes every widget on the Home
// dashboard against dragging/resizing (kids on a touchscreen, an accidental
// long-press) without touching anything about the widgets' own content or
// their saved positions/sizes, which stay exactly where they were left.
export function getDashboardLocked() {
  try {
    return localStorage.getItem(LOCKED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setDashboardLocked(locked) {
  try {
    localStorage.setItem(LOCKED_KEY, locked ? 'true' : 'false');
  } catch {
    // private browsing / storage blocked - choice just won't persist on this device
  }
}

// Settings -> Dashboard Widgets' "Reset to default layout" button - restores
// this device's positions/sizes, turns every widget back on, and clears any
// custom widget colors, undoing everything from the Home dashboard in one step.
export function resetDashboardLayout() {
  setDashboardLayout(DEFAULT_LAYOUT);
  const allIds = new Set(WIDGET_CATALOG.map((w) => w.id));
  setEnabledWidgets(allIds);
  setWidgetColors({});
  return allIds;
}
