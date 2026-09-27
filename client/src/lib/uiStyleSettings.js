const KEY = 'familyhub.uiStyle.v1';
const VALID_STYLES = new Set(['flat', 'soft', 'tactile']);

// Per-device, like the dashboard display-mode/background settings - purely a
// look-and-feel choice, so there's no reason to force it to match across
// every phone and the wall display.
export function getUiStyle() {
  try {
    const raw = localStorage.getItem(KEY);
    return VALID_STYLES.has(raw) ? raw : 'flat';
  } catch {
    return 'flat';
  }
}

export function setUiStyle(style) {
  const next = VALID_STYLES.has(style) ? style : 'flat';
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // private browsing / storage blocked - choice just won't persist on this device
  }
  return next;
}
