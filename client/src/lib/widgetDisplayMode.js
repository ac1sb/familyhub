const KEY = 'familyhub.widgetDisplayMode.v1';

// Per-device (like the rest of the dashboard layout choices) - controls how
// Chores/Daily Checklist show their items on the dashboard: a stacked list
// of tiles, or one big tile at a time you swipe through.
export function getWidgetDisplayMode() {
  try {
    return localStorage.getItem(KEY) === 'carousel' ? 'carousel' : 'list';
  } catch {
    return 'list';
  }
}

export function setWidgetDisplayMode(mode) {
  try {
    localStorage.setItem(KEY, mode === 'carousel' ? 'carousel' : 'list');
  } catch {
    // private browsing / storage blocked - choice just won't persist on this device
  }
}
