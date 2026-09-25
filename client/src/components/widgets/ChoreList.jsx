import { useState } from 'react';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';
import { currentWeekStartSunday, WEEKDAY_SHORT } from '../../lib/week.js';
import { getWidgetDisplayMode } from '../../lib/widgetDisplayMode.js';
import { getTaskIcon } from '../../lib/taskIcons.js';
import { sortDoneLast } from '../../lib/tileOrder.js';
import TileCarousel from '../TileCarousel.jsx';
import TileGridPager from '../TileGridPager.jsx';

const SUNDAY_FIRST_RANK = (dayOfWeek) => (dayOfWeek == null ? 7 : (dayOfWeek + 1) % 7);
// The dashboard tile is a glance, not the whole list - past this many
// still-open chores, the rest are only a tap away on "See all".
const COMPACT_ITEM_LIMIT = 4;

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

// A chore tied to a specific weekday can only be checked off on that day -
// no marking Friday's done on Monday, and no going back to fix Tuesday's
// after the fact. One-off chores with no day attached (day_of_week is null)
// aren't tied to any particular day, so they stay toggleable any time.
function canToggleToday(dayOfWeek, todayDayIndex) {
  return dayOfWeek == null || dayOfWeek === todayDayIndex;
}

export default function ChoreList({ compact = false, onExpand }) {
  // Computed fresh every render (not once at module load) so the widget
  // picks up the new day right after midnight instead of needing a page
  // reload - the parent app already re-renders every minute for the clock.
  const TODAY_DAY_INDEX = (new Date().getDay() + 6) % 7; // 0=Mon..6=Sun
  const weekStart = currentWeekStartSunday();
  const { data, setData, refresh } = usePolling(() => api.chores(weekStart), [weekStart], 15000);
  const [newTitle, setNewTitle] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [displayMode] = useState(() => getWidgetDisplayMode('chores'));

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
    // No assigned_to here - chores are all for one household, not split up
    // by name, so the server just defaults it.
    await api.createChore(weekStart, { title: newTitle.trim() });
    setNewTitle('');
    refresh();
  }

  const weekChores = data?.chores || [];
  const todayChores = weekChores.filter((c) => c.day_of_week == null || c.day_of_week === TODAY_DAY_INDEX);
  // Open chores first (in their existing order), done ones dropped to the
  // bottom - checking one off gives up its spot to the next open chore
  // instead of sitting frozen in place, so what's left to do stays what's
  // most visible. List/Carousel only ever show the top COMPACT_ITEM_LIMIT of
  // this; Squares (below) pages through the whole sorted list instead of
  // capping it.
  const sortedToday = sortDoneLast(todayChores);
  const visible = sortedToday.slice(0, COMPACT_ITEM_LIMIT);

  // The dashboard widget is a "what's due today" glance: a completed-count
  // line plus up to COMPACT_ITEM_LIMIT open chores. The full page (opened
  // from "See all") still lists every chore for the week.
  if (compact) {
    const doneToday = todayChores.filter((c) => c.done).length;
    return (
      <section className="widget-card compact">
        <div className="widget-header">
          <h2>Chores</h2>
          <div className="widget-header-actions">
            {data && (
              <span className="widget-status">
                {todayChores.length === 0 ? 'Nothing due today' : `${doneToday} of ${todayChores.length} done`}
              </span>
            )}
            {onExpand && <button className="see-all" onClick={onExpand}>See all &rarr;</button>}
          </div>
        </div>

        {data && todayChores.length > 0 && doneToday === todayChores.length && (
          <p style={{ color: 'var(--color-text-muted)' }}>All done for today! 🎉</p>
        )}

        {displayMode === 'carousel' && (
          <TileCarousel
            items={visible}
            onToggle={toggleDone}
            renderTile={(chore) => (
              <>
                <span className="tile-title">{chore.title}</span>
                {chore.done && <span className="tile-check">✓</span>}
              </>
            )}
          />
        )}

        {displayMode === 'squares' && (
          <TileGridPager
            items={sortedToday}
            renderTile={(chore) => (
              <button
                type="button"
                className={`tile-square${chore.done ? ' done' : ''}`}
                key={chore.id}
                aria-pressed={chore.done}
                title={chore.title}
                onClick={() => toggleDone(chore)}
              >
                <span className="tile-icon">{chore.icon || getTaskIcon(chore.title)}</span>
                <span className="tile-title">{chore.title}</span>
                {chore.done && <span className="tile-check">✓</span>}
              </button>
            )}
          />
        )}

        {displayMode === 'list' && visible.map((chore) => (
          <button
            type="button"
            className={`tile-row${chore.done ? ' done' : ''}`}
            key={chore.id}
            aria-pressed={chore.done}
            onClick={() => toggleDone(chore)}
          >
            <span className="tile-title">{chore.title}</span>
            {chore.done && <span className="tile-check">✓</span>}
          </button>
        ))}
      </section>
    );
  }

  const rows = groupChores(weekChores);
  const openRows = rows.filter((r) => !isRowDone(r));
  const doneCount = rows.length - openRows.length;
  const visibleRows = showDone ? rows : openRows;

  return (
    <section className="widget-card">
      <div className="widget-header">
        <h2>Chore List</h2>
      </div>

      {visibleRows.map((row) =>
        row.type === 'group' ? (
          <div className="chore-row chore-group-row" key={`group-${row.template_id}`}>
            <span className={`chore-title${isRowDone(row) ? ' done' : ''}`}>{row.title}</span>
            <div className="chore-day-badges">
              {row.instances.map((inst) => {
                const canToggle = canToggleToday(inst.day_of_week, TODAY_DAY_INDEX);
                return (
                  <button
                    key={inst.id}
                    type="button"
                    className={`chore-day-toggle${inst.done ? ' done' : ''}${canToggle ? '' : ' locked'}`}
                    onClick={() => canToggle && toggleDone(inst)}
                    disabled={!canToggle}
                    title={canToggle ? (inst.done ? 'Mark not done' : 'Mark done') : 'Only today\'s chore can be checked off'}
                  >
                    {inst.done ? '✓ ' : ''}{WEEKDAY_SHORT[inst.day_of_week]}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          (() => {
            const canToggle = canToggleToday(row.chore.day_of_week, TODAY_DAY_INDEX);
            return (
              <button
                type="button"
                className={`tile-row${row.chore.done ? ' done' : ''}${canToggle ? '' : ' locked'}`}
                key={row.chore.id}
                aria-pressed={row.chore.done}
                onClick={() => canToggle && toggleDone(row.chore)}
                disabled={!canToggle}
                title={canToggle ? undefined : 'Only today\'s chore can be checked off'}
              >
                {row.chore.day_of_week != null && (
                  <span className="chore-day-tag">{WEEKDAY_SHORT[row.chore.day_of_week]}</span>
                )}
                <span className="tile-title">{row.chore.title}</span>
                {row.chore.done && <span className="tile-check">✓</span>}
              </button>
            );
          })()
        )
      )}
      {data && openRows.length === 0 && !showDone && (
        <p style={{ color: 'var(--color-text-muted)' }}>
          {rows.length === 0 ? 'No chores yet this week.' : 'All done for this week! 🎉'}
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
        <button className="btn btn-primary" onClick={addChore}>Add</button>
      </div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: 10, marginBottom: 0 }}>
        Want a chore to repeat every week? Set it up once in Settings &rarr; Chore Setup. Week starts Sunday.
      </p>
    </section>
  );
}
