import { useMemo, useState } from 'react';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';
import { formatMonthLabel, monthGridDays, toISODate, WEEKDAY_SHORT } from '../../lib/week.js';

export default function LunchCalendar({ childName }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthIndex, setMonthIndex] = useState(now.getMonth());

  const monthStart = toISODate(new Date(year, monthIndex, 1));
  const monthEnd = toISODate(new Date(year, monthIndex + 1, 1));
  const { data, setData, refresh } = usePolling(
    () => api.lunchRange(monthStart, monthEnd),
    [monthStart, monthEnd],
    30000
  );

  const byDate = useMemo(() => {
    const map = {};
    for (const d of data?.days || []) map[d.date] = d;
    return map;
  }, [data]);

  const cells = useMemo(() => monthGridDays(year, monthIndex), [year, monthIndex]);
  const todayKey = toISODate(now);

  function goMonth(offset) {
    let m = monthIndex + offset;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonthIndex(m);
    setYear(y);
  }

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
    <section className="widget-card">
      <div className="widget-header">
        <h2>Lunch Calendar &mdash; {childName}</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn-icon" onClick={() => goMonth(-1)}>&larr;</button>
          <span style={{ fontWeight: 700, minWidth: 140, textAlign: 'center' }}>{formatMonthLabel(year, monthIndex)}</span>
          <button className="btn-icon" onClick={() => goMonth(1)}>&rarr;</button>
        </div>
      </div>

      <div className="lunch-cal-weekdays">
        {WEEKDAY_SHORT.map((w) => (
          <div key={w} className="lunch-cal-weekday">{w}</div>
        ))}
      </div>

      <div className="lunch-cal-grid">
        {cells.map((date, idx) => {
          if (!date) return <div className="lunch-cal-day empty" key={`empty-${idx}`} />;
          const day = byDate[date] || { status: 'home', no_school: false, menu_item: '' };
          const dayNum = Number(date.slice(-2));
          const isToday = date === todayKey;

          const statusClass = day.no_school ? 'no-school' : `status-${day.status}`;

          return (
            <div
              className={`lunch-cal-day ${statusClass}${isToday ? ' today' : ''}`}
              key={date}
              onClick={() => !day.no_school && toggleStatus(date, day.status)}
              title={day.no_school ? undefined : day.status === 'school' ? 'Tap to switch to Pack from home' : 'Tap to switch to School lunch'}
            >
              <div className="lunch-cal-day-top">
                <span className="lunch-cal-daynum">{dayNum}</span>
                <button
                  className="lunch-cal-noschool-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateDay(date, { no_school: !day.no_school });
                  }}
                  title={day.no_school ? 'Mark as a school day' : 'Mark as no school'}
                >
                  {day.no_school ? '↩' : '🚫'}
                </button>
              </div>
              {day.no_school ? (
                <div className="lunch-cal-noschool-label">No School</div>
              ) : (
                <input
                  className="lunch-cal-menu"
                  placeholder="Menu…"
                  value={day.menu_item}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateDay(date, { menu_item: e.target.value })}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
