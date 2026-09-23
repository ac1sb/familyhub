import { useState } from 'react';
import { usePolling } from '../hooks/usePolling.js';
import { api } from '../api.js';
import DrawingCanvas from './DrawingCanvas.jsx';
import { useMemberColorPalette } from '../lib/memberColors.js';

export default function WhiteboardPage({ onNavigate }) {
  const { data, refresh } = usePolling(() => api.whiteboard(), [], 8000);
  const [saving, setSaving] = useState(false);
  const palette = useMemberColorPalette();

  async function handleSave(dataUrl) {
    setSaving(true);
    try {
      await api.saveWhiteboard(dataUrl);
      refresh();
      // Drawing a message and heading back to the dashboard is the common
      // case - saving from here closes this page and returns there instead
      // of leaving the board open waiting for a separate "done" action.
      onNavigate?.('dashboard');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="widget-card fill-height">
      <div className="widget-header">
        <h2>Whiteboard</h2>
      </div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: 0 }}>
        Draw a message or doodle - it saves to every screen and phone. "Save to Board" writes what's
        on the pad now and takes you back to the dashboard; anyone else's saved drawing will load in
        the next time this page opens.
      </p>
      <DrawingCanvas
        key={data?.image_path || 'blank'}
        width={1000}
        height={600}
        colors={palette}
        sizes={[4, 10, 20]}
        initialSrc={data?.image_path || null}
        saveLabel={saving ? 'Saving…' : 'Save to Board'}
        onSave={handleSave}
      />
    </section>
  );
}
