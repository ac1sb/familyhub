const KEY = 'familyhub.screensaver.v1';

export const THEMES = [
  { id: 'landscapes', label: 'Landscapes' },
  { id: 'mountains', label: 'Mountains' },
  { id: 'waterfalls', label: 'Waterfalls' },
  { id: 'lakes', label: 'Lakes' },
  { id: 'forests', label: 'Forests' },
];

const DEFAULTS = {
  // Per-device on purpose: there's no reliable way to tell "this is the wall
  // display" from "this is someone's phone" automatically, so it defaults off
  // everywhere and gets turned on locally on the device that should run it.
  enabled: false,
  idleMinutes: 10,
  photoIntervalSeconds: 30,
  theme: 'landscapes',
};

export function getScreensaverSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setScreensaverSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // private browsing / storage blocked - screensaver just won't persist on this device
  }
}
