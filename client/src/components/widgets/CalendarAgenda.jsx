import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';
import AddEventModal from '../modals/AddEventModal.jsx';
import EventDetailModal from '../modals/EventDetailModal.jsx';
import {
  addDays,
  formatTime,
  todayISO,
  toISODate,
  startOfWeek,
  monthGridDays,
  formatMonthLabel,
  WEEKDAY_SHORT,
} from '../../lib/week.js';
import { getCalendarPageSettings, setCalendarPageSettings } from '../../lib/calendarPageSettings.js';

const MEMBER_KEYS = ['member_1', 'member_2', 'member_3'];
// The full page's Agenda view only ever shows a fixed 7 days when it's
// cramped for room - on a taller window/monitor there's often blank space
// below day 7 for no reason, so it grows to fill whatever's actually
// available (capped so an enormous display doesn't fetch/render an
// unreasonable number of days). Week and Day views are always a fixed
// length (7 and 1) regardless of available height - only Agenda's rolling
// window auto-fits.
const MIN_DAYS = 7;
const MAX_DAYS = 21;
// The compact dashboard widget uses the same fit-to-available-height idea,
// but its floor/ceiling are much lower - it's a small glance widget in a
// resizable grid box, not the full page, so 1 day (a tiny box) to 10 days
// (a very tall one) covers it without ever forcing a page-sized minimum.
// It always stays in Agenda view, showing everyone - Week/Month/Day and the
// person filter are full-page-only.
const COMPACT_MIN_DAYS = 1;
const COMPACT_MAX_DAYS = 10;
const ROW_HEIGHT_FALLBACK = 64; // px - used only before a real row has rendered to measure
const MONTH_EVENTS_PREVIEW = 3; // how many event pills show per day cell before "+N more"

const VIEW_LABELS = { agenda: 'Agenda', week: 'Week', month: 'Month', day: 'Day' };

export default function CalendarAgenda({ members, compact = false, onExpand, fillHeight = false }) {
  // Reference date for Agenda (rolling window start)/Week (any day in that
  // week)/Day (the day itself). Month view has its own year/monthIndex
  // instead, since "a day within the month" isn't otherwise meaningful.
  const [rangeStart, setRangeStart] = useState(todayISO());
  const [monthDate, setMonthDate] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), monthIndex: d.getMonth() };
  });
  const [modalMember, setModalMember] = useState(null);
  const [addDefaultDate, setAddDefaultDate] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [dayCount, setDayCount] = useState(compact ? COMPACT_MIN_DAYS : MIN_DAYS);
  // View mode (Agenda/Week/Month/Day) and the person filter are per-device
  // settings, like everything else on this dashboard - but only apply to
  // the full page; the compact dashboard widget always stays a rolling
  // Agenda view showing every member, since it's a small glance widget.
  const [pageSettings, setPageSettings] = useState(() => (compact ? { view: 'agenda', member: null } : getCalendarPageSettings()));
  const scrollAreaRef = useRef(null);
  const firstRowRef = useRef(null);

  const viewMode = compact ? 'agenda' : pageSettings.view;
  const selectedMember = compact ? null : pageSettings.member;
  const visibleMemberKeys = selectedMember ? [selectedMember] : MEMBER_KEYS;

  function updatePageSettings(patch) {
    setPageSettings((prev) => {
      const next = { ...prev, ...patch };
      setCalendarPageSettings(next);
      return next;
    });
  }

  const monthStart = toISODate(new Date(monthDate.year, monthDate.monthIndex, 1));
  const daysInMonth = new Date(monthDate.year, monthDate.monthIndex + 1, 0).getDate();
  const weekStart = toISODate(startOfWeek(new Date(`${rangeStart}T00:00:00`)));

  // Whatever the active view needs, in one shape the fetch can use -
  // computed here (not in a branch inside usePolling) so the hook itself is
  // always called the same way regardless of which view is showing.
  let fetchStart = rangeStart;
  let fetchDays = dayCount;
  if (viewMode === 'week') {
    fetchStart = weekStart;
    fetchDays = 7;
  } else if (viewMode === 'day') {
    fetchStart = rangeStart;
    fetchDays = 1;
  } else if (viewMode === 'month') {
    fetchStart = monthStart;
    fetchDays = daysInMonth;
  }

  const { data, refresh } = usePolling(() => api.eventsRange(fetchStart, fetchDays), [fetchStart, fetchDays], 20000);

  // Fits however many days actually fit in the space available - only
  // meaningful for Agenda's rolling window (Week/Day are always a fixed
  // length, Month is its own grid) - the full page's own height (minus a
  // page-sized floor/ceiling) or, in compact mode, however tall the
  // dashboard widget's box has been resized to (a much lower floor/ceiling,
  // since it's a small glance widget, not the full page). Re-measures
  // whenever the scroll area's own size changes (window resize, dragging
  // the widget's resize handle, sidebar toggling, etc.) and after each
  // render, since a row's real height depends on how many events land on
  // it that day.
  useLayoutEffect(() => {
    if (viewMode !== 'agenda') return undefined;
    const el = scrollAreaRef.current;
    if (!el) return undefined;
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
  }, [compact, viewMode]);

  // The list of days rendered in the Agenda/Week/Day column layout (Month
  // uses monthCells below instead).
  const days = useMemo(() => {
    if (viewMode === 'week') {
      const start = startOfWeek(new Date(`${rangeStart}T00:00:00`));
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    if (viewMode === 'day') {
      return [new Date(`${rangeStart}T00:00:00`)];
    }
    const start = new Date(`${rangeStart}T00:00:00`);
    return Array.from({ length: dayCount }, (_, i) => addDays(start, i));
  }, [viewMode, rangeStart, dayCount]);

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

  // Month view: every event for the month, keyed by date (not split by
  // member - the person filter just narrows which ones render per cell).
  const eventsByDate = useMemo(() => {
    const map = {};
    for (const ev of data?.events || []) {
      const key = toISODate(new Date(ev.occurrence_start));
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    }
    return map;
  }, [data]);

  const monthCells = useMemo(() => monthGridDays(monthDate.year, monthDate.monthIndex), [monthDate]);
  const monthWeekRows = Math.ceil(monthCells.length / 7);

  function goMonth(offset) {
    setMonthDate((prev) => {
      let m = prev.monthIndex + offset;
      let y = prev.year;
      if (m < 0) { m = 11; y -= 1; }
      if (m > 11) { m = 0; y += 1; }
      return { year: y, monthIndex: m };
    });
  }

  function goPrev() {
    if (viewMode === 'month') return goMonth(-1);
    const offset = viewMode === 'week' ? 7 : viewMode === 'day' ? 1 : dayCount;
    setRangeStart(toISODate(addDays(new Date(`${rangeStart}T00:00:00`), -offset)));
  }

  function goNext() {
    if (viewMode === 'month') return goMonth(1);
    const offset = viewMode === 'week' ? 7 : viewMode === 'day' ? 1 : dayCount;
    setRangeStart(toISODate(addDays(new Date(`${rangeStart}T00:00:00`), offset)));
  }

  function goToday() {
    if (viewMode === 'month') {
      const d = new Date();
      setMonthDate({ year: d.getFullYear(), monthIndex: d.getMonth() });
      return;
    }
    setRangeStart(todayISO());
  }

  function viewTitle() {
    if (viewMode === 'week') {
      const last = days[days.length - 1];
      return `Week of ${days[0]?.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}–${last?.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    }
    if (viewMode === 'day') {
      return days[0]?.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    }
    if (viewMode === 'month') {
      return formatMonthLabel(monthDate.year, monthDate.monthIndex);
    }
    return `Calendar — Next ${dayCount} Days`;
  }

  function handleEventSaved(created) {
    if (created?.start_datetime) {
      const eventDate = new Date(created.start_datetime);
      const eventDateKey = toISODate(eventDate);
      if (viewMode === 'month') {
        setMonthDate({ year: eventDate.getFullYear(), monthIndex: eventDate.getMonth() });
      } else {
        // A scanned flyer or a manually-picked date can easily land outside
        // the window currently on screen; jump there so the new event is
        // immediately visible instead of silently landing off-screen.
        const windowStart = viewMode === 'week' ? weekStart : rangeStart;
        const windowLen = viewMode === 'week' ? 7 : viewMode === 'day' ? 1 : dayCount;
        const windowEnd = toISODate(addDays(new Date(`${windowStart}T00:00:00`), windowLen - 1));
        if (eventDateKey < windowStart || eventDateKey > windowEnd) setRangeStart(eventDateKey);
      }
      setConfirmation(
        `Added "${created.title}" for ${eventDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}`
      );
      setTimeout(() => setConfirmation(null), 6000);
    }
    refresh();
  }

  function openAddForDate(date) {
    setAddDefaultDate(date);
    setModalMember(selectedMember || 'family');
  }

  const showViewControls = !compact;

  return (
    <section className={`widget-card${compact ? ' compact' : ''}${fillHeight ? ' fill-height' : ''}`}>
      <div className="widget-header">
        <h2>{viewTitle()}</h2>
        {compact ? (
          onExpand && <button className="see-all" onClick={onExpand}>Full week &rarr;</button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-icon" onClick={goPrev}>&larr;</button>
            <button className="btn btn-secondary" onClick={goToday}>Today</button>
            <button className="btn-icon" onClick={goNext}>&rarr;</button>
          </div>
        )}
      </div>

      {showViewControls && (
        <div className="cal-view-controls">
          <div className="mode-toggle-row">
            {Object.entries(VIEW_LABELS).map(([v, label]) => (
              <button
                key={v}
                type="button"
                className={`mode-toggle-btn${viewMode === v ? ' active' : ''}`}
                onClick={() => updatePageSettings({ view: v })}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="member-choice-row">
            <button
              type="button"
              className={`member-choice family${!selectedMember ? ' selected' : ''}`}
              onClick={() => updatePageSettings({ member: null })}
            >
              All
            </button>
            {MEMBER_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className={`member-choice ${key}${selectedMember === key ? ' selected' : ''}`}
                onClick={() => updatePageSettings({ member: key })}
              >
                {members[key]}
              </button>
            ))}
          </div>
        </div>
      )}

      {confirmation && <div className="agenda-confirmation">✅ {confirmation}</div>}

      {viewMode === 'month' ? (
        <>
          <div className="lunch-cal-weekdays cal-month-weekdays">
            {WEEKDAY_SHORT.map((w) => (
              <div key={w} className="lunch-cal-weekday">{w}</div>
            ))}
          </div>
          <div className="cal-month-grid" style={{ gridTemplateRows: `repeat(${monthWeekRows}, 1fr)` }} ref={scrollAreaRef}>
            {monthCells.map((date, idx) => {
              if (!date) return <div className="cal-month-day empty" key={`empty-${idx}`} />;
              const isToday = date === todayISO();
              const dayEvents = (eventsByDate[date] || []).filter(
                (ev) => !selectedMember || ev.member === selectedMember || ev.member === 'family'
              );
              return (
                <div
                  className={`cal-month-day${isToday ? ' today' : ''}`}
                  key={date}
                  onClick={() => openAddForDate(new Date(`${date}T00:00:00`))}
                >
                  <div className="cal-month-daynum">{Number(date.slice(-2))}</div>
                  <div className="cal-month-events">
                    {dayEvents.slice(0, MONTH_EVENTS_PREVIEW).map((ev) => (
                      <div
                        key={`${ev.id}-${ev.occurrence_start}`}
                        className={`event-pill cal-month-pill ${ev.member}${ev.recurring ? ' recurring' : ''}`}
                        title={ev.title}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(ev);
                        }}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > MONTH_EVENTS_PREVIEW && (
                      <div className="cal-month-more">+{dayEvents.length - MONTH_EVENTS_PREVIEW} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div
            className="agenda-columns-header"
            style={{ gridTemplateColumns: `90px repeat(${visibleMemberKeys.length}, 1fr)` }}
          >
            <div />
            {visibleMemberKeys.map((key) => (
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
                  style={{ gridTemplateColumns: `90px repeat(${visibleMemberKeys.length}, 1fr)` }}
                >
                  <div className="agenda-day-label">
                    {isToday ? 'Today' : day.toLocaleDateString(undefined, { weekday: 'short' })}
                    <span className="date-num">{day.getDate()}</span>
                  </div>
                  {visibleMemberKeys.map((memberKey) => (
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
        </>
      )}

      {modalMember && (
        <AddEventModal
          members={members}
          defaultMember={modalMember}
          defaultDate={addDefaultDate}
          onClose={() => {
            setModalMember(null);
            setAddDefaultDate(null);
          }}
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
