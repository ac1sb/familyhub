const KEY = 'familyhub.dashboardBackground.v1';

// Per-device, like every other dashboard display choice - a phone doesn't
// need the same (or any) background as the wall display.
const DEFAULTS = {
  mode: 'off', // 'off' | 'static' | 'rotating'
  theme: 'landscapes',
  intervalMinutes: 10,
  // The currently-chosen photo (for 'static') or the last one fetched (for
  // 'rotating', mostly so there's something to show immediately on mount
  // instead of a blank flash before the first fetch resolves). Cleared to
  // force a refetch - e.g. Settings' "New Photo" button, or a theme change.
  photo: null,
  // How opaque each widget's frosted background is (0 = fully see-through to
  // the photo, 100 = fully solid, no photo showing through at all).
  frostOpacity: 55,
};

export function getDashboardBackgroundSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setDashboardBackgroundSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // private browsing / storage blocked - choice just won't persist on this device
  }
}
