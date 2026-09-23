import { useState } from 'react';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';
import DrawingCanvas from '../DrawingCanvas.jsx';
import Modal from '../Modal.jsx';

export default function ShoppingList({ compact = false, onExpand }) {
  const { data, setData, refresh } = usePolling(() => api.shopping(), [], 10000);
  const [newItem, setNewItem] = useState('');
  const [showPad, setShowPad] = useState(false);

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

  async function handleInkSave(dataUrl) {
    setShowPad(false);
    await api.addInkShoppingItem(dataUrl);
    refresh();
  }

  async function handleTypeIt(item) {
    const typed = window.prompt('What does this say?', item.name || '');
    if (typed === null) return;
    await api.updateShoppingItem(item.id, { name: typed.trim() });
    refresh();
  }

  return (
    <section className={`widget-card${compact ? ' compact' : ''}`}>
      <div className="widget-header">
        <h2>Shopping List</h2>
        {compact && onExpand && <button className="see-all" onClick={onExpand}>See all &rarr;</button>}
      </div>
      {(data?.items || []).map((item) => (
        <div className="shopping-row" key={item.id}>
          <input type="checkbox" checked={item.checked} onChange={() => toggleChecked(item)} />
          {item.image_path ? (
            <span className="shopping-ink-item" style={{ flex: 1 }}>
              <img className="shopping-ink-img" src={item.image_path} alt="Handwritten item" />
              {item.name ? (
                <span className={`name${item.checked ? ' checked' : ''}`}>{item.name}</span>
              ) : (
                <button className="btn-link" onClick={() => handleTypeIt(item)}>⌨️ Type it</button>
              )}
            </span>
          ) : (
            <span className={`name${item.checked ? ' checked' : ''}`} style={{ flex: 1 }}>{item.name}</span>
          )}
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
        <button className="btn btn-secondary" onClick={() => setShowPad(true)}>✏️ Write</button>
      </div>

      {showPad && (
        <Modal onClose={() => setShowPad(false)}>
          <h3 className="modal-title">Write an item</h3>
          <DrawingCanvas
            width={640}
            height={220}
            colors={['#1a1a1a']}
            sizes={[4, 10, 20]}
            saveLabel="Add to List"
            onSave={handleInkSave}
            onCancel={() => setShowPad(false)}
          />
        </Modal>
      )}
    </section>
  );
}
