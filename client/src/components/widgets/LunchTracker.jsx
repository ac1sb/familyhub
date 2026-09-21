import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';
import { currentWeekStart, WEEKDAY_SHORT } from '../../lib/week.js';

export default function LunchTracker({ childName }) {
  const weekStart = currentWeekStart();
  const { data, setData, refresh } = usePolling(() => api.lunch(weekStart), [weekStart], 15000);

  async function setStatus(dayOfWeek, status) {
    setData((prev) => ({
      ...prev,
      days: prev.days.map((d) => (d.day_of_week === dayOfWeek ? { ...d, status } : d)),
    }));
    await api.setLunch(weekStart, dayOfWeek, status);
    refresh();
  }

  const days = data?.days || [];

  return (
    <section className="widget-card">
      <div className="widget-header">
        <h2>Lunch Tracker &mdash; {childName}</h2>
      </div>
      <div className="lunch-grid">
        {days.map((d) => (
          <div className="lunch-day" key={d.day_of_week}>
            <div className="day-name">{WEEKDAY_SHORT[d.day_of_week]}</div>
            <button
              className={`lunch-option school${d.status === 'school' ? ' active' : ''}`}
              onClick={() => setStatus(d.day_of_week, 'school')}
            >
              🏫 School
            </button>
            <button
              className={`lunch-option home${d.status === 'home' ? ' active' : ''}`}
              onClick={() => setStatus(d.day_of_week, 'home')}
            >
              🏠 From Home
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
