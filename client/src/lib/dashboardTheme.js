const KEY = 'familyhub.dashboardTheme.v1';

// Per-device, like every other dashboard display choice. Each theme bundles
// a color palette, a background (a layered CSS gradient, so it always
// renders instantly with no network fetch - see styles.css for the actual
// gradients/colors), and a widget-card treatment (flat, or glass/frosted
// with a glossy highlight) - all scoped to the Home dashboard only via
// [data-dashboard-theme] in styles.css, never the rest of the app. 'classic'
// is the existing look and needs no CSS of its own, so it's always safe as
// the default for a device that's never chosen one.
export const DASHBOARD_THEMES = [
  { id: 'classic', label: 'Classic', description: 'The original look - flat cards, no background.' },
  { id: 'midnight', label: 'Midnight', description: 'Deep navy/violet glass with a cool blue glow.' },
  { id: 'sunset', label: 'Sunset', description: 'Warm dusk gradient with amber-tinted glass.' },
  { id: 'aqua', label: 'Aqua', description: 'Ocean-teal gradient with cyan glass widgets.' },
];

export function getDashboardTheme() {
  try {
    const saved = localStorage.getItem(KEY);
    return DASHBOARD_THEMES.some((t) => t.id === saved) ? saved : 'classic';
  } catch {
    return 'classic';
  }
}

export function setDashboardTheme(theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // private browsing / storage blocked - choice just won't persist on this device
  }
}
