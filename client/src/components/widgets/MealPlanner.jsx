import { useEffect, useState } from 'react';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';
import { currentWeekStart, WEEKDAY_LABELS } from '../../lib/week.js';

function SortableMealSlot({ id, dayIndex, name, onChange, onCommit }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={`meal-slot${isDragging ? ' dragging' : ''}`}>
      <span className="drag-handle" {...attributes} {...listeners}>⠿</span>
      <span className="day-badge">{WEEKDAY_LABELS[dayIndex]}</span>
      <input
        type="text"
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
          Type a meal name for each day, then drag the ⠿ handle to reorder which meal falls on which day.
        </p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          {order.map((id, idx) => (
            <SortableMealSlot
              key={id}
              id={id}
              dayIndex={idx}
              name={names[idx] || ''}
              onChange={handleNameChange}
              onCommit={commitName}
            />
          ))}
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
