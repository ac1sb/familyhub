import { useEffect, useState } from 'react';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';
import { currentWeekStart, WEEKDAY_SHORT } from '../../lib/week.js';

function dayIndexFromId(id) {
  return Number(id.slice('day-'.length));
}

// Each day is a fixed drop target - unlike a reorderable list, a day's box
// never moves in the grid. Dragging a meal onto another day's box just
// swaps the two typed names; the day tabs above them stay exactly where
// they are the whole time.
function DaySlot({ dayIndex, isToday, name, onChange, onCommit }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${dayIndex}` });
  return (
    <div ref={setNodeRef} className={`meal-box${isOver ? ' drop-target' : ''}`}>
      <div className={`meal-box-day${isToday ? ' today' : ''}`}>{WEEKDAY_SHORT[dayIndex]}</div>
      <DraggableMealInput dayIndex={dayIndex} name={name} onChange={onChange} onCommit={onCommit} />
    </div>
  );
}

function DraggableMealInput({ dayIndex, name, onChange, onCommit }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `day-${dayIndex}` });
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
        value={name}
        onChange={(e) => onChange(dayIndex, e.target.value)}
        onBlur={() => onCommit(dayIndex)}
      />
    </div>
  );
}

export default function MealPlanner({ compact = false, onExpand }) {
  const weekStart = currentWeekStart();
  const { data, refresh } = usePolling(() => api.meals(weekStart), [weekStart], 15000);
  const [names, setNames] = useState(Array(7).fill(''));

  // Dashboard widget: today's box through the rest of the week, capped at 5 -
  // a quick "what's for dinner soon" glance rather than the full week.
  const todayIndex = (new Date().getDay() + 6) % 7; // 0=Mon..6=Sun
  const visibleCount = compact ? Math.min(5, 7 - todayIndex) : 7;
  const visibleOffset = compact ? todayIndex : 0;
  const visibleDayIndexes = Array.from({ length: visibleCount }, (_, i) => visibleOffset + i);

  useEffect(() => {
    if (data?.meals) setNames(data.meals.sort((a, b) => a.day_of_week - b.day_of_week).map((m) => m.name || ''));
  }, [data]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  function handleNameChange(dayIndex, value) {
    setNames((prev) => prev.map((n, i) => (i === dayIndex ? value : n)));
  }

  async function commitName(dayIndex) {
    await api.setMeal(weekStart, dayIndex, names[dayIndex]);
    refresh();
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromDay = dayIndexFromId(active.id);
    const toDay = dayIndexFromId(over.id);
    const next = [...names];
    [next[fromDay], next[toDay]] = [next[toDay], next[fromDay]];
    setNames(next);
    await api.reorderMeals(weekStart, next);
    refresh();
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
          style={compact ? { gridTemplateColumns: `repeat(${visibleCount}, minmax(0, 1fr))` } : undefined}
        >
          {visibleDayIndexes.map((dayIndex) => (
            <DaySlot
              key={dayIndex}
              dayIndex={dayIndex}
              isToday={dayIndex === todayIndex}
              name={names[dayIndex] || ''}
              onChange={handleNameChange}
              onCommit={commitName}
            />
          ))}
        </div>
      </DndContext>
      {!compact && (
        <button
          className="btn btn-primary"
          style={{ marginTop: 8 }}
          onClick={() => Promise.all(names.map((_, i) => commitName(i)))}
        >
          Save Menu
        </button>
      )}
    </section>
  );
}
