const KEY = 'familyhub.lunchPageView.v1';
const VALID_MODES = new Set(['square', 'list']);

// Per-device, like every other display choice - the full Lunch page can
// show the month as a calendar grid of (roughly) square day cells - the
// original layout, now stretched to fill the screen - or as a plain
// scrollable list (one row per school day, full-width menu text), which
// reads better for long entree names than a small grid cell can.
export function getLunchPageView() {
  try {
    const raw = localStorage.getItem(KEY);
    return VALID_MODES.has(raw) ? raw : 'square';
  } catch {
    return 'square';
  }
}

export function setLunchPageView(mode) {
  try {
    localStorage.setItem(KEY, VALID_MODES.has(mode) ? mode : 'square');
  } catch {
    // private browsing / storage blocked - choice just won't persist on this device
  }
}
