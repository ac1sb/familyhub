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

export default function WeatherWidget({ zip }) {
  const { data, error, loading } = usePolling(() => api.weather(zip), [zip], 30 * 60 * 1000);

  if (loading) return <section className="widget-card"><p>Loading weather…</p></section>;
  if (error || !data) {
    return (
      <section className="widget-card">
        <div className="widget-header"><h2>Weather</h2></div>
        <p style={{ color: 'var(--color-text-muted)' }}>Weather unavailable right now.</p>
      </section>
    );
  }

  return (
    <section className="widget-card">
      <div className="widget-header">
        <h2>Weather &mdash; {data.location}</h2>
      </div>
      <div className="weather-current">
        <span style={{ fontSize: '2.4rem' }}>{ICONS[data.current.icon] || '☁️'}</span>
        <div>
          <div className="temp">{data.current.temperature}°F</div>
          <div style={{ color: 'var(--color-text-muted)' }}>{data.current.condition}</div>
        </div>
      </div>
      <div className="weather-days">
        {data.daily.map((d) => (
          <div className="weather-day" key={d.date}>
            <div className="wd">{new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' })}</div>
            <div className="wd-date">{new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
            <div className="icon">{ICONS[d.icon] || '☁️'}</div>
            <div className="condition">{d.condition}</div>
            <div className="hilo">
              <span className="hi">{d.high}°</span>
              <span className="lo">{d.low}°</span>
            </div>
            {d.precipitation_chance != null && d.precipitation_chance > 0 && (
              <div className="precip">💧 {d.precipitation_chance}%</div>
            )}
            {d.wind_speed != null && <div className="wind">💨 {d.wind_speed} mph</div>}
          </div>
        ))}
      </div>
    </section>
  );
}
