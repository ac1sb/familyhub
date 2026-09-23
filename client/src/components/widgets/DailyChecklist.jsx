import { useState } from 'react';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';
import { todayISO } from '../../lib/week.js';

export default function DailyChecklist({ members, compact = false, onExpand }) {
  const today = todayISO();
  const { data, setData, refresh } = usePolling(() => api.dailyTasks(today), [today], 15000);
  const [newTitle, setNewTitle] = useState('');
  const [assignedTo, setAssignedTo] = useState('family');

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
    await api.createDailyTask(today, { title: newTitle.trim(), assigned_to: assignedTo });
    setNewTitle('');
    refresh();
  }

  async function removeTask(id) {
    await api.deleteDailyTask(id);
    refresh();
  }

  const allMembers = { ...members, family: 'Family' };
  const tasks = data?.tasks || [];

  return (
    <section className={`widget-card${compact ? ' compact' : ''}`}>
      <div className="widget-header">
        <h2>Today's Checklist</h2>
        {compact && onExpand && <button className="see-all" onClick={onExpand}>See all &rarr;</button>}
      </div>

      {tasks.map((task) => (
        <div className="chore-row" key={task.id}>
          <input type="checkbox" checked={task.done} onChange={() => toggleDone(task)} />
          <span className={`chore-title${task.done ? ' done' : ''}`}>
            {task.template_id && <span title="Repeats on selected days">🔁 </span>}
            {task.title}
          </span>
          <span className={`chore-tag ${task.assigned_to}`}>{allMembers[task.assigned_to] || task.assigned_to}</span>
          <button className="btn-icon" onClick={() => removeTask(task.id)}>✕</button>
        </div>
      ))}
      {data && tasks.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>Nothing on today's list.</p>}

      {!compact && (
        <>
          <div className="add-row">
            <input
              type="text"
              placeholder="Add a one-time item…"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTask()}
            />
            <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
              {Object.entries(allMembers).map(([key, name]) => (
                <option key={key} value={key}>{name}</option>
              ))}
            </select>
            <button className="btn btn-primary" onClick={addTask}>Add</button>
          </div>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: 10, marginBottom: 0 }}>
            Want something to repeat every day (or just school days)? Set it up once in Settings &rarr; Daily Checklist Setup.
          </p>
        </>
      )}
    </section>
  );
}
