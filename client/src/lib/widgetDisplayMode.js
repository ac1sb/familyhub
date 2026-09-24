const KEY = 'familyhub.widgetDisplayMode.v2';

// Per-device, per-widget (like the widget colors) - controls how a widget
// shows its items on the dashboard: a stacked list of tiles, or one big
// tile at a time you swipe through. Chores and Daily Checklist can each be
// set independently - e.g. Chores as a list, Daily Checklist as a carousel.
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
  return getModes()[widgetId] === 'carousel' ? 'carousel' : 'list';
}

export function setWidgetDisplayMode(widgetId, mode) {
  try {
    const next = { ...getModes(), [widgetId]: mode === 'carousel' ? 'carousel' : 'list' };
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // private browsing / storage blocked - choice just won't persist on this device
  }
}
