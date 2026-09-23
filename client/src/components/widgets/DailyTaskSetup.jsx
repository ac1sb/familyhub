import { useState } from 'react';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';
import { WEEKDAY_SHORT } from '../../lib/week.js';

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function DayChips({ days, onToggle }) {
  return (
    <div className="chore-day-chips">
      {WEEKDAY_SHORT.map((label, idx) => (
        <button
          key={idx}
          type="button"
          className={`chore-day-chip${days.includes(idx) ? ' active' : ''}`}
          onClick={() => onToggle(idx)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function DailyTaskSetup({ members }) {
  const { data, setData, refresh } = usePolling(() => api.dailyTaskTemplates(), [], 20000);
  const [newTitle, setNewTitle] = useState('');
  const [assignedTo, setAssignedTo] = useState('family');
  const [newDays, setNewDays] = useState(ALL_DAYS);

  const allMembers = { ...(members || {}), family: 'Family' };

  function toggleNewDay(day) {
    setNewDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  }

  async function addTemplate() {
    if (!newTitle.trim() || newDays.length === 0) return;
    await api.createDailyTaskTemplate({ title: newTitle.trim(), assigned_to: assignedTo, days: newDays });
    setNewTitle('');
    setNewDays(ALL_DAYS);
    refresh();
  }

  async function toggleActive(template) {
    setData((prev) => ({
      templates: prev.templates.map((t) => (t.id === template.id ? { ...t, active: !t.active } : t)),
    }));
    await api.updateDailyTaskTemplate(template.id, { active: !template.active });
    refresh();
  }

  async function toggleTemplateDay(template, day) {
    const days = template.days.includes(day)
      ? template.days.filter((d) => d !== day)
      : [...template.days, day].sort((a, b) => a - b);
    if (days.length === 0) return; // must keep at least one day
    setData((prev) => ({
      templates: prev.templates.map((t) => (t.id === template.id ? { ...t, days } : t)),
    }));
    await api.updateDailyTaskTemplate(template.id, { days });
    refresh();
  }

  async function setTemplateEveryDay(template) {
    setData((prev) => ({
      templates: prev.templates.map((t) => (t.id === template.id ? { ...t, days: ALL_DAYS } : t)),
    }));
    await api.updateDailyTaskTemplate(template.id, { days: ALL_DAYS });
    refresh();
  }

  async function removeTemplate(id) {
    await api.deleteDailyTaskTemplate(id);
    refresh();
  }

  return (
    <div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: 0 }}>
        Daily routine items (empty lunch box, practice clarinet, ...) show up on whichever days you pick,
        already unchecked - and reset again fresh the next day, unlike weekly chores.
      </p>

      {(data?.templates || []).map((template) => (
        <div className="chore-setup-row" key={template.id}>
          <div className="chore-row">
            <input type="checkbox" checked={template.active} onChange={() => toggleActive(template)} title="Active" />
            <span className={`chore-title${template.active ? '' : ' done'}`}>{template.title}</span>
            <span className={`chore-tag ${template.assigned_to}`}>
              {allMembers[template.assigned_to] || template.assigned_to}
            </span>
            <button className="btn-icon" onClick={() => removeTemplate(template.id)}>✕</button>
          </div>
          <div className="chore-day-picker">
            <DayChips days={template.days} onToggle={(day) => toggleTemplateDay(template, day)} />
            <button className="btn-link" onClick={() => setTemplateEveryDay(template)}>Every day</button>
          </div>
        </div>
      ))}
      {data && data.templates.length === 0 && (
        <p style={{ color: 'var(--color-text-muted)' }}>No daily routine items set up yet.</p>
      )}

      <div className="add-row" style={{ flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="e.g. Empty lunch box"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTemplate()}
        />
        <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
          {Object.entries(allMembers).map(([key, name]) => (
            <option key={key} value={key}>{name}</option>
          ))}
        </select>
        <button className="btn btn-primary" onClick={addTemplate} disabled={newDays.length === 0}>Add</button>
      </div>
      <div className="chore-day-picker">
        <DayChips days={newDays} onToggle={toggleNewDay} />
        <button className="btn-link" onClick={() => setNewDays(ALL_DAYS)}>Every day</button>
      </div>
    </div>
  );
}
