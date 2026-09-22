import { useMemo, useState } from 'react';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';
import AddEventModal from '../modals/AddEventModal.jsx';
import { addDays, currentWeekStart, formatTime, startOfWeek, toISODate } from '../../lib/week.js';

const MEMBER_KEYS = ['member_1', 'member_2', 'member_3'];

export default function CalendarAgenda({ members, compact = false, onExpand, fillHeight = false }) {
  const [weekStart, setWeekStart] = useState(currentWeekStart());
  const [modalMember, setModalMember] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const { data, refresh } = usePolling(() => api.events(weekStart), [weekStart], 20000);

  const days = useMemo(() => {
    const start = new Date(weekStart);
    const count = compact ? 3 : 7;
    return Array.from({ length: count }, (_, i) => addDays(start, i));
  }, [weekStart, compact]);

  const eventsByDayAndMember = useMemo(() => {
    const map = {};
    for (const day of days) map[toISODate(day)] = { member_1: [], member_2: [], member_3: [] };
    for (const ev of data?.events || []) {
      const dayKey = toISODate(new Date(ev.occurrence_start));
      if (!map[dayKey]) continue;
      const bucket = MEMBER_KEYS.includes(ev.member) ? ev.member : 'member_1';
      if (ev.member === 'family') {
        MEMBER_KEYS.forEach((k) => map[dayKey][k].push(ev));
      } else {
        map[dayKey][bucket].push(ev);
      }
    }
    return map;
  }, [data, days]);

  function goWeek(offset) {
    setWeekStart(toISODate(addDays(new Date(weekStart), offset * 7)));
  }

  function handleEventSaved(created) {
    if (created?.start_datetime) {
      const eventDate = new Date(created.start_datetime);
      const eventWeekStart = toISODate(startOfWeek(eventDate));
      // A scanned flyer or a manually-picked date can easily land outside the
      // week currently on screen; jump there so the new event is immediately
      // visible instead of silently landing on a week nobody is looking at.
      if (eventWeekStart !== weekStart) setWeekStart(eventWeekStart);
      setConfirmation(
        `Added "${created.title}" for ${eventDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}`
      );
      setTimeout(() => setConfirmation(null), 6000);
    }
    refresh();
  }

  return (
    <section className={`widget-card${compact ? ' compact' : ''}${fillHeight ? ' fill-height' : ''}`}>
      <div className="widget-header">
        <h2>{compact ? 'Calendar — Next Few Days' : 'Calendar — Agenda'}</h2>
        {compact ? (
          onExpand && <button className="see-all" onClick={onExpand}>Full week &rarr;</button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-icon" onClick={() => goWeek(-1)}>&larr;</button>
            <button className="btn btn-secondary" onClick={() => setWeekStart(currentWeekStart())}>This Week</button>
            <button className="btn-icon" onClick={() => goWeek(1)}>&rarr;</button>
          </div>
        )}
      </div>

      {confirmation && <div className="agenda-confirmation">✅ {confirmation}</div>}

      <div className="agenda-columns-header">
        <div />
        {MEMBER_KEYS.map((key) => (
          <button key={key} className={`member-tap ${key}`} onClick={() => setModalMember(key)}>
            + {members[key]}
          </button>
        ))}
      </div>

      {days.map((day) => {
        const key = toISODate(day);
        const bucket = eventsByDayAndMember[key] || { member_1: [], member_2: [], member_3: [] };
        return (
          <div className="agenda-day-row" key={key}>
            <div className="agenda-day-label">
              {day.toLocaleDateString(undefined, { weekday: 'short' })}
              <span className="date-num">{day.getDate()}</span>
            </div>
            {MEMBER_KEYS.map((memberKey) => (
              <div className="agenda-cell" key={memberKey}>
                {bucket[memberKey].length === 0 && <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>&nbsp;</span>}
                {bucket[memberKey].map((ev) => (
                  <div
                    key={`${ev.id}-${ev.occurrence_start}`}
                    className={`event-pill ${ev.member}${ev.recurring ? ' recurring' : ''}`}
                    title={ev.description || ''}
                  >
                    <span className="time">{ev.all_day ? 'All day' : formatTime(ev.occurrence_start)}</span>
                    {ev.title}
                    {ev.location && <span className="loc">📍 {ev.location}</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      })}

      {modalMember && (
        <AddEventModal
          members={members}
          defaultMember={modalMember}
          onClose={() => setModalMember(null)}
          onSaved={handleEventSaved}
        />
      )}
    </section>
  );
}
