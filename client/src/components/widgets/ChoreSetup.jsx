import { useState } from 'react';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';
import { WEEKDAY_SHORT, SUNDAY_FIRST_DAY_ORDER } from '../../lib/week.js';

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

// Chores' week starts Sunday, so the day picker lists Sun first too, even
// though each chip's underlying value is still the app-wide 0=Mon..6=Sun index.
function DayChips({ days, onToggle }) {
  return (
    <div className="chore-day-chips">
      {SUNDAY_FIRST_DAY_ORDER.map((idx) => (
        <button
          key={idx}
          type="button"
          className={`chore-day-chip${days.includes(idx) ? ' active' : ''}`}
          onClick={() => onToggle(idx)}
        >
          {WEEKDAY_SHORT[idx]}
        </button>
      ))}
    </div>
  );
}

export default function ChoreSetup() {
  const { data, setData, refresh } = usePolling(() => api.choreTemplates(), [], 20000);
  const [newTitle, setNewTitle] = useState('');
  const [newDays, setNewDays] = useState(ALL_DAYS);
  const [addError, setAddError] = useState(null);

  function toggleNewDay(day) {
    setNewDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  }

  async function addTemplate() {
    if (!newTitle.trim() || newDays.length === 0) return;
    setAddError(null);
    try {
      // No assigned_to here - chores are all for one household, not split up
      // by name, so the server just defaults it.
      await api.createChoreTemplate({ title: newTitle.trim(), days: newDays });
      setNewTitle('');
      setNewDays(ALL_DAYS);
      refresh();
    } catch (err) {
      setAddError(err.message);
    }
  }

  function handleTitleChange(templateId, title) {
    setData((prev) => ({
      templates: prev.templates.map((t) => (t.id === templateId ? { ...t, title } : t)),
    }));
  }

  async function commitTitle(templateId, title) {
    if (!title.trim()) {
      refresh(); // empty name isn't saved - snap back to the last real value
      return;
    }
    await api.updateChoreTemplate(templateId, { title: title.trim() });
    refresh();
  }

  async function toggleActive(template) {
    setData((prev) => ({
      templates: prev.templates.map((t) => (t.id === template.id ? { ...t, active: !t.active } : t)),
    }));
    await api.updateChoreTemplate(template.id, { active: !template.active });
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
    await api.updateChoreTemplate(template.id, { days });
    refresh();
  }

  async function setTemplateEveryDay(template) {
    setData((prev) => ({
      templates: prev.templates.map((t) => (t.id === template.id ? { ...t, days: ALL_DAYS } : t)),
    }));
    await api.updateChoreTemplate(template.id, { days: ALL_DAYS });
    refresh();
  }

  async function removeTemplate(id) {
    await api.deleteChoreTemplate(id);
    refresh();
  }

  return (
    <div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: 0 }}>
        Chores added here automatically appear on everyone's weekly chore list, on whichever days you pick,
        already unchecked. Turn one off instead of deleting it if it's just paused for a while.
      </p>

      {(data?.templates || []).map((template) => (
        <div className="chore-setup-row" key={template.id}>
          <div className="chore-row">
            <input type="checkbox" checked={template.active} onChange={() => toggleActive(template)} title="Active" />
            <input
              type="text"
              className={`chore-title-input${template.active ? '' : ' done'}`}
              value={template.title}
              onChange={(e) => handleTitleChange(template.id, e.target.value)}
              onBlur={(e) => commitTitle(template.id, e.target.value)}
            />
            <button className="btn-icon" onClick={() => removeTemplate(template.id)}>✕</button>
          </div>
          <div className="chore-day-picker">
            <DayChips days={template.days} onToggle={(day) => toggleTemplateDay(template, day)} />
            <button className="btn-link" onClick={() => setTemplateEveryDay(template)}>Every day</button>
          </div>
        </div>
      ))}
      {data && data.templates.length === 0 && (
        <p style={{ color: 'var(--color-text-muted)' }}>No recurring chores set up yet.</p>
      )}

      <div className="add-row" style={{ flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="e.g. Take out the trash"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTemplate()}
        />
        <button className="btn btn-primary" onClick={addTemplate} disabled={newDays.length === 0}>Add</button>
      </div>
      <div className="chore-day-picker">
        <DayChips days={newDays} onToggle={toggleNewDay} />
        <button className="btn-link" onClick={() => setNewDays(ALL_DAYS)}>Every day</button>
      </div>
      {newDays.length === 0 && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', margin: '4px 0 0' }}>
          Pick at least one day above before adding - that's why "Add" is grayed out.
        </p>
      )}
      {addError && <p style={{ color: 'var(--color-danger)', margin: '8px 0 0' }}>{addError}</p>}
    </div>
  );
}
