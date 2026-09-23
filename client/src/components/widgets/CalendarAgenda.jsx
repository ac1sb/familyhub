import { useMemo, useState } from 'react';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';
import AddEventModal from '../modals/AddEventModal.jsx';
import EventDetailModal from '../modals/EventDetailModal.jsx';
import { addDays, formatTime, todayISO, toISODate } from '../../lib/week.js';

const MEMBER_KEYS = ['member_1', 'member_2', 'member_3'];

export default function CalendarAgenda({ members, compact = false, onExpand, fillHeight = false }) {
  // A rolling window instead of a fixed Mon-Sun week: "today" is always the
  // top row, followed by the next 6 days, so what's showing never depends on
  // which day of the week it happens to be.
  const [rangeStart, setRangeStart] = useState(todayISO());
  const [modalMember, setModalMember] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const dayCount = compact ? 4 : 7;
  const { data, refresh } = usePolling(() => api.eventsRange(rangeStart, dayCount), [rangeStart, dayCount], 20000);

  const days = useMemo(() => {
    const start = new Date(`${rangeStart}T00:00:00`);
    return Array.from({ length: dayCount }, (_, i) => addDays(start, i));
  }, [rangeStart, dayCount]);

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

  function goRange(offsetDays) {
    setRangeStart(toISODate(addDays(new Date(`${rangeStart}T00:00:00`), offsetDays)));
  }

  function handleEventSaved(created) {
    if (created?.start_datetime) {
      const eventDate = new Date(created.start_datetime);
      const eventDateKey = toISODate(eventDate);
      const windowEnd = toISODate(addDays(new Date(`${rangeStart}T00:00:00`), dayCount - 1));
      // A scanned flyer or a manually-picked date can easily land outside the
      // window currently on screen; jump there so the new event is
      // immediately visible instead of silently landing off-screen.
      if (eventDateKey < rangeStart || eventDateKey > windowEnd) setRangeStart(eventDateKey);
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
        <h2>{compact ? 'Calendar — Next Few Days' : 'Calendar — Next 7 Days'}</h2>
        {compact ? (
          onExpand && <button className="see-all" onClick={onExpand}>Full week &rarr;</button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-icon" onClick={() => goRange(-7)}>&larr;</button>
            <button className="btn btn-secondary" onClick={() => setRangeStart(todayISO())}>Today</button>
            <button className="btn-icon" onClick={() => goRange(7)}>&rarr;</button>
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
        const isToday = key === todayISO();
        const bucket = eventsByDayAndMember[key] || { member_1: [], member_2: [], member_3: [] };
        return (
          <div className={`agenda-day-row${isToday ? ' today' : ''}`} key={key}>
            <div className="agenda-day-label">
              {isToday ? 'Today' : day.toLocaleDateString(undefined, { weekday: 'short' })}
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
                    onClick={() => setSelectedEvent(ev)}
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

      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          members={members}
          onClose={() => setSelectedEvent(null)}
          onChanged={(saved) => {
            setSelectedEvent(null);
            if (saved) handleEventSaved(saved);
            else refresh();
          }}
        />
      )}
    </section>
  );
}
