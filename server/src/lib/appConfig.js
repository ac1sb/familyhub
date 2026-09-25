import { getSetting, setSetting, getJSON, setJSON } from './settings.js';

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

// Shared calendar feeds - each is a calendar's "Secret address in iCal
// format" (Google Calendar -> that calendar's Settings -> "Integrate
// calendar") paired with which agenda column its events land in. Unlike the
// OAuth-based sync below, this needs no Google Cloud project or sign-in at
// all: knowing the secret URL IS the auth, so it's the easiest way to pull
// in a family member's calendar nobody wants to run OAuth for - and since
// it's a list, one per person just means adding another entry.
export function getIcalFeeds() {
  const stored = getJSON('ical_feeds', null);
  if (Array.isArray(stored)) return stored;

  // One-time fallback for whoever set up the single feed URL/member this
  // list replaced (via Settings, or the old ICAL_FEED_URL env var) - not
  // written back, so a still-unconfigured install stays free to pick up a
  // later env var change instead of getting stuck on today's value.
  const legacyUrl = getSetting('ical_feed_url') || process.env.ICAL_FEED_URL || '';
  if (!legacyUrl) return [];
  return [{ url: legacyUrl, member: getSetting('ical_events_member') || 'family' }];
}

export function setIcalFeeds(feeds) {
  // Drop half-filled "add another feed" rows (no URL typed yet) instead of
  // saving them as phantom entries.
  const cleaned = feeds
    .map((f) => ({ url: (f.url || '').trim(), member: f.member || 'family' }))
    .filter((f) => f.url);
  setJSON('ical_feeds', cleaned);
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

// The Google Sheet the shopping list syncs with (the "Sync with Sheet"
// button on the full page) - just the spreadsheet ID/URL, same
// DB-wins-over-.env pattern as the lunch menu import URL. The sync itself
// always reads/writes a dedicated "FamilyHub" tab inside that spreadsheet
// (created if it doesn't exist yet) rather than whatever tab the person
// might already be using for something else, and only ever adds rows/items
// on either side - never clobbers unrelated content sitting in the same
// sheet, and never deletes anything already synced.
export function getShoppingSheetId() {
  return getSetting('shopping_sheet_id') || process.env.SHOPPING_SHEET_ID || '';
}

export function setShoppingSheetId(id) {
  setSetting('shopping_sheet_id', id);
}

// Sheets-only alternative to the OAuth connection above: a Google Cloud
// service account's credentials (its downloaded JSON key, pasted whole in
// Settings). Skips the browser sign-in and redirect URI entirely, which
// matters before a stable host/IP is settled - the shopping list sheet
// sync uses this instead of the OAuth connection whenever it's set, and
// falls back to OAuth otherwise. Only client_email and private_key are
// kept; the rest of the downloaded JSON isn't needed.
export function getGoogleServiceAccountKey() {
  return getJSON('google_service_account_key', null);
}

export function setGoogleServiceAccountKey(key) {
  setJSON('google_service_account_key', key);
}

// LIFX Cloud API personal access token (from cloud.lifx.com/settings) -
// lets the Smart Home widget/setup page discover and control real bulbs
// instead of the local-only mock. Same DB-wins-over-.env pattern as
// everything else here.
export function getLifxToken() {
  return getSetting('lifx_token') || process.env.LIFX_API_TOKEN || '';
}

export function setLifxToken(token) {
  setSetting('lifx_token', token);
}

// Which agenda column events from the OAuth-connected Google Calendar land
// in (each iCal feed above carries its own member instead). Defaults to
// 'family', which the agenda shows in every column - fine for a household-
// wide calendar, but a single person's own Google Calendar usually reads
// better pinned to just their column instead of appearing three times over.
export function getGoogleEventsMember() {
  return getSetting('google_events_member') || 'family';
}

export function setGoogleEventsMember(member) {
  setSetting('google_events_member', member);
}
