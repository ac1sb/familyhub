import { useState } from 'react';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';
import { currentWeekStartSunday, WEEKDAY_SHORT } from '../../lib/week.js';

export default function ChoreList({ members, compact = false, onExpand }) {
  const weekStart = currentWeekStartSunday();
  const { data, setData, refresh } = usePolling(() => api.chores(weekStart), [weekStart], 15000);
  const [newTitle, setNewTitle] = useState('');
  const [assignedTo, setAssignedTo] = useState('family');
  const [showDone, setShowDone] = useState(false);

  async function toggleDone(chore) {
    setData((prev) => ({
      ...prev,
      chores: prev.chores.map((c) => (c.id === chore.id ? { ...c, done: !c.done } : c)),
    }));
    await api.updateChore(chore.id, { done: !chore.done });
    refresh();
  }

  async function addChore() {
    if (!newTitle.trim()) return;
    await api.createChore(weekStart, { title: newTitle.trim(), assigned_to: assignedTo });
    setNewTitle('');
    refresh();
  }

  async function removeChore(id) {
    await api.deleteChore(id);
    refresh();
  }

  const allMembers = { ...members, family: 'Family' };
  const allChores = data?.chores || [];
  const openChores = allChores.filter((c) => !c.done);
  const doneCount = allChores.length - openChores.length;
  const visibleChores = showDone ? allChores : openChores;

  return (
    <section className={`widget-card${compact ? ' compact' : ''}`}>
      <div className="widget-header">
        <h2>Chore List</h2>
        {compact && onExpand && <button className="see-all" onClick={onExpand}>See all &rarr;</button>}
      </div>

      {visibleChores.map((chore) => (
        <div className="chore-row" key={chore.id}>
          <input type="checkbox" checked={chore.done} onChange={() => toggleDone(chore)} />
          {chore.day_of_week != null && (
            <span className="chore-day-tag">{WEEKDAY_SHORT[chore.day_of_week]}</span>
          )}
          <span className={`chore-title${chore.done ? ' done' : ''}`}>
            {chore.template_id && <span title="Repeats on selected days">🔁 </span>}
            {chore.title}
          </span>
          <span className={`chore-tag ${chore.assigned_to}`}>{allMembers[chore.assigned_to] || chore.assigned_to}</span>
          <button className="btn-icon" onClick={() => removeChore(chore.id)}>✕</button>
        </div>
      ))}
      {data && openChores.length === 0 && !showDone && (
        <p style={{ color: 'var(--color-text-muted)' }}>
          {allChores.length === 0 ? 'No chores yet this week.' : 'All done for this week! 🎉'}
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
          placeholder="Add a one-time chore…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addChore()}
        />
        <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
          {Object.entries(allMembers).map(([key, name]) => (
            <option key={key} value={key}>{name}</option>
          ))}
        </select>
        <button className="btn btn-primary" onClick={addChore}>Add</button>
      </div>
      {!compact && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: 10, marginBottom: 0 }}>
          Want a chore to repeat every week? Set it up once in Settings &rarr; Chore Setup. Week starts Sunday.
        </p>
      )}
    </section>
  );
}
