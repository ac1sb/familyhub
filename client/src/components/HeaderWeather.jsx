import { usePolling } from '../hooks/usePolling.js';
import { api } from '../api.js';

const ICONS = {
  sun: '☀️',
  'cloud-sun': '⛅',
  cloud: '☁️',
  fog: '🌫️',
  drizzle: '🌦️',
  rain: '🌧️',
  snow: '❄️',
  storm: '⛈️',
};

// Everything the dashboard's "Weather Today" card knows, laid out as a row
// of small read-only chips (same shape as the smart-home toggle strip)
// instead of a single card - the morning/afternoon/evening breakdown and
// the clothing hint were already being fetched but never actually shown
// anywhere, so this is also the first place either one appears.
export default function HeaderWeather({ zip }) {
  const { data, error, loading } = usePolling(() => api.weather(zip), [zip], 30 * 60 * 1000);

  if (loading || error || !data?.today) return null;
  const { today, current } = data;

  return (
    <div className="topbar-weather">
      <span className="header-info-chip header-info-chip-now">
        <span>{ICONS[current.icon] || '☁️'}</span>
        <span>Now {current.temperature}&deg;</span>
      </span>
      <span className="header-info-chip">H {today.high}&deg; / L {today.low}&deg;</span>
      {today.precipitation_chance != null && today.precipitation_chance > 0 && (
        <span className="header-info-chip">💧 {today.precipitation_chance}%</span>
      )}
      {(today.timeline || []).map((t) => (
        <span className="header-info-chip" key={t.label}>
          {ICONS[t.icon] || '☁️'} {t.label} {t.temperature}&deg;
        </span>
      ))}
      {today.clothing_hint && <span className="header-info-chip">{today.clothing_hint}</span>}
    </div>
  );
}
