import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';
import { addDays, toISODate } from '../../lib/week.js';
import { stripDailyChoices } from '../../lib/lunchText.js';

export default function LunchTodayCard({ childName, onExpand }) {
  const now = new Date();
  const todayKey = toISODate(now);
  const rangeEnd = toISODate(addDays(now, 2));
  const { data, setData, refresh } = usePolling(() => api.lunchRange(todayKey, rangeEnd), [todayKey, rangeEnd], 30000);

  const byDate = {};
  for (const d of data?.days || []) byDate[d.date] = d;

  // Today + tomorrow only - a quick "what's for lunch" glance, not a weekly view.
  const shownDates = [todayKey, toISODate(addDays(now, 1))];

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
        {shownDates.map((date, i) => {
          const day = byDate[date];
          const noSchool = !!day?.no_school;
          const statusClass = noSchool ? 'no-school' : `status-${day?.status || 'home'}`;
          const label = i === 0 ? 'Today' : 'Tomorrow';

          return (
            <button
              key={date}
              type="button"
              className={`lunch-today-row ${statusClass}${date === todayKey ? ' is-today' : ''}`}
              onClick={() => !noSchool && toggleStatus(date, day?.status || 'home')}
              disabled={noSchool}
            >
              <span className="ltr-day">{label}</span>
              <span className="ltr-meal">{noSchool ? 'No School' : stripDailyChoices(day?.menu_item) || 'No menu yet'}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
