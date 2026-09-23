import { useState } from 'react';
import { usePolling } from '../hooks/usePolling.js';
import { api } from '../api.js';
import DrawingCanvas from './DrawingCanvas.jsx';
import { useMemberColorPalette } from '../lib/memberColors.js';
import { archiveAndClearWhiteboard } from '../lib/whiteboardClear.js';

export default function WhiteboardPage({ onNavigate }) {
  const { data, refresh } = usePolling(() => api.whiteboard(), [], 8000);
  const { data: notesData, refresh: refreshNotes } = usePolling(() => api.whiteboardNotes(), [], 30000);
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

  async function handleClear(dataUrl) {
    await archiveAndClearWhiteboard(dataUrl);
    refresh();
    refreshNotes();
  }

  async function removeNote(id) {
    await api.deleteWhiteboardNote(id);
    refreshNotes();
  }

  const notes = notesData?.notes || [];

  return (
    <section className="widget-card fill-height">
      <div className="widget-header">
        <h2>Whiteboard</h2>
      </div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: 0 }}>
        Draw a message or doodle - it saves to every screen and phone. "Save to Board" writes what's
        on the pad now and takes you back to the dashboard; anyone else's saved drawing will load in
        the next time this page opens. Clearing the board (🗑️) keeps a copy below instead of just
        throwing it away.
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
        onClear={handleClear}
      />

      {notes.length > 0 && (
        <div className="whiteboard-notes">
          <h3 className="whiteboard-notes-title">Past notes</h3>
          <div className="whiteboard-notes-grid">
            {notes.map((note) => (
              <div className="whiteboard-note" key={note.id}>
                <img src={note.image_path} alt="Saved whiteboard note" />
                <div className="whiteboard-note-meta">
                  <span>{new Date(note.created_at.replace(' ', 'T') + 'Z').toLocaleString(undefined, {
                    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                  })}</span>
                  <button className="btn-icon" onClick={() => removeNote(note.id)} title="Delete this note">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
