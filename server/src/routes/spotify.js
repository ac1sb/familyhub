import { Router } from 'express';
import { getJSON, setJSON } from '../lib/settings.js';

const router = Router();

// user-read-playback-state/user-modify-playback-state/user-read-currently-
// playing cover reading and controlling whatever device is active,
// including one running librespot - no "streaming" scope, since FamilyHub
// never plays audio itself, only tells Spotify which already-registered
// device (the Pi) should. playlist-read-private/-collaborative are only for
// listing the account's own playlists on the Music page, so a saved one can
// be started directly instead of always resuming whatever played last.
const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative',
];

function isConfigured() {
  return !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET && process.env.SPOTIFY_REDIRECT_URI);
}

// Refreshes and persists the access token when it's expired or about to be -
// Spotify's tokens are short-lived (an hour) unlike Google's, so control
// actions refresh far more often than the Calendar/Sheets connection does.
async function getAccessToken() {
  const tokens = getJSON('spotify_tokens', null);
  if (!tokens) throw new Error('Spotify isn\'t connected - connect it in Settings first');

  if (tokens.expires_at && Date.now() < tokens.expires_at - 30000) {
    return tokens.access_token;
  }

  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token }),
  });
  if (!resp.ok) {
    throw new Error(`Spotify token refresh failed (HTTP ${resp.status}) - try disconnecting and reconnecting`);
  }
  const data = await resp.json();
  const merged = {
    ...tokens,
    access_token: data.access_token,
    // A refresh doesn't always come back with a new refresh_token - keep
    // the existing one when it doesn't.
    refresh_token: data.refresh_token || tokens.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
  setJSON('spotify_tokens', merged);
  return merged.access_token;
}

// Every call into the Spotify Web API goes through here - attaches the
// (auto-refreshed) bearer token and turns Spotify's "204/no body" and error
// shapes into something callers can just await.
async function spotifyFetch(path, options = {}) {
  const accessToken = await getAccessToken();
  const resp = await fetch(`https://api.spotify.com/v1${path}`, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${accessToken}` },
  });
  if (resp.status === 204 || resp.status === 202) return null;
  if (resp.status === 404) {
    const body = await resp.json().catch(() => null);
    if (body?.error?.reason === 'NO_ACTIVE_DEVICE') {
      throw new Error('No active Spotify device - pick one below (the Pi shows up once librespot is running)');
    }
    throw new Error(body?.error?.message || 'Spotify device not found');
  }
  if (!resp.ok) {
    const body = await resp.json().catch(() => null);
    throw new Error(body?.error?.message || `Spotify request failed (HTTP ${resp.status})`);
  }
  const text = await resp.text();
  return text ? JSON.parse(text) : null;
}

router.get('/status', (req, res) => {
  res.json({ configured: isConfigured(), connected: !!getJSON('spotify_tokens', null) });
});

router.get('/auth-url', (req, res) => {
  if (!isConfigured()) return res.status(400).json({ error: 'Spotify is not configured on the server' });
  const url = new URL('https://accounts.spotify.com/authorize');
  url.searchParams.set('client_id', process.env.SPOTIFY_CLIENT_ID);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', process.env.SPOTIFY_REDIRECT_URI);
  url.searchParams.set('scope', SCOPES.join(' '));
  res.json({ url: url.toString() });
});

router.get('/oauth2callback', async (req, res) => {
  if (!isConfigured()) return res.status(400).send('Spotify is not configured on the server');
  if (req.query.error) return res.status(400).send(`Spotify authorization failed: ${req.query.error}`);

  try {
    const resp = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: req.query.code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
      }),
    });
    if (!resp.ok) throw new Error(`token exchange failed (HTTP ${resp.status})`);
    const data = await resp.json();
    setJSON('spotify_tokens', {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
    });
    res.send('<html><body>Spotify connected. You can close this tab and return to FamilyHub.</body></html>');
  } catch (err) {
    res.status(500).send(`Spotify authorization failed: ${err.message}`);
  }
});

router.post('/disconnect', (req, res) => {
  setJSON('spotify_tokens', null);
  res.status(204).end();
});

// GET /api/spotify/now-playing -> current track/device state, or
// { playing: false } when nothing is playing anywhere on the account -
// that's a normal Spotify response (204 from their API), not an error.
router.get('/now-playing', async (req, res) => {
  try {
    const data = await spotifyFetch('/me/player');
    if (!data) return res.json({ playing: false });

    const track = data.item;
    res.json({
      playing: true,
      isPlaying: data.is_playing,
      progressMs: data.progress_ms,
      device: data.device && {
        id: data.device.id,
        name: data.device.name,
        type: data.device.type,
        volumePercent: data.device.volume_percent,
      },
      track: track && {
        name: track.name,
        artists: (track.artists || []).map((a) => a.name).join(', '),
        album: track.album?.name,
        albumArtUrl: track.album?.images?.[0]?.url,
        durationMs: track.duration_ms,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/devices', async (req, res) => {
  try {
    const data = await spotifyFetch('/me/player/devices');
    const devices = (data?.devices || []).map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      isActive: d.is_active,
      volumePercent: d.volume_percent,
    }));
    res.json({ devices });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/spotify/transfer { deviceId } -> switches playback to that
// device (the Pi's librespot, most of the time) - starts it playing
// whatever that account's current/last context was, same as picking a
// device from Spotify's own "Connect to a device" list would.
router.post('/transfer', async (req, res) => {
  const { deviceId } = req.body;
  if (!deviceId) return res.status(400).json({ error: 'deviceId is required' });
  try {
    await spotifyFetch('/me/player', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_ids: [deviceId], play: true }),
    });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/spotify/playlists -> the account's own playlists (owned or
// followed), so the Music page can start one directly rather than only
// being able to resume whatever Spotify last remembers playing.
router.get('/playlists', async (req, res) => {
  try {
    const data = await spotifyFetch('/me/playlists?limit=50');
    const playlists = (data?.items || []).map((p) => ({
      id: p.id,
      name: p.name,
      uri: p.uri,
      imageUrl: p.images?.[0]?.url || null,
      trackCount: p.tracks?.total ?? null,
      owner: p.owner?.display_name || null,
    }));
    res.json({ playlists });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/spotify/play [{ contextUri, deviceId }] -> plain resume of
// whatever's currently active (needs an already-active device) when called
// with no body, same as before; passing contextUri + deviceId instead starts
// that specific playlist on that specific device even with nothing active
// anywhere yet - the actual "play something from FamilyHub" path.
router.post('/play', async (req, res) => {
  const { contextUri, deviceId } = req.body || {};
  try {
    const path = deviceId ? `/me/player/play?device_id=${encodeURIComponent(deviceId)}` : '/me/player/play';
    const body = contextUri ? { context_uri: contextUri } : undefined;
    await spotifyFetch(path, {
      method: 'PUT',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/pause', async (req, res) => {
  try {
    await spotifyFetch('/me/player/pause', { method: 'PUT' });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/next', async (req, res) => {
  try {
    await spotifyFetch('/me/player/next', { method: 'POST' });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/previous', async (req, res) => {
  try {
    await spotifyFetch('/me/player/previous', { method: 'POST' });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/volume', async (req, res) => {
  const { volumePercent } = req.body;
  if (volumePercent === undefined) return res.status(400).json({ error: 'volumePercent is required' });
  try {
    await spotifyFetch(`/me/player/volume?volume_percent=${Math.round(volumePercent)}`, { method: 'PUT' });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
