import { usePolling } from '../hooks/usePolling.js';
import { api } from '../api.js';
import { todayISO, toISODate } from '../lib/week.js';

export default function ReminderBanner({ members }) {
  // Only today matters here - asking for just today's window keeps this poll
  // far smaller than the whole week of occurrences it used to request.
  const todayKey = todayISO();
  const { data } = usePolling(() => api.eventsRange(todayKey, 1), [todayKey], 30000);

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
