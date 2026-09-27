import { Router } from 'express';
import db from '../db.js';
import { getLifxToken, setLifxToken, getLgThinqSettings, setLgThinqSettings } from '../lib/appConfig.js';
import { listLifxLights, setLifxState } from '../lib/lifx.js';
import { listThinqDevices, getThinqDeviceStatus, humanizeThinqStatus, LAUNDRY_DEVICE_TYPES } from '../lib/lgThinq.js';

const router = Router();

// A 'lifx' device with external_id set is wired to a real bulb - toggling/
// dimming/coloring it calls the LIFX Cloud API (see the try/catch in the
// PUT route below). A 'lg_thinq' device is read-only - its washer/dryer
// status is fetched fresh on every list request (see the Promise.all below)
// rather than cached in this table, so there's nothing here to go stale.
// Everything else - no external_id, or platform 'caseta' (no real Lutron
// integration exists yet) - stays the original mock behavior: only this
// table is read/written, no network call.
function serialize(row) {
  return {
    ...row,
    dimmable: !!row.dimmable,
    color_capable: !!row.color_capable,
    is_on: !!row.is_on,
  };
}

async function withThinqStatus(row) {
  if (row.platform !== 'lg_thinq' || !row.external_id) return row;
  const settings = getLgThinqSettings();
  if (!settings.pat) return { ...row, thinq_error: 'Not connected' };
  try {
    const status = await getThinqDeviceStatus(settings, row.external_id);
    return { ...row, ...humanizeThinqStatus(status) };
  } catch (err) {
    return { ...row, thinq_error: err.message };
  }
}

router.get('/', async (req, res) => {
  const rows = db.prepare('SELECT * FROM smart_devices ORDER BY room ASC, sort_order ASC, id ASC').all();
  const withStatus = await Promise.all(rows.map(withThinqStatus));
  res.json({ devices: withStatus.map(serialize) });
});

// GET /api/smart-devices/lg-thinq/settings -> whether a Personal Access
// Token is saved (and which country), so the setup page can show
// connected/not without the token itself ever coming back down to the client.
router.get('/lg-thinq/settings', (req, res) => {
  const { pat, country } = getLgThinqSettings();
  res.json({ connected: !!pat, country: country || 'US' });
});

router.post('/lg-thinq/settings', (req, res) => {
  const { pat, country } = setLgThinqSettings({ pat: req.body.pat, country: req.body.country });
  res.json({ connected: !!pat, country: country || 'US' });
});

// GET /api/smart-devices/lg-thinq/discover -> every washer/dryer on the
// account that isn't already linked to a local device, same "one-tap Add
// candidate" idea as the LIFX discover route.
router.get('/lg-thinq/discover', async (req, res) => {
  const settings = getLgThinqSettings();
  if (!settings.pat) {
    return res.status(400).json({ error: 'No LG ThinQ Personal Access Token saved yet - add one in Smart Home Setup first' });
  }

  try {
    const devices = await listThinqDevices(settings);
    const linkedIds = new Set(
      db.prepare("SELECT external_id FROM smart_devices WHERE platform = 'lg_thinq' AND external_id IS NOT NULL").all()
        .map((r) => r.external_id)
    );
    const candidates = devices
      .filter((d) => LAUNDRY_DEVICE_TYPES.has(d.deviceInfo?.deviceType) && !linkedIds.has(d.deviceId))
      .map((d) => ({
        external_id: d.deviceId,
        label: d.deviceInfo?.alias || d.deviceInfo?.modelName || 'LG appliance',
        kind: d.deviceInfo.deviceType.includes('DRYER') ? 'dryer' : 'washer',
      }));
    res.json({ devices: candidates });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// GET /api/smart-devices/lifx/settings -> whether a token is saved, so the
// setup page can show connected/not without ever sending the token itself
// back down to the client.
router.get('/lifx/settings', (req, res) => {
  res.json({ connected: !!getLifxToken() });
});

router.post('/lifx/settings', (req, res) => {
  setLifxToken((req.body.token || '').trim());
  res.json({ connected: !!getLifxToken() });
});

// GET /api/smart-devices/lifx/discover -> every light on the LIFX account
// that isn't already linked to a local device, so Settings -> Smart Home
// Setup can offer them as one-tap "Add" candidates instead of the person
// having to type a name in by hand and hope it matches.
router.get('/lifx/discover', async (req, res) => {
  const token = getLifxToken();
  if (!token) return res.status(400).json({ error: 'No LIFX API token saved yet - add one in Smart Home Setup first' });

  try {
    const lights = await listLifxLights(token);
    const linkedIds = new Set(
      db.prepare("SELECT external_id FROM smart_devices WHERE platform = 'lifx' AND external_id IS NOT NULL").all()
        .map((r) => r.external_id)
    );
    const candidates = lights
      .map((l) => ({
        external_id: `id:${l.id}`,
        label: l.label,
        group: l.group?.name || '',
        is_on: l.power === 'on',
      }))
      .filter((l) => !linkedIds.has(l.external_id));
    res.json({ lights: candidates });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  const { name, room = '', platform, external_id = null } = req.body;
  if (!name || !platform) return res.status(400).json({ error: 'name and platform are required' });
  if (!['lifx', 'caseta', 'lg_thinq'].includes(platform)) {
    return res.status(400).json({ error: 'platform must be lifx, caseta, or lg_thinq' });
  }

  // LIFX bulbs (the color line this integration targets) are always dimmable and
  // color-capable; Caseta covers plain on/off switches and dimmer switches,
  // never color; LG ThinQ washers/dryers are read-only status, never either.
  const kind =
    platform === 'lifx' ? 'light' : platform === 'lg_thinq' ? (req.body.kind === 'dryer' ? 'dryer' : 'washer') : req.body.kind === 'dimmer' ? 'dimmer' : 'switch';
  const dimmable = platform === 'lifx' || kind === 'dimmer' ? 1 : 0;
  const color_capable = platform === 'lifx' ? 1 : 0;

  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM smart_devices').get().m;
  const info = db
    .prepare(
      'INSERT INTO smart_devices (name, room, platform, kind, dimmable, color_capable, external_id, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(name, room, platform, kind, dimmable, color_capable, platform === 'lifx' || platform === 'lg_thinq' ? external_id : null, maxOrder + 1);

  const row = db.prepare('SELECT * FROM smart_devices WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(serialize(row));
});

router.put('/:id', async (req, res) => {
  const existing = db.prepare('SELECT * FROM smart_devices WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });

  const merged = {
    name: req.body.name ?? existing.name,
    room: req.body.room ?? existing.room,
    is_on: req.body.is_on !== undefined ? (req.body.is_on ? 1 : 0) : existing.is_on,
    brightness:
      req.body.brightness !== undefined
        ? Math.max(0, Math.min(100, Number(req.body.brightness)))
        : existing.brightness,
    color: req.body.color ?? existing.color,
  };

  // A real bulb: push only the fields this request actually touched out to
  // LIFX first, and only write the local row if that succeeds - so a
  // toggle that failed (bulb offline, bad token, ...) doesn't leave
  // FamilyHub showing a state the bulb was never actually set to.
  if (existing.platform === 'lifx' && existing.external_id) {
    const token = getLifxToken();
    if (!token) return res.status(400).json({ error: 'No LIFX API token saved - add one in Smart Home Setup' });
    try {
      await setLifxState(token, existing.external_id, {
        isOn: req.body.is_on !== undefined ? !!req.body.is_on : undefined,
        brightness: req.body.brightness !== undefined ? merged.brightness : undefined,
        color: req.body.color !== undefined ? merged.color : undefined,
      });
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  }

  db.prepare(
    'UPDATE smart_devices SET name=@name, room=@room, is_on=@is_on, brightness=@brightness, color=@color WHERE id=@id'
  ).run({ ...merged, id: req.params.id });

  const row = db.prepare('SELECT * FROM smart_devices WHERE id = ?').get(req.params.id);
  res.json(serialize(row));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM smart_devices WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
