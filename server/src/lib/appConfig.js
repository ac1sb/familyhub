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

// A calendar's "Secret address in iCal format" (Google Calendar -> that
// calendar's Settings -> "Integrate calendar") - a plain read-only .ics feed
// URL. Unlike the OAuth-based sync above, this needs no Google Cloud project
// or sign-in at all: knowing the secret URL IS the auth, so it's the easiest
// way to pull in a shared family calendar nobody wants to run OAuth for.
export function getIcalFeedUrl() {
  return getSetting('ical_feed_url') || process.env.ICAL_FEED_URL || '';
}

export function setIcalFeedUrl(url) {
  setSetting('ical_feed_url', url);
}

// Which Google calendar locally-created events get pushed to (see
// routes/google.js). Defaults to the signed-in account's own calendar;
// pushing to a shared family calendar instead means sharing that calendar
// with the OAuth account as an editor and pasting its Calendar ID here
// (Google Calendar -> that calendar's Settings -> "Integrate calendar").
export function getGoogleCalendarId() {
  return getSetting('google_calendar_id') || process.env.GOOGLE_CALENDAR_ID || 'primary';
}

export function setGoogleCalendarId(id) {
  setSetting('google_calendar_id', id);
}

// Which agenda column incoming synced events land in. Both default to
// 'family', which the agenda shows in every member's column - fine for a
// household-wide calendar, but a single person's personal Google Calendar
// (or a shared feed that's really just one person's schedule) usually reads
// better pinned to that one column instead of appearing three times over.
export function getGoogleEventsMember() {
  return getSetting('google_events_member') || 'family';
}

export function setGoogleEventsMember(member) {
  setSetting('google_events_member', member);
}

export function getIcalEventsMember() {
  return getSetting('ical_events_member') || 'family';
}

export function setIcalEventsMember(member) {
  setSetting('ical_events_member', member);
}
