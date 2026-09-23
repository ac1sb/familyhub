import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';

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

const RAIN_THRESHOLD = 40;

export default function TodayWeatherCard({ zip }) {
  const { data, error, loading } = usePolling(() => api.weather(zip), [zip], 30 * 60 * 1000);

  if (loading) return null;
  if (error || !data?.today) {
    return (
      <section className="widget-card weather-today">
        <div className="widget-header"><h2>Weather Today</h2></div>
        <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>Weather unavailable right now.</p>
      </section>
    );
  }

  const { today } = data;

  // Just the day's overall shape at a glance: one icon, high/low, and when
  // rain is expected (if at all) - not current conditions or an hourly
  // breakdown, which belongs on the full Weather page instead.
  const rainSlot = (today.timeline || []).find((t) => (t.precipitation_chance ?? 0) >= RAIN_THRESHOLD);
  const rainToday = rainSlot
    ? `${rainSlot.label} (${rainSlot.precipitation_chance}%)`
    : (today.precipitation_chance ?? 0) >= RAIN_THRESHOLD
      ? `today (${today.precipitation_chance}%)`
      : null;

  return (
    <section className="widget-card weather-today">
      <div className="widget-header">
        <h2>Weather Today</h2>
      </div>
      <div className="weather-today-main">
        <span className="weather-today-icon">{ICONS[today.icon] || '☁️'}</span>
        <div className="weather-today-hilo">
          <span>H {today.high}°</span>
          <span>L {today.low}°</span>
        </div>
      </div>
      {rainToday && <div className="weather-today-rain">🌧️ Rain likely {rainToday}</div>}
    </section>
  );
}
