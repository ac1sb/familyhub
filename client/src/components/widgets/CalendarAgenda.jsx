import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';
import AddEventModal from '../modals/AddEventModal.jsx';
import EventDetailModal from '../modals/EventDetailModal.jsx';
import { addDays, formatTime, todayISO, toISODate } from '../../lib/week.js';

const MEMBER_KEYS = ['member_1', 'member_2', 'member_3'];
// The full page only ever shows a fixed 7 days when it's cramped for room -
// on a taller window/monitor there's often blank space below day 7 for no
// reason, so it grows to fill whatever's actually available (capped so an
// enormous display doesn't fetch/render an unreasonable number of days).
const MIN_DAYS = 7;
const MAX_DAYS = 21;
// The compact dashboard widget uses the same fit-to-available-height idea,
// but its floor/ceiling are much lower - it's a small glance widget in a
// resizable grid box, not the full page, so 1 day (a tiny box) to 10 days
// (a very tall one) covers it without ever forcing a page-sized minimum.
const COMPACT_MIN_DAYS = 1;
const COMPACT_MAX_DAYS = 10;
const ROW_HEIGHT_FALLBACK = 64; // px - used only before a real row has rendered to measure

export default function CalendarAgenda({ members, compact = false, onExpand, fillHeight = false }) {
  // A rolling window instead of a fixed Mon-Sun week: "today" is always the
  // top row, followed by the next N days, so what's showing never depends on
  // which day of the week it happens to be.
  const [rangeStart, setRangeStart] = useState(todayISO());
  const [modalMember, setModalMember] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [dayCount, setDayCount] = useState(compact ? COMPACT_MIN_DAYS : MIN_DAYS);
  const scrollAreaRef = useRef(null);
  const firstRowRef = useRef(null);
  const { data, refresh } = usePolling(() => api.eventsRange(rangeStart, dayCount), [rangeStart, dayCount], 20000);

  // Fits however many days actually fit in the space available - the full
  // page's own height (minus a page-sized floor/ceiling) or, in compact
  // mode, however tall the dashboard widget's box has been resized to (a
  // much lower floor/ceiling, since it's a small glance widget, not the
  // full page). Re-measures whenever the scroll area's own size changes
  // (window resize, dragging the widget's resize handle, sidebar toggling,
  // etc.) and after each render, since a row's real height depends on how
  // many events land on it that day.
  useLayoutEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const minDays = compact ? COMPACT_MIN_DAYS : MIN_DAYS;
    const maxDays = compact ? COMPACT_MAX_DAYS : MAX_DAYS;
    function recompute() {
      const rowHeight = firstRowRef.current?.offsetHeight || ROW_HEIGHT_FALLBACK;
      const fitting = Math.floor(el.clientHeight / rowHeight);
      setDayCount(Math.max(minDays, Math.min(maxDays, fitting)));
    }
    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(el);
    return () => observer.disconnect();
  }, [compact]);

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
        <h2>Calendar — Next {dayCount} Days</h2>
        {compact ? (
          onExpand && <button className="see-all" onClick={onExpand}>Full week &rarr;</button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-icon" onClick={() => goRange(-dayCount)}>&larr;</button>
            <button className="btn btn-secondary" onClick={() => setRangeStart(todayISO())}>Today</button>
            <button className="btn-icon" onClick={() => goRange(dayCount)}>&rarr;</button>
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

      <div className="agenda-days-scroll" ref={scrollAreaRef}>
        {days.map((day, i) => {
          const key = toISODate(day);
          const isToday = key === todayISO();
          const bucket = eventsByDayAndMember[key] || { member_1: [], member_2: [], member_3: [] };
          return (
            <div
              className={`agenda-day-row${isToday ? ' today' : ''}`}
              key={key}
              ref={i === 0 ? firstRowRef : undefined}
            >
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
      </div>

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
