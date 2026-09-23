import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';

const PLATFORM_ICON = { lifx: '💡', caseta: '🔘' };

function groupByRoom(devices) {
  const groups = new Map();
  for (const device of devices) {
    const room = device.room || 'Other';
    if (!groups.has(room)) groups.set(room, []);
    groups.get(room).push(device);
  }
  return [...groups.entries()];
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <label className="toggle-switch">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="toggle-track">
        <span className="toggle-knob" />
      </span>
    </label>
  );
}

function DeviceRow({ device, onToggle, onBrightness, onColor, showRoom }) {
  return (
    <div className="smart-device-row">
      <div className="smart-device-main">
        <span className="smart-device-icon">{PLATFORM_ICON[device.platform] || '🔌'}</span>
        <div className="smart-device-name-col">
          <span className={`smart-device-name${device.is_on ? '' : ' off'}`}>{device.name}</span>
          {showRoom && device.room && <span className="smart-device-room">{device.room}</span>}
        </div>
        <ToggleSwitch checked={device.is_on} onChange={() => onToggle(device)} />
      </div>
      {(device.dimmable || device.color_capable) && (
        <div className="smart-device-controls">
          {device.dimmable && (
            <input
              type="range"
              className="smart-device-slider"
              min={1}
              max={100}
              value={device.brightness}
              onChange={(e) => onBrightness(device, Number(e.target.value))}
              title="Brightness"
            />
          )}
          {device.color_capable && (
            <input
              type="color"
              className="smart-device-color"
              value={device.color}
              onChange={(e) => onColor(device, e.target.value)}
              title="Color"
            />
          )}
        </div>
      )}
    </div>
  );
}

export default function SmartHomeWidget({ compact = false, onExpand }) {
  const { data, setData, refresh } = usePolling(() => api.smartDevices(), [], 15000);
  const devices = data?.devices || [];

  function patchLocal(id, patch) {
    setData((prev) => ({
      devices: prev.devices.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    }));
  }

  async function toggleOn(device) {
    patchLocal(device.id, { is_on: !device.is_on });
    await api.updateSmartDevice(device.id, { is_on: !device.is_on });
    refresh();
  }

  async function setBrightness(device, brightness) {
    patchLocal(device.id, { brightness });
    await api.updateSmartDevice(device.id, { brightness });
  }

  async function setColor(device, color) {
    patchLocal(device.id, { color });
    await api.updateSmartDevice(device.id, { color });
  }

  return (
    <section className={`widget-card${compact ? ' compact' : ''}`}>
      <div className="widget-header">
        <h2>Smart Home</h2>
        {compact && onExpand && <button className="see-all" onClick={onExpand}>See all &rarr;</button>}
      </div>

      {data && devices.length === 0 && (
        <p style={{ color: 'var(--color-text-muted)' }}>
          No devices yet. Add your Caseta switches or LIFX bulbs in Settings &rarr; Smart Home Setup.
        </p>
      )}

      {compact
        ? devices.map((device) => (
            <DeviceRow
              key={device.id}
              device={device}
              onToggle={toggleOn}
              onBrightness={setBrightness}
              onColor={setColor}
              showRoom
            />
          ))
        : groupByRoom(devices).map(([room, roomDevices]) => (
            <div className="smart-room-group" key={room}>
              <h3 className="smart-room-title">{room}</h3>
              {roomDevices.map((device) => (
                <DeviceRow
                  key={device.id}
                  device={device}
                  onToggle={toggleOn}
                  onBrightness={setBrightness}
                  onColor={setColor}
                />
              ))}
            </div>
          ))}

      {!compact && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: 10, marginBottom: 0 }}>
          This is a mockup - toggles and sliders here don't talk to real bulbs or switches yet. Add or
          remove devices in Settings &rarr; Smart Home Setup.
        </p>
      )}
    </section>
  );
}
