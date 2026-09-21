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

export default function WeatherWidget({ zip, compact = false }) {
  const { data, error, loading } = usePolling(() => api.weather(zip), [zip], 30 * 60 * 1000);

  if (loading) return compact ? null : <section className="widget-card"><p>Loading weather…</p></section>;
  if (error || !data) {
    return compact ? null : (
      <section className="widget-card">
        <div className="widget-header"><h2>Weather</h2></div>
        <p style={{ color: 'var(--color-text-muted)' }}>Weather unavailable right now.</p>
      </section>
    );
  }

  if (compact) {
    return (
      <div className="weather-chip">
        <span>{ICONS[data.current.icon] || '☁️'}</span>
        <span>{data.current.temperature}°F</span>
      </div>
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
            <div className="icon">{ICONS[d.icon] || '☁️'}</div>
            <div className="hi">{d.high}°</div>
            <div className="lo">{d.low}°</div>
          </div>
        ))}
      </div>
    </section>
  );
}
