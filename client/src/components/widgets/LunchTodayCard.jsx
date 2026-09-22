import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';
import { addDays, currentWeekStart, toISODate, WEEKDAY_SHORT } from '../../lib/week.js';

// After 3pm, show tomorrow's status instead of today's - so packing a lunch
// the night before isn't a last-minute scramble in the morning.
function pickFocusDate(now) {
  const isAfternoonCutoff = now.getHours() >= 15;
  return toISODate(addDays(now, isAfternoonCutoff ? 1 : 0));
}

export default function LunchTodayCard({ childName, onExpand }) {
  const now = new Date();
  const weekStart = currentWeekStart();
  // Two extra days past the Mon-Sun week guarantees "tomorrow" is covered
  // even when today is Sunday and tomorrow rolls into next week.
  const rangeEnd = toISODate(addDays(new Date(weekStart), 8));
  const { data } = usePolling(() => api.lunchRange(weekStart, rangeEnd), [weekStart, rangeEnd], 30000);

  const byDate = {};
  for (const d of data?.days || []) byDate[d.date] = d;

  const focusDate = pickFocusDate(now);
  const focusDay = byDate[focusDate];
  const isTomorrow = focusDate !== toISODate(now);

  const weekDates = Array.from({ length: 5 }, (_, i) => toISODate(addDays(new Date(weekStart), i)));

  return (
    <section className="widget-card lunch-today">
      <div className="widget-header">
        <h2>Lunch &mdash; {childName}</h2>
        {onExpand && <button className="see-all" onClick={onExpand}>Full month &rarr;</button>}
      </div>

      <div className="lunch-today-focus">
        <span className="lunch-today-label">{isTomorrow ? 'Tomorrow' : 'Today'}</span>
        {focusDay?.no_school ? (
          <span className="lunch-today-status no-school">No school</span>
        ) : (
          <span className={`lunch-today-status ${focusDay?.status || 'home'}`}>
            {focusDay?.status === 'school' ? '🏫 School lunch' : '🎒 Pack from home'}
          </span>
        )}
        {focusDay?.menu_item && <span className="lunch-today-menu">{focusDay.menu_item}</span>}
      </div>

      <div className="lunch-today-strip">
        {weekDates.map((date, i) => {
          const day = byDate[date];
          return (
            <div key={date} className={`lunch-today-chip${date === toISODate(now) ? ' is-today' : ''}`}>
              <div className="lts-day">{WEEKDAY_SHORT[i]}</div>
              <div className="lts-icon">
                {day?.no_school ? '—' : day?.status === 'school' ? '🏫' : '🎒'}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
