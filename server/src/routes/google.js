import { Router } from 'express';
import { google } from 'googleapis';
import { getJSON, setJSON } from '../lib/settings.js';
import { getGoogleCalendarId } from '../lib/appConfig.js';

const router = Router();

// calendar.events covers both reading and writing events (insert/update/
// delete) - it does NOT grant access to calendar settings/sharing, just the
// events on calendars the account can already see. A connection made before
// this scope changed only has read access; disconnecting and reconnecting
// re-prompts Google's consent screen for the wider scope.
const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

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

  return (result.data.items || []).map((ev) => ({
    id: `google-${ev.id}`,
    title: ev.summary || '(untitled)',
    description: ev.description || '',
    location: ev.location || '',
    member: 'family',
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

export default router;
