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

          return (
            <div className={`lunch-cal-day${isToday ? ' today' : ''}${day.no_school ? ' no-school' : ''}`} key={date}>
              <div className="lunch-cal-daynum">{dayNum}</div>
              {day.no_school ? (
                <button className="lunch-cal-noschool-tag" onClick={() => updateDay(date, { no_school: false })}>
                  No School
                </button>
              ) : (
                <>
                  <div className="lunch-cal-toggle-row">
                    <button
                      className={`lunch-cal-toggle school${day.status === 'school' ? ' active' : ''}`}
                      onClick={() => updateDay(date, { status: 'school' })}
                      title="School lunch"
                    >
                      🏫
                    </button>
                    <button
                      className={`lunch-cal-toggle home${day.status === 'home' ? ' active' : ''}`}
                      onClick={() => updateDay(date, { status: 'home' })}
                      title="Pack from home"
                    >
                      🎒
                    </button>
                  </div>
                  <input
                    className="lunch-cal-menu"
                    placeholder="Menu…"
                    value={day.menu_item}
                    onChange={(e) => updateDay(date, { menu_item: e.target.value })}
                  />
                  <button className="lunch-cal-noschool-link" onClick={() => updateDay(date, { no_school: true })}>
                    No school
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
