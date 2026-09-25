import { Router } from 'express';
import { google } from 'googleapis';
import { getJSON, setJSON } from '../lib/settings.js';
import { getGoogleCalendarId, getGoogleEventsMember } from '../lib/appConfig.js';

const router = Router();

// calendar.events covers both reading and writing events (insert/update/
// delete) - it does NOT grant access to calendar settings/sharing, just the
// events on calendars the account can already see. spreadsheets covers
// reading and writing Sheets the account can already see (used to push the
// shopping list). A connection made before either scope was added only has
// the narrower access - disconnecting and reconnecting re-prompts Google's
// consent screen for the current full set.
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/spreadsheets',
];

function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;

  const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const tokens = getJSON('google_tokens', null);
  if (tokens) client.setCredentials(tokens);

  client.on('tokens', (newTokens) => {
    const merged = { ...(getJSON('google_tokens', {}) || {}), ...newTokens };
    setJSON('google_tokens', merged);
  });

  return client;
}

router.get('/status', (req, res) => {
  const configured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const connected = !!getJSON('google_tokens', null);
  res.json({ configured, connected });
});

router.get('/auth-url', (req, res) => {
  const client = getOAuthClient();
  if (!client) return res.status(400).json({ error: 'Google OAuth is not configured on the server' });
  const url = client.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPES });
  res.json({ url });
});

router.get('/oauth2callback', async (req, res) => {
  const client = getOAuthClient();
  if (!client) return res.status(400).send('Google OAuth is not configured on the server');
  try {
    const { tokens } = await client.getToken(req.query.code);
    setJSON('google_tokens', tokens);
    res.send('<html><body>Google Calendar connected. You can close this tab and return to FamilyHub.</body></html>');
  } catch (err) {
    res.status(500).send(`Google OAuth failed: ${err.message}`);
  }
});

router.post('/disconnect', (req, res) => {
  setJSON('google_tokens', null);
  res.status(204).end();
});

// Used by routes/events.js to merge Google Calendar events into the agenda view.
export async function fetchGoogleEvents(rangeStart, rangeEnd) {
  const client = getOAuthClient();
  if (!client || !getJSON('google_tokens', null)) return [];

  const calendar = google.calendar({ version: 'v3', auth: client });
  const result = await calendar.events.list({
    calendarId: 'primary',
    timeMin: rangeStart.toISOString(),
    timeMax: rangeEnd.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 100,
  });

  const member = getGoogleEventsMember();
  return (result.data.items || []).map((ev) => ({
    id: `google-${ev.id}`,
    title: ev.summary || '(untitled)',
    description: ev.description || '',
    location: ev.location || '',
    member,
    source: 'google',
    google_event_id: ev.id,
    all_day: !ev.start?.dateTime,
    recurring: false,
    recurrence_days: [],
    occurrence_start: ev.start?.dateTime || `${ev.start?.date}T00:00:00`,
    occurrence_end: ev.end?.dateTime || (ev.end?.date ? `${ev.end.date}T00:00:00` : null),
  }));
}

export function isGoogleWriteEnabled() {
  return !!(getOAuthClient() && getJSON('google_tokens', null));
}

function toGoogleEventResource(event) {
  const resource = { summary: event.title, description: event.description || undefined, location: event.location || undefined };
  const endSource = event.end_datetime || event.start_datetime;
  if (event.all_day) {
    resource.start = { date: event.start_datetime.slice(0, 10) };
    resource.end = { date: endSource.slice(0, 10) };
  } else {
    resource.start = { dateTime: new Date(event.start_datetime).toISOString() };
    resource.end = { dateTime: new Date(endSource).toISOString() };
  }
  return resource;
}

// Mirrors a locally-created event onto Google Calendar - used by
// routes/events.js right after a local INSERT so the two stay in sync
// without the user having to enter it twice. Returns the new Google event
// id (stored back on the local row as google_event_id) or null if Google
// isn't connected, so the caller can just skip syncing silently.
export async function pushEventToGoogle(event) {
  const client = getOAuthClient();
  if (!client || !getJSON('google_tokens', null)) return null;
  const calendar = google.calendar({ version: 'v3', auth: client });
  const result = await calendar.events.insert({
    calendarId: getGoogleCalendarId(),
    requestBody: toGoogleEventResource(event),
  });
  return result.data.id;
}

export async function updateGoogleEvent(googleEventId, event) {
  const client = getOAuthClient();
  if (!client || !getJSON('google_tokens', null)) return;
  const calendar = google.calendar({ version: 'v3', auth: client });
  await calendar.events.update({
    calendarId: getGoogleCalendarId(),
    eventId: googleEventId,
    requestBody: toGoogleEventResource(event),
  });
}

export async function deleteGoogleEvent(googleEventId) {
  const client = getOAuthClient();
  if (!client || !getJSON('google_tokens', null)) return;
  const calendar = google.calendar({ version: 'v3', auth: client });
  try {
    await calendar.events.delete({ calendarId: getGoogleCalendarId(), eventId: googleEventId });
  } catch (err) {
    // Already gone on Google's side (someone deleted it there too) - fine.
    if (err.code !== 410 && err.code !== 404) throw err;
  }
}

const SHOPPING_TAB_NAME = 'FamilyHub';

function getSheetsClient() {
  const client = getOAuthClient();
  if (!client || !getJSON('google_tokens', null)) {
    throw new Error('Google account not connected - connect it in Settings first');
  }
  return google.sheets({ version: 'v4', auth: client });
}

// Column A is the item name (freely editable by anyone); column B is the
// FamilyHub item id that ties a row back to a row in the local database -
// present so a synced-and-unchanged item is never mistaken for a fresh one
// (and re-imported as a duplicate) or pushed out again as a new row. A
// person typing a new row by hand just leaves column B blank, same as an
// older tab written by a previous version of this sync that never had an
// id column at all - both read the same way: "not linked yet".
async function ensureShoppingTab(sheets, sheetId) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const hasTab = (meta.data.sheets || []).some((s) => s.properties?.title === SHOPPING_TAB_NAME);
  if (!hasTab) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: SHOPPING_TAB_NAME } } }] },
    });
  }
  // Idempotent either way - also fixes up an older tab's single-column
  // header (from before this sync became two-way) to the current shape.
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${SHOPPING_TAB_NAME}!A1:B1`,
    valueInputOption: 'RAW',
    requestBody: { values: [['Item', 'ID (auto - do not edit)']] },
  });
}

// Reads every data row (skipping the header) as { rowNumber, name, id } -
// rowNumber is the real 1-indexed sheet row, so callers can write back to
// exactly that row later. id is null when column B is blank or unparsable.
export async function readShoppingSheetRows(sheetId) {
  const sheets = getSheetsClient();
  await ensureShoppingTab(sheets, sheetId);
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${SHOPPING_TAB_NAME}!A2:B`,
  });
  const values = result.data.values || [];
  return values
    .map((row, i) => ({
      rowNumber: i + 2,
      name: (row[0] || '').trim(),
      id: row[1] ? Number(row[1]) : null,
    }))
    .filter((r) => r.name);
}

// Writes back the two things a sync can produce, neither of which removes
// or overwrites an existing row: idUpdates fills in column B for rows that
// turned out to match an existing (or newly-created) local item, and
// newRows appends local items that didn't already have a row in the sheet.
export async function writeShoppingSheetUpdates(sheetId, { idUpdates = [], newRows = [] } = {}) {
  const sheets = getSheetsClient();
  if (idUpdates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: idUpdates.map((u) => ({
          range: `${SHOPPING_TAB_NAME}!B${u.rowNumber}`,
          values: [[u.id]],
        })),
      },
    });
  }
  if (newRows.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${SHOPPING_TAB_NAME}!A:B`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: newRows.map((r) => [r.name, r.id]) },
    });
  }
}

export default router;
