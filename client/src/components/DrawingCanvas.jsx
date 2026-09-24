import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// Shared touch/pen/mouse drawing pad, used by both the handwritten shopping
// list items and the whiteboard. Ink is flattened to a plain PNG on save -
// there's no vector/stroke persistence, so Undo only ever un-does strokes
// drawn in the current sitting (anything already saved is baked into the
// loaded base image, same as drawing on real paper over an old note).
//
// Strokes are stored as fractions (0..1) of the canvas's current width/height
// rather than raw pixels, so a resize - dragging a dashboard widget wider or
// taller, or just opening the same board on a different screen - can redraw
// everything at the new size instead of clipping or leaving dead space.
export default function DrawingCanvas({
  width = 600,
  height = 300,
  colors = ['#1a1a1a'],
  sizes = [4, 10, 20],
  background = '#ffffff',
  initialSrc = null,
  saveLabel = 'Save',
  onSave,
  onClear,
  onCancel,
}) {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const baseImageRef = useRef(null);
  const strokesRef = useRef([]);
  const currentStrokeRef = useRef(null);
  const drawingRef = useRef(false);
  const colorPickerRef = useRef(null);

  const [color, setColor] = useState(colors[0]);
  const [size, setSize] = useState(sizes[Math.floor(sizes.length / 2)]);
  const [erasing, setErasing] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  // Only the current color shows by default - with up to 8 choices (5 base
  // colors + one per family member), always showing every swatch ate up a
  // lot of the narrow side toolbar. Tapping the current swatch reveals the
  // rest; picking one collapses back down to just that swatch again.
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  useEffect(() => {
    if (!colorPickerOpen) return;
    function handleOutside(e) {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target)) setColorPickerOpen(false);
    }
    document.addEventListener('pointerdown', handleOutside, true);
    return () => document.removeEventListener('pointerdown', handleOutside, true);
  }, [colorPickerOpen]);

  function selectColor(c) {
    setColor(c);
    setErasing(false);
    setColorPickerOpen(false);
  }

  function paintStroke(ctx, stroke, w, h) {
    if (stroke.points.length === 0) return;
    ctx.globalCompositeOperation = stroke.erase ? 'destination-out' : 'source-over';
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x * w, stroke.points[0].y * h);
    for (const p of stroke.points.slice(1)) ctx.lineTo(p.x * w, p.y * h);
    ctx.stroke();
  }

  function redrawAll() {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0 || canvas.height === 0) return;
    const ctx = canvas.getContext('2d');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (baseImageRef.current) ctx.drawImage(baseImageRef.current, 0, 0, canvas.width, canvas.height);
    for (const stroke of strokesRef.current) paintStroke(ctx, stroke, canvas.width, canvas.height);
  }

  useEffect(() => {
    let cancelled = false;
    baseImageRef.current = null;
    strokesRef.current = [];
    setCanUndo(false);
    if (initialSrc) {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        baseImageRef.current = img;
        redrawAll();
      };
      img.src = initialSrc;
    } else {
      redrawAll();
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSrc]);

  // Keep the canvas's actual pixel buffer matched to however big the stage
  // box really is, instead of a fixed resolution tied only to the `width`/
  // `height` props - those now just seed the aspect ratio used as a fallback
  // when nothing else constrains the box (e.g. inside a plain modal).
  useLayoutEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;

    function resize() {
      const rect = stage.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width === w && canvas.height === h) return;
      canvas.width = w;
      canvas.height = h;
      redrawAll();
    }

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getFractionalPos(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }

  function handlePointerDown(e) {
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    currentStrokeRef.current = { points: [getFractionalPos(e)], color, size, erase: erasing };
  }

  function handlePointerMove(e) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const pos = getFractionalPos(e);
    const pts = currentStrokeRef.current.points;
    const prev = pts[pts.length - 1];
    pts.push(pos);
    const ctx = canvas.getContext('2d');
    paintStroke(ctx, { points: [prev, pos], color, size, erase: erasing }, canvas.width, canvas.height);
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
    const hasContent = strokesRef.current.length > 0 || !!baseImageRef.current;
    if (onClear && hasContent) {
      onClear(canvasRef.current.toDataURL('image/png'));
    }
    baseImageRef.current = null;
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
          <div className="drawing-colors" ref={colorPickerRef}>
            <button
              type="button"
              className="drawing-color-swatch selected"
              style={{ background: color }}
              onClick={() => setColorPickerOpen((v) => !v)}
              title="Choose a color"
            />
            {colorPickerOpen &&
              colors
                .filter((c) => c !== color)
                .map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="drawing-color-swatch"
                    style={{ background: c }}
                    onClick={() => selectColor(c)}
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
        <div className="drawing-tools">
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
      </div>

      <div className="drawing-canvas-main">
        <div className="drawing-canvas-stage" ref={stageRef} style={{ aspectRatio: `${width} / ${height}` }}>
          <canvas
            ref={canvasRef}
            className="drawing-canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
        </div>

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
    </div>
  );
}
