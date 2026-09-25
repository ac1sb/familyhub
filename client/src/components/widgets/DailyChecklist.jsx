import { useState } from 'react';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';
import { todayISO } from '../../lib/week.js';
import { getWidgetDisplayMode } from '../../lib/widgetDisplayMode.js';
import { getTaskIcon } from '../../lib/taskIcons.js';
import { sortDoneLast } from '../../lib/tileOrder.js';
import TileCarousel from '../TileCarousel.jsx';
import TileGridPager from '../TileGridPager.jsx';

// The dashboard tile is a glance, not the whole list - past this many
// still-open items, the rest are only a tap away on "See all".
const COMPACT_ITEM_LIMIT = 4;

export default function DailyChecklist({ compact = false, onExpand }) {
  const today = todayISO();
  const { data, setData, refresh } = usePolling(() => api.dailyTasks(today), [today], 15000);
  const [newTitle, setNewTitle] = useState('');
  const [displayMode] = useState(() => getWidgetDisplayMode('daily'));
  const [showDone, setShowDone] = useState(false);

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
  // Open items first (in their existing order), done ones dropped to the
  // bottom - checking one off gives up its spot to the next open item
  // instead of sitting frozen in place, so what's left to do stays what's
  // most visible. List/Carousel only ever show the top COMPACT_ITEM_LIMIT of
  // this; Squares (below) pages through the whole sorted list instead of
  // capping it.
  const sortedTasks = sortDoneLast(tasks);
  const visible = sortedTasks.slice(0, COMPACT_ITEM_LIMIT);

  // The dashboard widget is a glance: a completed-count line plus up to
  // COMPACT_ITEM_LIMIT open items. The full page (opened from "See all")
  // still lists every item, same "hide completed" pattern as Chore List.
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
          <TileGridPager
            items={sortedTasks}
            renderTile={(task) => (
              <button
                type="button"
                className={`tile-square${task.done ? ' done' : ''}`}
                key={task.id}
                aria-pressed={task.done}
                title={task.title}
                onClick={() => toggleDone(task)}
              >
                {task.template_id && (
                  <span className="tile-repeat-badge" title="Repeats on selected days">🔁</span>
                )}
                <span className="tile-icon">{task.icon || getTaskIcon(task.title)}</span>
                <span className="tile-title">{task.title}</span>
                {task.done && <span className="tile-check">✓</span>}
              </button>
            )}
          />
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

  const openTasks = tasks.filter((t) => !t.done);
  const doneCount = tasks.length - openTasks.length;
  const visibleTasks = showDone ? tasks : openTasks;

  return (
    <section className="widget-card">
      <div className="widget-header">
        <h2>Today's Checklist</h2>
      </div>

      {visibleTasks.map((task) => (
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
      {data && openTasks.length === 0 && !showDone && (
        <p style={{ color: 'var(--color-text-muted)' }}>
          {tasks.length === 0 ? "Nothing on today's list." : 'All done for today! 🎉'}
        </p>
      )}

      {doneCount > 0 && (
        <button className="btn-link" onClick={() => setShowDone((v) => !v)} style={{ marginTop: 4 }}>
          {showDone ? 'Hide completed' : `Show completed (${doneCount})`}
        </button>
      )}

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
