import { useState } from 'react';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';
import DrawingCanvas from '../DrawingCanvas.jsx';
import { useMemberColorPalette } from '../../lib/memberColors.js';

export default function WhiteboardPreview({ onExpand }) {
  const { data, refresh } = usePolling(() => api.whiteboard(), [], 15000);
  const [saving, setSaving] = useState(false);
  const palette = useMemberColorPalette();

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
    <section className="widget-card compact">
      <div className="widget-header">
        <h2>Whiteboard</h2>
        {onExpand && <button className="see-all" onClick={onExpand}>Full size &rarr;</button>}
      </div>
      <DrawingCanvas
        key={data?.image_path || 'blank'}
        width={640}
        height={340}
        colors={palette}
        sizes={[4, 10, 20]}
        initialSrc={data?.image_path || null}
        saveLabel={saving ? 'Saving…' : 'Save'}
        onSave={handleSave}
      />
    </section>
  );
}
