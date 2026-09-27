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

// A quick-glance strip in the header, on every page - just enough to answer
// "do I need a coat" without leaving whatever else you're looking at. The
// morning/afternoon/evening breakdown and the clothing hint are deliberately
// left out here (they used to show in this same strip) - the full detail is
// a tap away on the Weather page for anyone who wants it.
export default function HeaderWeather({ zip }) {
  const { data, error, loading } = usePolling(() => api.weather(zip), [zip], 30 * 60 * 1000);

  if (loading || error || !data?.today) return null;
  const { today, current } = data;

  return (
    <div className="topbar-weather-group">
      <span className="header-info-chip header-info-chip-now">
        <span>{ICONS[current.icon] || '☁️'}</span>
        <span>Now {current.temperature}&deg;</span>
      </span>
      <span className="header-info-chip">H {today.high}&deg; / L {today.low}&deg;</span>
      {today.precipitation_chance != null && today.precipitation_chance > 0 && (
        <span className="header-info-chip">💧 {today.precipitation_chance}%</span>
      )}
    </div>
  );
}
