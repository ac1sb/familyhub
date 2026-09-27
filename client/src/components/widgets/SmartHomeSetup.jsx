import { useEffect, useState } from 'react';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';

const PLATFORM_LABEL = { lifx: 'LIFX', caseta: 'Lutron Caseta', lg_thinq: 'LG ThinQ' };
const KIND_LABEL = { light: 'Color light', dimmer: 'Dimmer switch', switch: 'On/off switch', washer: 'Washer', dryer: 'Dryer' };

function formatRemaining(minutes) {
  if (minutes == null) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

export default function SmartHomeSetup() {
  const { data, refresh } = usePolling(() => api.smartDevices(), [], 20000);
  const [name, setName] = useState('');
  const [room, setRoom] = useState('');
  const [platform, setPlatform] = useState('lifx');
  const [kind, setKind] = useState('dimmer');

  const [lifxConnected, setLifxConnected] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [savingToken, setSavingToken] = useState(false);
  const [candidates, setCandidates] = useState(null);
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState(null);

  const [thinqConnected, setThinqConnected] = useState(false);
  const [thinqCountry, setThinqCountry] = useState('US');
  const [thinqPatInput, setThinqPatInput] = useState('');
  const [savingThinqPat, setSavingThinqPat] = useState(false);
  const [thinqCandidates, setThinqCandidates] = useState(null);
  const [discoveringThinq, setDiscoveringThinq] = useState(false);
  const [thinqDiscoverError, setThinqDiscoverError] = useState(null);

  useEffect(() => {
    api.lifxSettings().then((r) => setLifxConnected(r.connected)).catch(() => {});
    api.lgThinqSettings().then((r) => {
      setThinqConnected(r.connected);
      setThinqCountry(r.country || 'US');
    }).catch(() => {});
  }, []);

  async function saveToken() {
    if (!tokenInput.trim()) return;
    setSavingToken(true);
    try {
      const r = await api.saveLifxToken(tokenInput.trim());
      setLifxConnected(r.connected);
      setTokenInput('');
    } finally {
      setSavingToken(false);
    }
  }

  async function discoverLights() {
    setDiscovering(true);
    setDiscoverError(null);
    setCandidates(null);
    try {
      const r = await api.discoverLifxLights();
      setCandidates(r.lights);
    } catch (err) {
      setDiscoverError(err.message);
    } finally {
      setDiscovering(false);
    }
  }

  async function addDiscoveredLight(light) {
    await api.createSmartDevice({
      name: light.label,
      room: light.group,
      platform: 'lifx',
      external_id: light.external_id,
    });
    setCandidates((prev) => prev.filter((l) => l.external_id !== light.external_id));
    refresh();
  }

  async function saveThinqPat() {
    if (!thinqPatInput.trim()) return;
    setSavingThinqPat(true);
    try {
      const r = await api.saveLgThinqSettings(thinqPatInput.trim(), thinqCountry);
      setThinqConnected(r.connected);
      setThinqPatInput('');
    } finally {
      setSavingThinqPat(false);
    }
  }

  async function discoverThinqDevices() {
    setDiscoveringThinq(true);
    setThinqDiscoverError(null);
    setThinqCandidates(null);
    try {
      const r = await api.discoverLgThinqDevices();
      setThinqCandidates(r.devices);
    } catch (err) {
      setThinqDiscoverError(err.message);
    } finally {
      setDiscoveringThinq(false);
    }
  }

  async function addDiscoveredThinqDevice(device) {
    await api.createSmartDevice({
      name: device.label,
      platform: 'lg_thinq',
      external_id: device.external_id,
      kind: device.kind,
    });
    setThinqCandidates((prev) => prev.filter((d) => d.external_id !== device.external_id));
    refresh();
  }

  async function addDevice() {
    if (!name.trim()) return;
    await api.createSmartDevice({ name: name.trim(), room: room.trim(), platform, kind });
    setName('');
    setRoom('');
    refresh();
  }

  async function removeDevice(id) {
    await api.deleteSmartDevice(id);
    refresh();
  }

  const devices = data?.devices || [];

  return (
    <div className="settings-content">
      <div className="settings-section">
        <div className="settings-section-title">LIFX</div>
        <p className="settings-section-intro">
          LIFX bulbs added via Discover below control a real bulb (toggle/brightness/color all call
          the LIFX Cloud API); Caseta and manually-typed devices are still a local-only mockup -
          nothing is sent to a real switch or bridge for those yet.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={`chore-tag ${lifxConnected ? 'family' : ''}`} style={!lifxConnected ? { background: 'var(--color-border)' } : undefined}>
            {lifxConnected ? '✅ Token saved' : 'Not connected'}
          </span>
          <input
            type="text"
            placeholder="LIFX Personal Access Token"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            style={{ flex: 1, minWidth: 220 }}
          />
          <button className="btn btn-secondary" onClick={saveToken} disabled={savingToken || !tokenInput.trim()}>
            {savingToken ? 'Saving…' : 'Save Token'}
          </button>
        </div>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: 6 }}>
          Get one at <strong>cloud.lifx.com/settings</strong> ("Generate New Token"). Saved server-side,
          never shown here again once saved.
        </p>

        {lifxConnected && (
          <>
            <button className="btn btn-secondary" onClick={discoverLights} disabled={discovering} style={{ marginTop: 4 }}>
              {discovering ? 'Looking…' : '🔍 Discover LIFX Lights'}
            </button>
            {discoverError && <p style={{ color: 'var(--color-danger)' }}>⚠️ {discoverError}</p>}
            {candidates && candidates.length === 0 && (
              <p style={{ color: 'var(--color-text-muted)' }}>No new lights found - every light on this account is already added, or there aren't any yet.</p>
            )}
            {candidates && candidates.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {candidates.map((light) => (
                  <div className="chore-row" key={light.external_id}>
                    <span className="chore-title">{light.label}</span>
                    {light.group && <span className="chore-tag family">{light.group}</span>}
                    <span className="chore-tag family">{light.is_on ? 'On' : 'Off'}</span>
                    <button className="btn btn-primary" onClick={() => addDiscoveredLight(light)}>Add</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="settings-section">
        <div className="settings-section-title">LG ThinQ (Washer/Dryer)</div>
        <p className="settings-section-intro">
          Read-only status - no remote start/stop, just whether it's running and how much time is
          left. Uses LG's official ThinQ Connect API with a Personal Access Token, not your regular
          LG account login. Generate one at{' '}
          <strong>thinq.developer.lge.com</strong> (Cloud Developer &rarr; Docs &rarr; ThinQ Connect
          &rarr; Personal Access Token) for the account the washer/dryer are registered to.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={`chore-tag ${thinqConnected ? 'family' : ''}`} style={!thinqConnected ? { background: 'var(--color-border)' } : undefined}>
            {thinqConnected ? '✅ Token saved' : 'Not connected'}
          </span>
          <input
            type="text"
            placeholder="LG ThinQ Personal Access Token"
            value={thinqPatInput}
            onChange={(e) => setThinqPatInput(e.target.value)}
            style={{ flex: 1, minWidth: 220 }}
          />
          <input
            type="text"
            placeholder="Country"
            value={thinqCountry}
            onChange={(e) => setThinqCountry(e.target.value.toUpperCase())}
            maxLength={2}
            style={{ width: 70 }}
            title="Two-letter country code the appliances are registered in, e.g. US"
          />
          <button className="btn btn-secondary" onClick={saveThinqPat} disabled={savingThinqPat || !thinqPatInput.trim()}>
            {savingThinqPat ? 'Saving…' : 'Save Token'}
          </button>
        </div>

        {thinqConnected && (
          <>
            <button className="btn btn-secondary" onClick={discoverThinqDevices} disabled={discoveringThinq} style={{ marginTop: 10 }}>
              {discoveringThinq ? 'Looking…' : '🔍 Discover LG Appliances'}
            </button>
            {thinqDiscoverError && <p style={{ color: 'var(--color-danger)' }}>⚠️ {thinqDiscoverError}</p>}
            {thinqCandidates && thinqCandidates.length === 0 && (
              <p style={{ color: 'var(--color-text-muted)' }}>No new washer/dryer found - already added, or none on this account.</p>
            )}
            {thinqCandidates && thinqCandidates.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {thinqCandidates.map((device) => (
                  <div className="chore-row" key={device.external_id}>
                    <span className="chore-title">{device.label}</span>
                    <span className="chore-tag family">{KIND_LABEL[device.kind]}</span>
                    <button className="btn btn-primary" onClick={() => addDiscoveredThinqDevice(device)}>Add</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Devices</div>
        {devices.map((device) => (
          <div className="chore-row" key={device.id}>
            <span className="chore-title">{device.name}</span>
            {device.room && <span className="chore-tag family">{device.room}</span>}
            <span className="chore-tag family">{PLATFORM_LABEL[device.platform]}</span>
            <span className="chore-tag family">{KIND_LABEL[device.kind]}</span>
            {device.platform === 'lifx' && device.external_id && <span className="chore-tag family">Connected</span>}
            {device.platform === 'lg_thinq' && (
              <span className="chore-tag family">
                {device.thinq_error ? `⚠️ ${device.thinq_error}` : [device.state, formatRemaining(device.remainMinutes)].filter(Boolean).join(' · ')}
              </span>
            )}
            <button className="btn-icon" onClick={() => removeDevice(device.id)}>✕</button>
          </div>
        ))}
        {data && devices.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>No devices added yet.</p>}
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Add a Device</div>
        <div className="add-row" style={{ flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="e.g. Living Room Lamp"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addDevice()}
          />
          <input
            type="text"
            placeholder="Room (optional)"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addDevice()}
          />
          <select
            value={platform}
            onChange={(e) => {
              setPlatform(e.target.value);
              if (e.target.value === 'lifx') setKind('light');
              else setKind('dimmer');
            }}
          >
            <option value="lifx">LIFX</option>
            <option value="caseta">Lutron Caseta</option>
          </select>
          {platform === 'caseta' && (
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="dimmer">Dimmer switch</option>
              <option value="switch">On/off switch</option>
            </select>
          )}
          <button className="btn btn-primary" onClick={addDevice}>Add</button>
        </div>
        <p className="settings-section-intro" style={{ marginTop: 8, marginBottom: 0 }}>
          Adding a LIFX device by typing its name here (instead of using Discover above) creates a
          local-only mock entry, same as Caseta - only Discover links it to a real bulb.
        </p>
      </div>
    </div>
  );
}
