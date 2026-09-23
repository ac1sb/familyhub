import { useEffect, useState } from 'react';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';
import { currentWeekStart, WEEKDAY_SHORT } from '../../lib/week.js';

function SortableMealBox({ id, dayIndex, name, onChange, onCommit }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={`meal-box${isDragging ? ' dragging' : ''}`}>
      <div className="meal-box-day" {...attributes} {...listeners}>
        {WEEKDAY_SHORT[dayIndex]}
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
  const [order, setOrder] = useState(Array.from({ length: 7 }, (_, i) => `slot-${i}`));

  // Dashboard widget: today's box through the rest of the week, capped at 5 -
  // a quick "what's for dinner soon" glance rather than the full week.
  const todayIndex = (new Date().getDay() + 6) % 7; // 0=Mon..6=Sun
  const visibleCount = compact ? Math.min(5, 7 - todayIndex) : 7;
  const visibleOffset = compact ? todayIndex : 0;
  const visibleOrder = order.slice(visibleOffset, visibleOffset + visibleCount);

  useEffect(() => {
    if (data?.meals) setNames(data.meals.sort((a, b) => a.day_of_week - b.day_of_week).map((m) => m.name || ''));
  }, [data]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  async function handleNameChange(dayIndex, value) {
    const next = [...names];
    next[dayIndex] = value;
    setNames(next);
  }

  async function commitName(dayIndex) {
    await api.setMeal(weekStart, dayIndex, names[dayIndex]);
    refresh();
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(active.id);
    const newIndex = order.indexOf(over.id);
    const newOrder = arrayMove(order, oldIndex, newIndex);
    const newNames = arrayMove(names, oldIndex, newIndex);
    setOrder(newOrder);
    setNames(newNames);
    await api.reorderMeals(weekStart, newNames);
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
          Type a meal name for each day, then drag a box by its day label to move it to a different day.
        </p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleOrder} strategy={horizontalListSortingStrategy}>
          <div className={compact ? 'meal-box-row meal-box-row-compact' : 'meal-box-row'}>
            {visibleOrder.map((id) => {
              const dayIndex = order.indexOf(id);
              return (
                <SortableMealBox
                  key={id}
                  id={id}
                  dayIndex={dayIndex}
                  name={names[dayIndex] || ''}
                  onChange={handleNameChange}
                  onCommit={commitName}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
      {!compact && (
        <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => Promise.all(names.map((_, i) => commitName(i)))}>
          Save Menu
        </button>
      )}
    </section>
  );
}
