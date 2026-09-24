import { useState } from 'react';
import { usePolling } from '../../hooks/usePolling.js';
import { useStickyCompactSlots } from '../../hooks/useStickyCompactSlots.js';
import { api } from '../../api.js';
import { todayISO } from '../../lib/week.js';
import { getWidgetDisplayMode } from '../../lib/widgetDisplayMode.js';
import TileCarousel from '../TileCarousel.jsx';

// The dashboard tile is a glance, not the whole list - past this many
// still-open items, the rest are only a tap away on "See all".
const COMPACT_ITEM_LIMIT = 4;

export default function DailyChecklist({ compact = false, onExpand }) {
  const today = todayISO();
  const { data, setData, refresh } = usePolling(() => api.dailyTasks(today), [today], 15000);
  const [newTitle, setNewTitle] = useState('');
  const [displayMode] = useState(() => getWidgetDisplayMode('daily'));

  async function toggleDone(task) {
    setData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)),
    }));
    await api.updateDailyTask(task.id, { done: !task.done });
    refresh();
  }

  async function addTask() {
    if (!newTitle.trim()) return;
    // No assigned_to here - this list is for one household, not split up by
    // name, so the server just defaults it.
    await api.createDailyTask(today, { title: newTitle.trim() });
    setNewTitle('');
    refresh();
  }

  const tasks = data?.tasks || [];
  // Called unconditionally (not inside the `if (compact)` branch below) so
  // it stays a valid hook call on the full-page render too, even though its
  // result only matters for the compact widget.
  const visible = useStickyCompactSlots(tasks, COMPACT_ITEM_LIMIT);

  // The dashboard widget is a glance: a completed-count line plus up to
  // COMPACT_ITEM_LIMIT items, checked or not. Checking one off shows its
  // strikethrough right in place - it only rolls off (making room for the
  // next open one) once there's an open item waiting that isn't already
  // shown; see useStickyCompactSlots. The full page (opened from "See all")
  // still lists every item.
  if (compact) {
    const doneCount = tasks.filter((t) => t.done).length;
    return (
      <section className="widget-card compact">
        <div className="widget-header">
          <h2>Daily Checklist</h2>
          <div className="widget-header-actions">
            {data && (
              <span className="widget-status">
                {tasks.length === 0 ? "Nothing on today's list" : `${doneCount} of ${tasks.length} done`}
              </span>
            )}
            {onExpand && <button className="see-all" onClick={onExpand}>See all &rarr;</button>}
          </div>
        </div>

        {data && tasks.length > 0 && doneCount === tasks.length && (
          <p style={{ color: 'var(--color-text-muted)' }}>All done for today! 🎉</p>
        )}

        {displayMode === 'carousel' && (
          <TileCarousel
            items={visible}
            onToggle={toggleDone}
            renderTile={(task) => (
              <>
                <span className="tile-title">
                  {task.template_id && <span title="Repeats on selected days">🔁 </span>}
                  {task.title}
                </span>
                {task.done && <span className="tile-check">✓</span>}
              </>
            )}
          />
        )}

        {displayMode === 'squares' && (
          <div className="tile-grid">
            {visible.map((task) => (
              <button
                type="button"
                className={`tile-square${task.done ? ' done' : ''}`}
                key={task.id}
                aria-pressed={task.done}
                title={task.title}
                onClick={() => toggleDone(task)}
              >
                <span className="tile-title">
                  {task.template_id && <span title="Repeats on selected days">🔁 </span>}
                  {task.title}
                </span>
                {task.done && <span className="tile-check">✓</span>}
              </button>
            ))}
          </div>
        )}

        {displayMode === 'list' && visible.map((task) => (
          <button
            type="button"
            className={`tile-row${task.done ? ' done' : ''}`}
            key={task.id}
            aria-pressed={task.done}
            onClick={() => toggleDone(task)}
          >
            <span className="tile-title">
              {task.template_id && <span title="Repeats on selected days">🔁 </span>}
              {task.title}
            </span>
            {task.done && <span className="tile-check">✓</span>}
          </button>
        ))}
      </section>
    );
  }

  return (
    <section className="widget-card">
      <div className="widget-header">
        <h2>Today's Checklist</h2>
      </div>

      {tasks.map((task) => (
        <button
          type="button"
          className={`tile-row${task.done ? ' done' : ''}`}
          key={task.id}
          aria-pressed={task.done}
          onClick={() => toggleDone(task)}
        >
          <span className="tile-title">
            {task.template_id && <span title="Repeats on selected days">🔁 </span>}
            {task.title}
          </span>
          {task.done && <span className="tile-check">✓</span>}
        </button>
      ))}
      {data && tasks.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>Nothing on today's list.</p>}

      <div className="add-row">
        <input
          type="text"
          placeholder="Add a one-time item…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTask()}
        />
        <button className="btn btn-primary" onClick={addTask}>Add</button>
      </div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: 10, marginBottom: 0 }}>
        Want something to repeat every day (or just school days)? Set it up once in Settings &rarr; Daily Checklist Setup.
      </p>
    </section>
  );
}
