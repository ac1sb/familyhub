import { useState } from 'react';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';

export default function ShoppingList() {
  const { data, setData, refresh } = usePolling(() => api.shopping(), [], 10000);
  const [newItem, setNewItem] = useState('');

  async function toggleChecked(item) {
    setData((prev) => ({
      items: prev.items.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i)),
    }));
    await api.updateShoppingItem(item.id, { checked: !item.checked });
    refresh();
  }

  async function addItem() {
    if (!newItem.trim()) return;
    await api.addShoppingItem(newItem.trim());
    setNewItem('');
    refresh();
  }

  async function removeItem(id) {
    await api.deleteShoppingItem(id);
    refresh();
  }

  return (
    <section className="widget-card">
      <div className="widget-header">
        <h2>Shopping List</h2>
      </div>
      {(data?.items || []).map((item) => (
        <div className="shopping-row" key={item.id}>
          <input type="checkbox" checked={item.checked} onChange={() => toggleChecked(item)} />
          <span className={`name${item.checked ? ' checked' : ''}`} style={{ flex: 1 }}>{item.name}</span>
          <button className="btn-icon" onClick={() => removeItem(item.id)}>✕</button>
        </div>
      ))}
      {data && data.items.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>List is empty.</p>}
      <div className="add-row">
        <input
          type="text"
          placeholder="Add an item…"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
        />
        <button className="btn btn-primary" onClick={addItem}>Add</button>
      </div>
    </section>
  );
}
