import { getSetting, setSetting } from './settings.js';

// Household member names and the weather zip code are editable from the
// Settings page at runtime; the DB-stored value (if any) always wins over
// the .env default, so a restart never reverts what someone typed in there.
export function getMemberNames() {
  return {
    member_1: getSetting('member_1_name') || process.env.MEMBER_1_NAME || 'Mom',
    member_2: getSetting('member_2_name') || process.env.MEMBER_2_NAME || 'Dad',
    member_3: getSetting('member_3_name') || process.env.MEMBER_3_NAME || 'Child',
  };
}

export function setMemberNames({ member_1, member_2, member_3 }) {
  if (member_1 !== undefined) setSetting('member_1_name', member_1);
  if (member_2 !== undefined) setSetting('member_2_name', member_2);
  if (member_3 !== undefined) setSetting('member_3_name', member_3);
}

export function getWeatherZip() {
  return getSetting('weather_zip') || process.env.WEATHER_ZIP || '05255';
}

export function setWeatherZip(zip) {
  setSetting('weather_zip', zip);
}

// Day/night theme: 'auto' switches based on dark_start/dark_end (HH:MM, local
// time on whatever device is viewing), 'light'/'dark' pin it regardless of time.
export function getThemeSettings() {
  return {
    theme_mode: getSetting('theme_mode') || 'auto',
    dark_start: getSetting('dark_start') || '19:00',
    dark_end: getSetting('dark_end') || '07:00',
  };
}

export function setThemeSettings({ theme_mode, dark_start, dark_end }) {
  if (theme_mode !== undefined) setSetting('theme_mode', theme_mode);
  if (dark_start !== undefined) setSetting('dark_start', dark_start);
  if (dark_end !== undefined) setSetting('dark_end', dark_end);
}

export function getMenuImportUrl() {
  // Same DB-wins-over-.env-default pattern as the weather zip/member names -
  // set LUNCH_MENU_URL once in server/.env so a fresh install (a new machine,
  // a reset database) already has the school's menu configured instead of
  // needing it re-pasted into Settings. The `date=` part of the URL doesn't
  // matter either way - fetchMenuItems() always overrides it with the
  // current + next couple of months, so this never needs updating by hand.
  return getSetting('menu_import_url') || process.env.LUNCH_MENU_URL || '';
}

export function setMenuImportUrl(url) {
  setSetting('menu_import_url', url);
}
