import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';
import { addDays, currentWeekStart, toISODate, WEEKDAY_SHORT } from '../../lib/week.js';

export default function LunchTodayCard({ childName, onExpand }) {
  const now = new Date();
  const weekStart = currentWeekStart();
  const rangeEnd = toISODate(addDays(new Date(weekStart), 5)); // Mon..Fri only
  const { data, setData, refresh } = usePolling(() => api.lunchRange(weekStart, rangeEnd), [weekStart, rangeEnd], 30000);

  const byDate = {};
  for (const d of data?.days || []) byDate[d.date] = d;

  const weekDates = Array.from({ length: 5 }, (_, i) => toISODate(addDays(new Date(weekStart), i)));
  const todayKey = toISODate(now);

  async function updateDay(date, patch) {
    setData((prev) => ({
      days: (prev?.days || []).map((d) => (d.date === date ? { ...d, ...patch } : d)),
    }));
    await api.setLunchDay(date, patch);
    refresh();
  }

  function toggleStatus(date, currentStatus) {
    updateDay(date, { status: currentStatus === 'school' ? 'home' : 'school' });
  }

  return (
    <section className="widget-card lunch-today">
      <div className="widget-header">
        <h2>Lunch &mdash; {childName}</h2>
        {onExpand && <button className="see-all" onClick={onExpand}>Full month &rarr;</button>}
      </div>

      <div className="lunch-today-list">
        {weekDates.map((date, i) => {
          const day = byDate[date];
          const noSchool = !!day?.no_school;
          const statusClass = noSchool ? 'no-school' : `status-${day?.status || 'home'}`;

          return (
            <button
              key={date}
              type="button"
              className={`lunch-today-row ${statusClass}${date === todayKey ? ' is-today' : ''}`}
              onClick={() => !noSchool && toggleStatus(date, day?.status || 'home')}
              disabled={noSchool}
            >
              <span className="ltr-day">{WEEKDAY_SHORT[i]}</span>
              <span className="ltr-meal">{noSchool ? 'No School' : day?.menu_item || 'No menu yet'}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
