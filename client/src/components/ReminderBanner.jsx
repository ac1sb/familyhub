import { usePolling } from '../hooks/usePolling.js';
import { api } from '../api.js';
import { currentWeekStart, toISODate } from '../lib/week.js';

export default function ReminderBanner({ members }) {
  const weekStart = currentWeekStart();
  const { data } = usePolling(() => api.events(weekStart), [weekStart], 30000);

  const todayKey = toISODate(new Date());
  const todaysReminders = (data?.events || []).filter(
    (ev) => ev.is_reminder && toISODate(new Date(ev.occurrence_start)) === todayKey
  );

  if (todaysReminders.length === 0) return null;

  return (
    <div className="reminder-banner-stack">
      {todaysReminders.map((ev) => (
        <div className={`reminder-banner ${ev.member}`} key={`${ev.id}-${ev.occurrence_start}`}>
          <span className="reminder-banner-icon">🔔</span>
          <div className="reminder-banner-text">
            <div className="reminder-banner-title">
              {ev.title}
              {ev.member !== 'family' && members?.[ev.member] ? ` — ${members[ev.member]}` : ''}
            </div>
            {ev.description && <div className="reminder-banner-desc">{ev.description}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
