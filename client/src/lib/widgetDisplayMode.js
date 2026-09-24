const KEY = 'familyhub.widgetDisplayMode.v2';
const VALID_MODES = new Set(['list', 'squares', 'carousel']);

// Per-device, per-widget (like the widget colors) - controls how a widget
// shows its items on the dashboard: stacked full-width bars, a grid of
// small square tiles, or one big tile at a time you swipe through. Chores
// and Daily Checklist can each be set independently - e.g. Chores as a
// list, Daily Checklist as a carousel. New display styles get added here as
// an extra option rather than replacing an old one outright, so someone who
// likes the old look can keep it side by side with the new one.
function getModes() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getWidgetDisplayMode(widgetId) {
  const mode = getModes()[widgetId];
  return VALID_MODES.has(mode) ? mode : 'list';
}

export function setWidgetDisplayMode(widgetId, mode) {
  try {
    const next = { ...getModes(), [widgetId]: VALID_MODES.has(mode) ? mode : 'list' };
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // private browsing / storage blocked - choice just won't persist on this device
  }
}
