import { useEffect, useState } from 'react';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';
import { currentWeekStart, startOfWeek, addDays, toISODate, WEEKDAY_SHORT } from '../../lib/week.js';
import { stripDailyChoices } from '../../lib/lunchText.js';

function slotId(weekStart, dayOfWeek) {
  return `slot-${weekStart}-${dayOfWeek}`;
}

function parseSlotId(id) {
  const m = /^slot-(\d{4}-\d{2}-\d{2})-(\d)$/.exec(id);
  return { weekStart: m[1], dayOfWeek: Number(m[2]) };
}

function lunchStatusIcon(lunch) {
  if (lunch?.noSchool) return '🚫';
  return lunch?.status === 'school' ? '🏫' : '🥪';
}

// The dashboard widget's lunch glance for one day - a tap toggles school/
// home, same as the old standalone Lunch tile did, just folded into this
// combined day box instead of its own separate widget. Rendered as its own
// framed tile (see .meal-tile) rather than a plain bar, so it reads as a
// clearly separate thing from the dinner tile next to it instead of two
// halves of one blended box.
function LunchRow({ lunch, onToggle }) {
  if (!lunch) return null;
  const statusClass = lunch.noSchool ? 'no-school' : `status-${lunch.status}`;
  const text = lunch.noSchool ? 'No School' : stripDailyChoices(lunch.menuItem) || 'No menu yet';
  return (
    <button
      type="button"
      className={`meal-tile meal-tile-lunch ${statusClass}`}
      onClick={onToggle}
      disabled={lunch.noSchool}
      title={text}
    >
      <span className="meal-tile-label">Lunch</span>
      <span className="meal-tile-lunch-body">
        <span className="meal-box-lunch-icon">{lunchStatusIcon(lunch)}</span>
        <span className="meal-box-lunch-text">{text}</span>
      </span>
    </button>
  );
}

// Each day is a fixed drop target - unlike a reorderable list, a day's box
// never moves in the grid. Dragging a meal onto another day's box just
// swaps the two typed names; the day tabs above them stay exactly where
// they are the whole time. A slot carries its own week_start (not just a
// day index) so this still works when two boxes belong to different weeks
// - the dashboard's rolling view can span a week boundary. `compact` frames
// the dinner box as its own labeled tile (and adds the lunch tile beside it
// when the day has one) so the two read as clearly separate things instead
// of one blended box; the full weekly page (compact=false) is dinner-only
// and keeps its original plain look, with nothing to visually separate it
// from.
function DaySlot({ slot, compact, onChange, onCommit, onToggleLunch }) {
  const { setNodeRef, isOver } = useDroppable({ id: slot.id });
  return (
    <div ref={setNodeRef} className={`meal-box${isOver ? ' drop-target' : ''}`}>
      <div className={`meal-box-day${slot.isToday ? ' today' : ''}`}>
        {slot.label}
        <span className="meal-box-date">{slot.dateLabel}</span>
      </div>
      {compact ? (
        <div className="meal-tiles-row">
          <LunchRow lunch={slot.lunch} onToggle={() => onToggleLunch(slot)} />
          <div className={`meal-tile meal-tile-dinner${slot.name?.trim() ? ' has-meal' : ''}`}>
            <span className="meal-tile-label">🍽️ Dinner</span>
            <DraggableMealInput slot={slot} onChange={onChange} onCommit={onCommit} />
          </div>
        </div>
      ) : (
        <DraggableMealInput slot={slot} onChange={onChange} onCommit={onCommit} />
      )}
    </div>
  );
}

function DraggableMealInput({ slot, onChange, onCommit }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: slot.id });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  // The whole box is the drag target now (there's nothing else to interact
  // with here besides typing into it or dragging it onto another day) -
  // dnd-kit's activation constraints (a few px of movement for mouse, a
  // short hold for touch - see the sensors below) already tell a plain tap
  // to place the cursor apart from an actual drag, so a dedicated handle
  // grabbing its own row was just spending space for no real benefit.
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`meal-input-wrap${isDragging ? ' dragging' : ''}`}
      {...attributes}
      {...listeners}
      title="Drag onto another day to swap"
    >
      <input
        type="text"
        className="meal-box-input"
        placeholder="Add a meal…"
        value={slot.name}
        onChange={(e) => onChange(slot, e.target.value)}
        onBlur={() => onCommit(slot)}
      />
    </div>
  );
}

export default function MealPlanner({ compact = false, onExpand, onExpandLunch, childName }) {
  const weekStart = currentWeekStart();
  // The dashboard widget rolls forward from today (like the calendar's
  // "next N days"), which can spill into next week's row - e.g. viewed on a
  // Saturday or Sunday, "the next 5 days" is mostly next week. Always fetch
  // both weeks (cheap - 7 rows each) so that boundary never leaves a day
  // blank; the full page only ever shows the current Mon-Sun week, so it
  // just ignores next week's data entirely.
  const nextWeekStart = toISODate(addDays(startOfWeek(new Date()), 7));

  const { data, refresh } = usePolling(() => api.meals(weekStart), [weekStart], 15000);
  const { data: nextWeekData, refresh: refreshNextWeek } = usePolling(
    () => (compact ? api.meals(nextWeekStart) : Promise.resolve(null)),
    [nextWeekStart, compact],
    15000
  );

  // Lunch, folded into this same widget - same 6-day window (today + 5) as
  // the compact dinner slots below, fetched only in compact mode since the
  // full weekly page stays dinner-only (Lunch still has its own full month
  // page). /api/lunch's `end` is exclusive, so it needs to be one day past
  // the last slot's date to actually include it.
  const todayKey = toISODate(new Date());
  const lunchRangeEnd = toISODate(addDays(new Date(), 6));
  const { data: lunchData, setData: setLunchData, refresh: refreshLunch } = usePolling(
    () => (compact ? api.lunchRange(todayKey, lunchRangeEnd) : Promise.resolve(null)),
    [todayKey, lunchRangeEnd, compact],
    30000
  );
  const lunchByDate = {};
  for (const d of lunchData?.days || []) lunchByDate[d.date] = d;

  const [namesByKey, setNamesByKey] = useState({});

  useEffect(() => {
    setNamesByKey((prev) => {
      const next = { ...prev };
      (data?.meals || []).forEach((m) => {
        next[slotId(weekStart, m.day_of_week)] = m.name || '';
      });
      (nextWeekData?.meals || []).forEach((m) => {
        next[slotId(nextWeekStart, m.day_of_week)] = m.name || '';
      });
      return next;
    });
  }, [data, nextWeekData, weekStart, nextWeekStart]);

  const todayDayOfWeek = (new Date().getDay() + 6) % 7; // 0=Mon..6=Sun
  const weekStartDate = startOfWeek(new Date());

  // Full page: the current week, Mon through Sun, same as always. Dashboard
  // widget: today through the next 5 real calendar days (6 total), wherever
  // that falls relative to the Mon-Sun grid. Every slot carries the actual
  // calendar date (not just a weekday name) - "Sun" alone doesn't say which
  // Sunday, which matters once meals are planned against a specific
  // shipment/delivery date instead of just "whatever day this is".
  const slots = compact
    ? Array.from({ length: 6 }, (_, i) => {
        const date = addDays(new Date(), i);
        const ws = toISODate(startOfWeek(date));
        const dow = (date.getDay() + 6) % 7;
        const id = slotId(ws, dow);
        const dateISO = toISODate(date);
        // No school lunch on the weekend, so this row just isn't shown for
        // those two days rather than showing a "No School" placeholder -
        // dow 5/6 are Sat/Sun (0=Mon..6=Sun, see above).
        const isWeekend = dow >= 5;
        const lunchDay = lunchByDate[dateISO];
        const noSchool = !!lunchDay?.no_school;
        return {
          id,
          weekStart: ws,
          dayOfWeek: dow,
          label: WEEKDAY_SHORT[dow],
          dateLabel: date.getDate(),
          isToday: i === 0,
          name: namesByKey[id] || '',
          dateISO,
          lunch: isWeekend
            ? null
            : {
                date: dateISO,
                status: lunchDay?.status || 'home',
                noSchool,
                menuItem: lunchDay?.menu_item,
              },
        };
      })
    : Array.from({ length: 7 }, (_, dow) => {
        const id = slotId(weekStart, dow);
        const date = addDays(weekStartDate, dow);
        return {
          id,
          weekStart,
          dayOfWeek: dow,
          label: WEEKDAY_SHORT[dow],
          dateLabel: date.getDate(),
          isToday: dow === todayDayOfWeek,
          name: namesByKey[id] || '',
        };
      });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  function handleNameChange(slot, value) {
    setNamesByKey((prev) => ({ ...prev, [slot.id]: value }));
  }

  async function toggleLunch(slot) {
    const lunch = slot.lunch;
    if (!lunch || lunch.noSchool) return;
    const nextStatus = lunch.status === 'school' ? 'home' : 'school';
    setLunchData((prev) => {
      const days = prev?.days || [];
      const exists = days.some((d) => d.date === lunch.date);
      return {
        days: exists
          ? days.map((d) => (d.date === lunch.date ? { ...d, status: nextStatus } : d))
          : [...days, { date: lunch.date, status: nextStatus, no_school: false }],
      };
    });
    await api.setLunchDay(lunch.date, { status: nextStatus });
    refreshLunch();
  }

  function refreshForWeek(ws) {
    return ws === weekStart ? refresh() : refreshNextWeek();
  }

  async function commitName(slot) {
    await api.setMeal(slot.weekStart, slot.dayOfWeek, namesByKey[slot.id] || '');
    refreshForWeek(slot.weekStart);
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = parseSlotId(active.id);
    const to = parseSlotId(over.id);
    const fromName = namesByKey[active.id] || '';
    const toName = namesByKey[over.id] || '';

    setNamesByKey((prev) => ({ ...prev, [active.id]: toName, [over.id]: fromName }));
    await Promise.all([
      api.setMeal(from.weekStart, from.dayOfWeek, toName),
      api.setMeal(to.weekStart, to.dayOfWeek, fromName),
    ]);
    refreshForWeek(from.weekStart);
    if (to.weekStart !== from.weekStart) refreshForWeek(to.weekStart);
  }

  return (
    <section className={`widget-card${compact ? ' compact' : ''}`}>
      <div className="widget-header">
        <h2>{compact ? `Dinner & Lunch${childName ? ` — ${childName}` : ''}` : 'Weekly Dinner Menu'}</h2>
        {compact && (
          <div className="widget-header-actions">
            {onExpandLunch && <button className="see-all" onClick={onExpandLunch}>Lunch &rarr;</button>}
            {onExpand && <button className="see-all" onClick={onExpand}>Dinner &rarr;</button>}
          </div>
        )}
      </div>
      {!compact && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: 0 }}>
          Type a meal name for each day, then drag a box onto another day to swap them - the day tabs
          themselves never move.
        </p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className={compact ? 'meal-box-col-compact' : 'meal-box-row'}>
          {slots.map((slot) => (
            <DaySlot
              key={slot.id}
              slot={slot}
              compact={compact}
              onChange={handleNameChange}
              onCommit={commitName}
              onToggleLunch={toggleLunch}
            />
          ))}
        </div>
      </DndContext>
      {!compact && (
        <button
          className="btn btn-primary"
          style={{ marginTop: 8 }}
          onClick={() => Promise.all(slots.map((slot) => commitName(slot)))}
        >
          Save Menu
        </button>
      )}
    </section>
  );
}
