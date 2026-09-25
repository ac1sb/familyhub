import { useEffect, useState } from 'react';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';
import DrawingCanvas from '../DrawingCanvas.jsx';
import Modal from '../Modal.jsx';

function formatCheckedDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function ShoppingList({ compact = false, onExpand }) {
  const { data, setData, refresh } = usePolling(() => api.shopping(), [], 10000);
  const [newItem, setNewItem] = useState('');
  const [showPad, setShowPad] = useState(false);
  const [sheetConfigured, setSheetConfigured] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  useEffect(() => {
    if (compact) return;
    api.shoppingSheetSettings().then((r) => setSheetConfigured(!!r.sheetId)).catch(() => {});
  }, [compact]);

  async function handleSyncSheet() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await api.syncShoppingSheet();
      setSyncResult(result);
    } catch (err) {
      setSyncResult({ success: false, error: err.message });
    } finally {
      setSyncing(false);
    }
  }

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

  const items = data?.items || [];
  // Crossing an item off means it's purchased - it disappears from the
  // dashboard glance right away (no strikethrough lingering, unlike
  // Chores/Daily Checklist) since there's nothing left to shop for. The
  // still-needed items are what's worth a quick glance at.
  const stillNeeded = items.filter((i) => !i.checked);

  // Every still-needed item renders (no fixed cap) inside its own scrolling
  // region, same idea as the Calendar widget's agenda: how many are visible
  // without scrolling just depends on how tall the widget is resized to, and
  // the rest are one scroll away rather than invisible.
  if (compact) {
    return (
      <section className="widget-card compact">
        <div className="widget-header">
          <h2>Shopping List</h2>
          <div className="widget-header-actions">
            {data && (
              <span className="widget-status">
                {stillNeeded.length === 0 ? 'List is empty' : `${stillNeeded.length} item${stillNeeded.length === 1 ? '' : 's'}`}
              </span>
            )}
            {onExpand && <button className="see-all" onClick={onExpand}>See all &rarr;</button>}
          </div>
        </div>

        <div className="shopping-items-scroll">
          {stillNeeded.map((item) => (
            <div className="shopping-row" key={item.id} onClick={() => toggleChecked(item)}>
              {item.image_path ? (
                <span className="shopping-ink-item" style={{ flex: 1 }}>
                  <img className="shopping-ink-img" src={item.image_path} alt="Handwritten item" />
                  {item.name && <span className="name">{item.name}</span>}
                </span>
              ) : (
                <span className="name" style={{ flex: 1 }}>{item.name}</span>
              )}
            </div>
          ))}
        </div>

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

  return (
    <section className="widget-card">
      <div className="widget-header">
        <h2>Shopping List</h2>
      </div>

      {sheetConfigured ? (
        <div className="lunch-import-row" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleSyncSheet} disabled={syncing} style={{ flex: 'none' }}>
            {syncing ? 'Syncing…' : 'Sync with Sheet'}
          </button>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
            Also syncs automatically every few minutes - this is just for pulling in a change right away.
          </span>
        </div>
      ) : (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: 0 }}>
          No Google Sheet set up yet - add one in Settings &rarr; General to sync this list with your
          phone.
        </p>
      )}
      {syncResult && (
        <div className={`lunch-import-result${syncResult.success ? ' success' : ' error'}`}>
          {syncResult.success ? (
            <span>
              ✅ {syncResult.imported > 0 && `Added ${syncResult.imported} item${syncResult.imported === 1 ? '' : 's'} from the sheet. `}
              {syncResult.pushed > 0 && `Sent ${syncResult.pushed} item${syncResult.pushed === 1 ? '' : 's'} to the sheet. `}
              {syncResult.imported === 0 && syncResult.pushed === 0 && 'Already in sync - nothing new either way.'}
            </span>
          ) : (
            <span>⚠️ {syncResult.error}</span>
          )}
        </div>
      )}

      {items.map((item) => (
        <div className="shopping-row" key={item.id} onClick={() => toggleChecked(item)}>
          {item.image_path ? (
            <span className="shopping-ink-item" style={{ flex: 1 }}>
              <img className="shopping-ink-img" src={item.image_path} alt="Handwritten item" />
              {item.name ? (
                <span className={`name${item.checked ? ' checked' : ''}`}>{item.name}</span>
              ) : (
                <button className="btn-link" onClick={(e) => { e.stopPropagation(); handleTypeIt(item); }}>⌨️ Type it</button>
              )}
            </span>
          ) : (
            <span className={`name${item.checked ? ' checked' : ''}`} style={{ flex: 1 }}>{item.name}</span>
          )}
          {item.checked && item.checked_at && (
            <span className="shopping-checked-date">Got it {formatCheckedDate(item.checked_at)}</span>
          )}
          <button className="btn-icon" onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}>✕</button>
        </div>
      ))}
      {data && items.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>List is empty.</p>}
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
