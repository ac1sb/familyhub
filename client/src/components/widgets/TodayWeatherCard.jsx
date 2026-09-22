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

  return (
    <section className="widget-card weather-today">
      <div className="widget-header">
        <h2>Weather Today</h2>
      </div>
      <div className="weather-today-main">
        <span className="weather-today-icon">{ICONS[current.icon] || '☁️'}</span>
        <div>
          <div className="weather-today-temp">{current.temperature}°F</div>
          <div className="weather-today-condition">{current.condition}</div>
        </div>
        <div className="weather-today-hilo">
          <span>H {today.high}°</span>
          <span>L {today.low}°</span>
          {today.precipitation_chance != null && <span>💧 {today.precipitation_chance}%</span>}
        </div>
      </div>

      {today.timeline?.length > 0 && (
        <div className="weather-today-timeline">
          {today.timeline.map((t) => (
            <div className="weather-today-slot" key={t.label}>
              <div className="wt-label">{t.label}</div>
              <div className="wt-icon">{ICONS[t.icon] || '☁️'}</div>
              <div className="wt-temp">{t.temperature}°</div>
            </div>
          ))}
        </div>
      )}

      {today.clothing_hint && <div className="weather-today-hint">{today.clothing_hint}</div>}
    </section>
  );
}
