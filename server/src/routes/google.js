import { Router } from 'express';
import { google } from 'googleapis';
import { getJSON, setJSON, getSetting } from '../lib/settings.js';

const router = Router();

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

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

export default router;
