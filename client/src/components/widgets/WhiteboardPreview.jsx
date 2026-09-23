import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';

export default function WhiteboardPreview({ onExpand }) {
  const { data } = usePolling(() => api.whiteboard(), [], 15000);

  return (
    <section className="widget-card compact">
      <div className="widget-header">
        <h2>Whiteboard</h2>
        {onExpand && <button className="see-all" onClick={onExpand}>Open &rarr;</button>}
      </div>
      {data?.image_path ? (
        <img
          className="whiteboard-preview-img"
          src={data.image_path}
          alt="Whiteboard preview"
          onClick={onExpand}
          style={{ cursor: onExpand ? 'pointer' : undefined }}
        />
      ) : (
        <p style={{ color: 'var(--color-text-muted)' }}>Nothing drawn yet - tap Open to start.</p>
      )}
    </section>
  );
}
