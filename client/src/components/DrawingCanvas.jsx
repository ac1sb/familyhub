import { useEffect, useRef, useState } from 'react';

// Shared touch/pen/mouse drawing pad, used by both the handwritten shopping
// list items and the whiteboard. Ink is flattened to a plain PNG on save -
// there's no vector/stroke persistence, so Undo only ever un-does strokes
// drawn in the current sitting (anything already saved is baked into the
// loaded base image, same as drawing on real paper over an old note).
export default function DrawingCanvas({
  width = 600,
  height = 300,
  colors = ['#1a1a1a'],
  sizes = [4, 10, 20],
  background = '#ffffff',
  initialSrc = null,
  saveLabel = 'Save',
  onSave,
  onCancel,
}) {
  const canvasRef = useRef(null);
  const baseImageRef = useRef(null);
  const strokesRef = useRef([]);
  const currentStrokeRef = useRef(null);
  const drawingRef = useRef(false);

  const [color, setColor] = useState(colors[0]);
  const [size, setSize] = useState(sizes[Math.floor(sizes.length / 2)]);
  const [erasing, setErasing] = useState(false);
  const [canUndo, setCanUndo] = useState(false);

  function paintStroke(ctx, stroke) {
    if (stroke.points.length === 0) return;
    ctx.globalCompositeOperation = stroke.erase ? 'destination-out' : 'source-over';
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (const p of stroke.points.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function redrawAll() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (baseImageRef.current) ctx.drawImage(baseImageRef.current, 0, 0, canvas.width, canvas.height);
    for (const stroke of strokesRef.current) paintStroke(ctx, stroke);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = width;
    canvas.height = height;
    if (initialSrc) {
      const img = new Image();
      img.onload = () => {
        baseImageRef.current = img;
        redrawAll();
      };
      img.src = initialSrc;
    } else {
      redrawAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getPos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function handlePointerDown(e) {
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    currentStrokeRef.current = { points: [getPos(e)], color, size, erase: erasing };
  }

  function handlePointerMove(e) {
    if (!drawingRef.current) return;
    const pos = getPos(e);
    const pts = currentStrokeRef.current.points;
    const prev = pts[pts.length - 1];
    pts.push(pos);
    const ctx = canvasRef.current.getContext('2d');
    paintStroke(ctx, { points: [prev, pos], color, size, erase: erasing });
  }

  function handlePointerUp() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    strokesRef.current.push(currentStrokeRef.current);
    currentStrokeRef.current = null;
    setCanUndo(true);
  }

  function handleUndo() {
    strokesRef.current.pop();
    setCanUndo(strokesRef.current.length > 0);
    redrawAll();
  }

  function handleClear() {
    strokesRef.current = [];
    setCanUndo(false);
    redrawAll();
  }

  function handleSave() {
    onSave?.(canvasRef.current.toDataURL('image/png'));
  }

  return (
    <div className="drawing-canvas-wrap">
      <div className="drawing-toolbar">
        {colors.length > 1 && (
          <div className="drawing-colors">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                className={`drawing-color-swatch${!erasing && color === c ? ' selected' : ''}`}
                style={{ background: c }}
                onClick={() => {
                  setColor(c);
                  setErasing(false);
                }}
              />
            ))}
          </div>
        )}
        <div className="drawing-sizes">
          {sizes.map((s) => (
            <button
              key={s}
              type="button"
              className={`drawing-size-btn${size === s ? ' selected' : ''}`}
              onClick={() => setSize(s)}
            >
              <span className="drawing-size-dot" style={{ width: s, height: s }} />
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`btn-icon${erasing ? ' selected' : ''}`}
          onClick={() => setErasing((v) => !v)}
          title="Eraser"
        >
          🧽
        </button>
        <button type="button" className="btn-icon" onClick={handleUndo} disabled={!canUndo} title="Undo">
          ↩️
        </button>
        <button type="button" className="btn-icon" onClick={handleClear} title="Clear">
          🗑️
        </button>
      </div>

      <canvas
        ref={canvasRef}
        className="drawing-canvas"
        style={{ aspectRatio: `${width} / ${height}` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />

      <div className="modal-actions">
        {onCancel && (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={handleSave}>
          {saveLabel}
        </button>
      </div>
    </div>
  );
}
