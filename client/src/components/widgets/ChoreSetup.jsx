import { useState } from 'react';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';

export default function ChoreSetup({ members }) {
  const { data, setData, refresh } = usePolling(() => api.choreTemplates(), [], 20000);
  const [newTitle, setNewTitle] = useState('');
  const [assignedTo, setAssignedTo] = useState('family');

  const allMembers = { ...(members || {}), family: 'Family' };

  async function addTemplate() {
    if (!newTitle.trim()) return;
    await api.createChoreTemplate({ title: newTitle.trim(), assigned_to: assignedTo });
    setNewTitle('');
    refresh();
  }

  async function toggleActive(template) {
    setData((prev) => ({
      templates: prev.templates.map((t) => (t.id === template.id ? { ...t, active: !t.active } : t)),
    }));
    await api.updateChoreTemplate(template.id, { active: !template.active });
    refresh();
  }

  async function removeTemplate(id) {
    await api.deleteChoreTemplate(id);
    refresh();
  }

  return (
    <div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: 0 }}>
        Chores added here automatically appear on everyone's weekly chore list, every week, already unchecked.
        Turn one off instead of deleting it if it's just paused for a while.
      </p>

      {(data?.templates || []).map((template) => (
        <div className="chore-row" key={template.id}>
          <input type="checkbox" checked={template.active} onChange={() => toggleActive(template)} title="Active" />
          <span className={`chore-title${template.active ? '' : ' done'}`}>{template.title}</span>
          <span className={`chore-tag ${template.assigned_to}`}>
            {allMembers[template.assigned_to] || template.assigned_to}
          </span>
          <button className="btn-icon" onClick={() => removeTemplate(template.id)}>✕</button>
        </div>
      ))}
      {data && data.templates.length === 0 && (
        <p style={{ color: 'var(--color-text-muted)' }}>No recurring chores set up yet.</p>
      )}

      <div className="add-row">
        <input
          type="text"
          placeholder="e.g. Take out the trash"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTemplate()}
        />
        <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
          {Object.entries(allMembers).map(([key, name]) => (
            <option key={key} value={key}>{name}</option>
          ))}
        </select>
        <button className="btn btn-primary" onClick={addTemplate}>Add</button>
      </div>
    </div>
  );
}
