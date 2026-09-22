function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Handles overnight ranges (e.g. dark 19:00 -> 07:00) where start > end.
export function isNightNow(theme, now = new Date()) {
  if (!theme || theme.theme_mode === 'light') return false;
  if (theme.theme_mode === 'dark') return true;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const start = toMinutes(theme.dark_start || '19:00');
  const end = toMinutes(theme.dark_end || '07:00');

  if (start === end) return false;
  if (start < end) return nowMinutes >= start && nowMinutes < end;
  return nowMinutes >= start || nowMinutes < end;
}
