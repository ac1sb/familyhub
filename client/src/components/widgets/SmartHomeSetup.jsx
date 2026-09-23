import { useState } from 'react';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';

const PLATFORM_LABEL = { lifx: 'LIFX', caseta: 'Lutron Caseta' };
const KIND_LABEL = { light: 'Color light', dimmer: 'Dimmer switch', switch: 'On/off switch' };

export default function SmartHomeSetup() {
  const { data, refresh } = usePolling(() => api.smartDevices(), [], 20000);
  const [name, setName] = useState('');
  const [room, setRoom] = useState('');
  const [platform, setPlatform] = useState('lifx');
  const [kind, setKind] = useState('dimmer');

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
    <div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: 0 }}>
        Add the Caseta switches and LIFX bulbs you want to show up on the Smart Home widget. This is
        currently a mockup - devices added here are controlled locally (toggle/brightness/color are
        saved) but nothing is sent to a real bulb or bridge yet.
      </p>

      {devices.map((device) => (
        <div className="chore-row" key={device.id}>
          <span className="chore-title">{device.name}</span>
          {device.room && <span className="chore-tag family">{device.room}</span>}
          <span className="chore-tag family">{PLATFORM_LABEL[device.platform]}</span>
          <span className="chore-tag family">{KIND_LABEL[device.kind]}</span>
          <button className="btn-icon" onClick={() => removeDevice(device.id)}>✕</button>
        </div>
      ))}
      {data && devices.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>No devices added yet.</p>}

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
    </div>
  );
}
