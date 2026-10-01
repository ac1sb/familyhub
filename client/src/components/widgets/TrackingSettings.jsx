import { useEffect, useState } from 'react';
import { api } from '../../api.js';

// How many of the most recent expected days to actually show per item -
// trimmed down from however many the API returns (up to 60 days back) so a
// chore scheduled every day doesn't turn into a wall of chips on a settings
// page meant to answer one simple question at a glance.
const CHIP_LIMIT = 14;

function formatChipDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'numeric',
    day: 'numeric',
  });
}

function TrackingItem({ item }) {
  const shown = item.entries.slice(0, CHIP_LIMIT);
  const doneCount = shown.filter((e) => e.done).length;

  return (
    <div className="tracking-item">
      <div className="tracking-item-header">
        <span className="tracking-item-title">{item.title}</span>
        {shown.length > 0 && (
          <span className="tracking-item-score">{doneCount} of {shown.length}</span>
        )}
      </div>
      <div className="tracking-chip-row">
        {shown.length === 0 && <span className="tracking-item-empty">No expected days yet</span>}
        {[...shown].reverse().map((entry) => (
          <span
            key={entry.date}
            className={`tracking-chip${entry.done ? ' done' : ' missed'}`}
            title={`${formatChipDate(entry.date)} – ${entry.done ? 'Done' : 'Not done'}`}
          >
            {entry.done ? '✓' : '✕'}
          </span>
        ))}
      </div>
    </div>
  );
}

function TrackingGroup({ title, items, loading, emptyText }) {
  return (
    <div className="settings-section">
      <div className="settings-section-title">{title}</div>
      {loading && <p className="settings-section-intro">Loading…</p>}
      {!loading && items.length === 0 && <p className="settings-section-intro">{emptyText}</p>}
      {!loading && items.map((item) => <TrackingItem key={item.template_id} item={item} />)}
    </div>
  );
}

// A plain yes/no history, per recurring chore/checklist item, of whether it
// actually got done on the day it was expected - the one question that
// actually matters day to day, deliberately left at that instead of growing
// into a points/rewards system.
export default function TrackingSettings() {
  const [chores, setChores] = useState([]);
  const [dailyTasks, setDailyTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.choreTracking(), api.dailyTaskTracking()])
      .then(([choreData, dailyData]) => {
        setChores(choreData.items);
        setDailyTasks(dailyData.items);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="settings-content">
      <div className="settings-section">
        <div className="settings-section-title">Chore &amp; Checklist Tracking</div>
        <p className="settings-section-intro">
          A simple yes/no history of whether each recurring chore or checklist item actually got done
          on the day it was expected - the most recent {CHIP_LIMIT} expected days for each, oldest on
          the left. One-time items (added straight from an "Add a one-time…" box) aren't on a schedule,
          so there's nothing to track for those - set one up as a recurring item in Chore Setup or Daily
          Checklist Setup first.
        </p>
      </div>
      <TrackingGroup
        title="Chores"
        items={chores}
        loading={loading}
        emptyText="No active recurring chores yet - add some in Chore Setup."
      />
      <TrackingGroup
        title="Daily Checklist"
        items={dailyTasks}
        loading={loading}
        emptyText="No active recurring checklist items yet - add some in Daily Checklist Setup."
      />
    </div>
  );
}
