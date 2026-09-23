import { useEffect, useState } from 'react';
import { usePolling } from '../hooks/usePolling.js';
import { api } from '../api.js';
import DrawingCanvas from './DrawingCanvas.jsx';

const BASE_COLORS = ['#1a1a1a', '#c0392b', '#2d6cdf', '#2e8b57', '#e08e2b'];
const MEMBER_VARS = ['--color-member-1', '--color-member-2', '--color-member-3'];

export default function WhiteboardPage() {
  const { data, refresh } = usePolling(() => api.whiteboard(), [], 8000);
  const [saving, setSaving] = useState(false);
  const [palette, setPalette] = useState(BASE_COLORS);

  useEffect(() => {
    const styles = getComputedStyle(document.documentElement);
    const memberHexes = MEMBER_VARS.map((v) => styles.getPropertyValue(v).trim()).filter(Boolean);
    setPalette([...BASE_COLORS, ...memberHexes]);
  }, []);

  async function handleSave(dataUrl) {
    setSaving(true);
    try {
      await api.saveWhiteboard(dataUrl);
      refresh();
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
        on the pad now; anyone else's saved drawing will load in the next time this page opens.
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
