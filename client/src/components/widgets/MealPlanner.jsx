import { useEffect, useState } from 'react';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';
import { currentWeekStart, startOfWeek, addDays, toISODate, WEEKDAY_SHORT } from '../../lib/week.js';

function slotId(weekStart, dayOfWeek) {
  return `slot-${weekStart}-${dayOfWeek}`;
}

function parseSlotId(id) {
  const m = /^slot-(\d{4}-\d{2}-\d{2})-(\d)$/.exec(id);
  return { weekStart: m[1], dayOfWeek: Number(m[2]) };
}

// Each day is a fixed drop target - unlike a reorderable list, a day's box
// never moves in the grid. Dragging a meal onto another day's box just
// swaps the two typed names; the day tabs above them stay exactly where
// they are the whole time. A slot carries its own week_start (not just a
// day index) so this still works when two boxes belong to different weeks
// - the dashboard's rolling view can span a week boundary.
function DaySlot({ slot, onChange, onCommit }) {
  const { setNodeRef, isOver } = useDroppable({ id: slot.id });
  return (
    <div ref={setNodeRef} className={`meal-box${isOver ? ' drop-target' : ''}`}>
      <div className={`meal-box-day${slot.isToday ? ' today' : ''}`}>{slot.label}</div>
      <DraggableMealInput slot={slot} onChange={onChange} onCommit={onCommit} />
    </div>
  );
}

function DraggableMealInput({ slot, onChange, onCommit }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: slot.id });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div ref={setNodeRef} style={style} className={`meal-input-wrap${isDragging ? ' dragging' : ''}`}>
      <div className="meal-input-handle" {...attributes} {...listeners} title="Drag onto another day to swap">
        ⠿
      </div>
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

export default function MealPlanner({ compact = false, onExpand }) {
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

  // Full page: the current week, Mon through Sun, same as always. Dashboard
  // widget: today through the next 4 real calendar days, wherever that
  // falls relative to the Mon-Sun grid.
  const slots = compact
    ? Array.from({ length: 5 }, (_, i) => {
        const date = addDays(new Date(), i);
        const ws = toISODate(startOfWeek(date));
        const dow = (date.getDay() + 6) % 7;
        const id = slotId(ws, dow);
        return { id, weekStart: ws, dayOfWeek: dow, label: WEEKDAY_SHORT[dow], isToday: i === 0, name: namesByKey[id] || '' };
      })
    : Array.from({ length: 7 }, (_, dow) => {
        const id = slotId(weekStart, dow);
        return { id, weekStart, dayOfWeek: dow, label: WEEKDAY_SHORT[dow], isToday: dow === todayDayOfWeek, name: namesByKey[id] || '' };
      });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  function handleNameChange(slot, value) {
    setNamesByKey((prev) => ({ ...prev, [slot.id]: value }));
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
        <h2>Weekly Dinner Menu</h2>
        {compact && onExpand && <button className="see-all" onClick={onExpand}>See all &rarr;</button>}
      </div>
      {!compact && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: 0 }}>
          Type a meal name for each day, then drag a box by its ⠿ handle onto another day to swap them - the
          day tabs themselves never move.
        </p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div
          className={compact ? 'meal-box-row meal-box-row-compact' : 'meal-box-row'}
          style={compact ? { gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))` } : undefined}
        >
          {slots.map((slot) => (
            <DaySlot key={slot.id} slot={slot} onChange={handleNameChange} onCommit={commitName} />
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
