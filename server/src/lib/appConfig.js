import crypto from 'node:crypto';
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

// One avatar per member: a color (always set, used behind the initial letter
// when there's no photo) and an optional uploaded photo, which takes over
// from the initial once set. Defaults match the member badge colors used
// elsewhere (Calendar, Meal Planner) so a fresh avatar isn't a jarring
// mismatch with colors already associated with that person, though the two
// are otherwise independent - changing one doesn't touch the other.
const DEFAULT_AVATAR_COLORS = { member_1: '#c04d76', member_2: '#4678ac', member_3: '#d9a441' };
const AVATAR_MEMBERS = ['member_1', 'member_2', 'member_3'];

export function getMemberAvatars() {
  const stored = getJSON('member_avatars', null);
  const result = {};
  for (const member of AVATAR_MEMBERS) {
    result[member] = {
      color: stored?.[member]?.color || DEFAULT_AVATAR_COLORS[member],
      photo: stored?.[member]?.photo || null,
    };
  }
  return result;
}

// Merges a partial update ({ color } and/or { photo }) into one member's
// avatar, leaving the other member's avatars and this one's other field
// untouched - so a color change never has to also resend the photo path (or
// vice versa).
export function setMemberAvatar(member, patch) {
  const current = getMemberAvatars();
  current[member] = { ...current[member], ...patch };
  setJSON('member_avatars', current);
  return current;
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
  return [{ url: legacyUrl, member: getSetting('ical_events_member') || 'family', label: '' }];
}

export function setIcalFeeds(feeds) {
  // Drop half-filled "add another feed" rows (no URL typed yet) instead of
  // saving them as phantom entries. label is optional, free-text, purely a
  // reminder for whoever's looking at Settings later ("whose calendar is
  // this cryptic ics URL again?") - never sent anywhere or shown on the
  // agenda itself.
  const cleaned = feeds
    .map((f) => ({ url: (f.url || '').trim(), member: f.member || 'family', label: (f.label || '').trim() }))
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

// Per-parent calendar IDs for member_1/member_2 - lets an event assigned to
// that person push onto their own personal Google Calendar (shared with the
// OAuth account as an editor) instead of the single shared calendar above.
// Only the two adult member slots get their own field; a member_3 event
// (assumed to be the child, who has no Google account) pushes onto BOTH of
// these calendars instead of needing one of its own. Left blank, a member's
// events simply don't push anywhere until their calendar ID is set here.
export function getGoogleMemberCalendars() {
  return {
    member_1: getSetting('google_calendar_id_member_1') || '',
    member_2: getSetting('google_calendar_id_member_2') || '',
  };
}

export function setGoogleMemberCalendars({ member_1, member_2 }) {
  if (member_1 !== undefined) setSetting('google_calendar_id_member_1', member_1);
  if (member_2 !== undefined) setSetting('google_calendar_id_member_2', member_2);
}

// The Google Sheet the shopping list syncs with (the "Sync with Sheet"
// button on the full page) - just the spreadsheet ID/URL, same
// DB-wins-over-.env pattern as the lunch menu import URL. The sync itself
// only touches columns F/G of the spreadsheet's first tab (see
// routes/google.js), and only ever fills in blank cells on either side -
// never clobbers unrelated content in the same sheet, never deletes anything.
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

// One or more Google Drive folder IDs the "Family Photos" screensaver
// overlay syncs from - a list, so photos from more than one shared folder
// mix into the same rotation. Requires the same Google account connected
// in Settings -> Calendar (needs the drive.readonly scope - reconnect if it
// was connected before this was added). See routes/google.js's Drive
// functions.
export function getFamilyPhotoFolders() {
  const stored = getJSON('family_photo_folders', null);
  return Array.isArray(stored) ? stored : [];
}

export function setFamilyPhotoFolders(folders) {
  // Drop half-filled "add another folder" rows (nothing typed yet) instead
  // of saving them as phantom entries, same as the shared calendar feeds list.
  const cleaned = (folders || []).map((f) => (f || '').trim()).filter(Boolean);
  setJSON('family_photo_folders', cleaned);
}

// A single Google Drive folder (same account as Family Photos/the shopping
// sheet) that gets watched for meal-plan screenshots - e.g. a delivery
// service's order-slip photo, dropped in from a phone. skip_day is which
// day of the week never gets a meal written to it when a synced photo's
// recipes are applied (0=Mon..6=Sun) - defaults to Saturday (5), the day
// after a Friday delivery that's typically not part of the rotation.
export function getMealPlanPhotoSettings() {
  const stored = getJSON('meal_plan_photo_settings', null);
  return {
    folderId: stored?.folderId || '',
    skipDay: Number.isInteger(stored?.skipDay) ? stored.skipDay : 5,
  };
}

export function setMealPlanPhotoSettings({ folderId, skipDay }) {
  const existing = getMealPlanPhotoSettings();
  setJSON('meal_plan_photo_settings', {
    folderId: folderId !== undefined ? folderId.trim() : existing.folderId,
    skipDay: Number.isInteger(skipDay) ? Math.max(0, Math.min(6, skipDay)) : existing.skipDay,
  });
  return getMealPlanPhotoSettings();
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

// LG ThinQ Connect (thinq.developer.lge.com) - a Personal Access Token plus a
// self-chosen client ID (any random UUID; LG just asks that each integration
// use its own, generated once and reused, rather than a fresh one per
// request) and the country the appliances are registered in, which decides
// which of LG's three regional API gateways to call. Only used for read-only
// washer/dryer status (see lib/lgThinq.js), never control.
export function getLgThinqSettings() {
  return getJSON('lg_thinq_settings', null) || { pat: '', clientId: '', country: 'US' };
}

export function setLgThinqSettings({ pat, country }) {
  const existing = getLgThinqSettings();
  setJSON('lg_thinq_settings', {
    pat: pat !== undefined ? pat.trim() : existing.pat,
    country: country !== undefined ? country.trim().toUpperCase() : existing.country || 'US',
    // Generated once on first save and kept stable after that - LG asks
    // integrations not to mint a new client ID on every request.
    clientId: existing.clientId || crypto.randomUUID(),
  });
  return getLgThinqSettings();
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
