import { useState } from 'react';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';
import { currentWeekStartSunday, WEEKDAY_SHORT } from '../../lib/week.js';

const SUNDAY_FIRST_RANK = (dayOfWeek) => (dayOfWeek == null ? 7 : (dayOfWeek + 1) % 7);

// The full page groups every instance of a recurring chore (same
// template_id) into one row with a badge per expected day, instead of a
// separate row per day - "Dish washer" set up for Mon/Wed/Thu shows once,
// not three times. A one-off chore (no template) has nothing to group with,
// so it keeps its own single-checkbox row exactly as before.
function groupChores(chores) {
  const rows = [];
  const seenTemplates = new Set();
  for (const chore of chores) {
    if (!chore.template_id) {
      rows.push({ type: 'single', chore, sortKey: SUNDAY_FIRST_RANK(chore.day_of_week) });
      continue;
    }
    if (seenTemplates.has(chore.template_id)) continue;
    seenTemplates.add(chore.template_id);
    const instances = chores
      .filter((c) => c.template_id === chore.template_id)
      .sort((a, b) => SUNDAY_FIRST_RANK(a.day_of_week) - SUNDAY_FIRST_RANK(b.day_of_week));
    rows.push({
      type: 'group',
      template_id: chore.template_id,
      title: chore.title,
      assigned_to: chore.assigned_to,
      instances,
      sortKey: Math.min(...instances.map((i) => SUNDAY_FIRST_RANK(i.day_of_week))),
    });
  }
  rows.sort((a, b) => a.sortKey - b.sortKey);
  return rows;
}

function isRowDone(row) {
  return row.type === 'group' ? row.instances.every((i) => i.done) : row.chore.done;
}

export default function ChoreList({ members, compact = false, onExpand }) {
  // Computed fresh every render (not once at module load) so the widget
  // picks up the new day right after midnight instead of needing a page
  // reload - the parent app already re-renders every minute for the clock.
  const TODAY_DAY_INDEX = (new Date().getDay() + 6) % 7; // 0=Mon..6=Sun
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
  const weekChores = data?.chores || [];
  // The dashboard widget is a "what's due today" glance; the full page (not
  // compact) still shows the whole week for planning ahead.
  const scopedChores = compact
    ? weekChores.filter((c) => c.day_of_week == null || c.day_of_week === TODAY_DAY_INDEX)
    : weekChores;

  const rows = compact
    ? scopedChores.map((chore) => ({ type: 'single', chore }))
    : groupChores(scopedChores);
  const openRows = rows.filter((r) => !isRowDone(r));
  const doneCount = rows.length - openRows.length;
  // The dashboard widget keeps a chore visible (checked off) for the rest of
  // the day once it's done, instead of hiding it - it disappears on its own
  // once the day rolls over and it's no longer in today's scopedChores. The
  // full page keeps its "Show completed" toggle since it covers a whole week.
  const visibleRows = compact ? rows : (showDone ? rows : openRows);
  const allDone = rows.length > 0 && openRows.length === 0;

  return (
    <section className={`widget-card${compact ? ' compact' : ''}`}>
      <div className="widget-header">
        <h2>{compact ? "Today's Chores" : 'Chore List'}</h2>
        {compact && onExpand && <button className="see-all" onClick={onExpand}>See all &rarr;</button>}
      </div>

      {compact && data && allDone && (
        <p style={{ color: 'var(--color-text-muted)' }}>All done for today! 🎉</p>
      )}
      {compact && data && rows.length === 0 && (
        <p style={{ color: 'var(--color-text-muted)' }}>Nothing due today.</p>
      )}

      {visibleRows.map((row) =>
        row.type === 'group' ? (
          <div className="chore-row chore-group-row" key={`group-${row.template_id}`}>
            <span className={`chore-title${isRowDone(row) ? ' done' : ''}`}>{row.title}</span>
            <div className="chore-day-badges">
              {row.instances.map((inst) => (
                <button
                  key={inst.id}
                  type="button"
                  className={`chore-day-toggle${inst.done ? ' done' : ''}`}
                  onClick={() => toggleDone(inst)}
                  title={inst.done ? 'Mark not done' : 'Mark done'}
                >
                  {WEEKDAY_SHORT[inst.day_of_week]}
                </button>
              ))}
            </div>
            <span className={`chore-tag ${row.assigned_to}`}>{allMembers[row.assigned_to] || row.assigned_to}</span>
          </div>
        ) : (
          <div className="chore-row" key={row.chore.id}>
            <input type="checkbox" checked={row.chore.done} onChange={() => toggleDone(row.chore)} />
            {!compact && row.chore.day_of_week != null && (
              <span className="chore-day-tag">{WEEKDAY_SHORT[row.chore.day_of_week]}</span>
            )}
            <span className={`chore-title${row.chore.done ? ' done' : ''}`}>{row.chore.title}</span>
            <span className={`chore-tag ${row.chore.assigned_to}`}>
              {allMembers[row.chore.assigned_to] || row.chore.assigned_to}
            </span>
            <button className="btn-icon" onClick={() => removeChore(row.chore.id)}>✕</button>
          </div>
        )
      )}
      {!compact && data && openRows.length === 0 && !showDone && (
        <p style={{ color: 'var(--color-text-muted)' }}>
          {rows.length === 0 ? 'No chores yet this week.' : 'All done for this week! 🎉'}
        </p>
      )}

      {!compact && doneCount > 0 && (
        <button className="btn-link" onClick={() => setShowDone((v) => !v)} style={{ marginTop: 4 }}>
          {showDone ? 'Hide completed' : `Show completed (${doneCount})`}
        </button>
      )}

      {!compact && (
        <>
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
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: 10, marginBottom: 0 }}>
            Want a chore to repeat every week? Set it up once in Settings &rarr; Chore Setup. Week starts Sunday.
          </p>
        </>
      )}
    </section>
  );
}
