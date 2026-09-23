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

  const { today, current } = data;

  // The day's overall shape at a glance: icon, condition, high/low, the
  // current temperature, and when rain is expected (if at all) - a step up
  // from just an icon, but still short of the full Weather page's detail.
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
        <div className="weather-today-info">
          <div className="weather-today-condition">{today.condition}</div>
          <div className="weather-today-hilo">
            <span>H {today.high}°</span>
            <span>L {today.low}°</span>
          </div>
        </div>
        {current && (
          <div className="weather-today-now">
            <span className="weather-today-now-label">Now</span>
            <span className="weather-today-now-temp">{current.temperature}°</span>
          </div>
        )}
      </div>
      {rainToday ? (
        <div className="weather-today-rain">🌧️ Rain likely {rainToday}</div>
      ) : (
        today.precipitation_chance != null &&
        today.precipitation_chance > 0 && (
          <div className="weather-today-rain">💧 {today.precipitation_chance}% chance of rain</div>
        )
      )}
    </section>
  );
}
