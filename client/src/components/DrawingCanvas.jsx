import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';

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

// A raw finger touch reports far fewer, noisier points than a stylus, which
// is exactly what makes straight point-to-point line segments look jagged
// and robotic instead of like handwriting. Two things fix most of that
// without needing a stylus at all:
//   - draw a quadratic curve through each point instead of a straight line
//     to it, using the midpoints between points as the curve's start/end -
//     a standard "smooth freehand" canvas technique that rounds off the
//     faceted corners raw touch input produces.
//   - vary the line width by how fast the finger is moving, tapering
//     thinner on quick strokes and a touch thicker where it slows down or
//     pauses, the way a felt-tip pen naturally behaves under finger
//     pressure - a uniform-width line is what reads as "computer drawn."
// Below a certain speed a stroke is basically motionless jitter from finger
// contact area, not an intentional new point, so those get filtered out too
// - otherwise the "smoothing" has tiny zig-zags to smooth in the first place.
const MIN_POINT_DISTANCE_PX = 1.2;
const MIN_WIDTH_FACTOR = 0.6;
const MAX_WIDTH_FACTOR = 1.4;
const SPEED_REFERENCE_PX_PER_MS = 0.8;
// Blends each new instantaneous speed reading into a running average rather
// than reacting to it directly - raw per-event speed is noisy enough that
// using it straight makes the taper flicker instead of flow.
const SPEED_SMOOTHING = 0.25;

function clamp(value, lo, hi) {
  return Math.max(lo, Math.min(hi, value));
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function widthForSpeed(baseSize, speedPxPerMs) {
  const t = clamp(speedPxPerMs / SPEED_REFERENCE_PX_PER_MS, 0, 1);
  const factor = MAX_WIDTH_FACTOR - t * (MAX_WIDTH_FACTOR - MIN_WIDTH_FACTOR);
  return baseSize * factor;
}

function paintDot(ctx, point, size, w, h) {
  ctx.beginPath();
  ctx.arc(point.x * w, point.y * h, Math.max(1, size) / 2, 0, Math.PI * 2);
  ctx.fill();
}

// Draws just the curve segment ending at points[i] - the midpoint-quadratic
// technique needs the point before and after it for context. Used both for
// a single incremental segment while actively drawing and, applied to every
// point in turn, for redrawing a whole stroke from its stored points (undo,
// resize, loading a saved board) - the same function either way keeps the
// live line and the redrawn one looking identical.
function paintSegmentEndingAt(ctx, points, i, w, h) {
  const p1 = points[i - 1];
  const p2 = points[i];
  ctx.lineWidth = p2.width;
  ctx.beginPath();
  if (i === 1) {
    // Only two points so far - nothing to curve through yet.
    ctx.moveTo(p1.x * w, p1.y * h);
    ctx.lineTo(p2.x * w, p2.y * h);
  } else {
    const p0 = points[i - 2];
    const midA = midpoint(p0, p1);
    const midB = midpoint(p1, p2);
    ctx.moveTo(midA.x * w, midA.y * h);
    ctx.quadraticCurveTo(p1.x * w, p1.y * h, midB.x * w, midB.y * h);
  }
  ctx.stroke();
}

const DrawingCanvas = forwardRef(function DrawingCanvas({
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
}, ref) {
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
    const pts = stroke.points;
    if (pts.length === 0) return;
    ctx.globalCompositeOperation = stroke.erase ? 'destination-out' : 'source-over';
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (pts.length === 1) {
      // A tap with no drag - a dot (period, the dot over an "i", ...)
      // instead of nothing, which is what a lone moveTo with no lineTo
      // renders as.
      paintDot(ctx, pts[0], pts[0].width, w, h);
      return;
    }
    for (let i = 1; i < pts.length; i++) paintSegmentEndingAt(ctx, pts, i, w, h);
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
    const pos = getFractionalPos(e);
    currentStrokeRef.current = {
      points: [{ ...pos, t: performance.now(), width: size }],
      color,
      size,
      erase: erasing,
      lastSpeed: 0,
    };
  }

  function handlePointerMove(e) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const stroke = currentStrokeRef.current;
    const pts = stroke.points;
    const prev = pts[pts.length - 1];
    const pos = getFractionalPos(e);

    const rect = canvas.getBoundingClientRect();
    const distPx = Math.hypot((pos.x - prev.x) * rect.width, (pos.y - prev.y) * rect.height);
    if (distPx < MIN_POINT_DISTANCE_PX) return; // finger jitter, not an intentional new point

    const now = performance.now();
    const rawSpeed = distPx / Math.max(1, now - prev.t);
    stroke.lastSpeed += (rawSpeed - stroke.lastSpeed) * SPEED_SMOOTHING;
    const width = stroke.erase ? stroke.size : widthForSpeed(stroke.size, stroke.lastSpeed);
    pts.push({ x: pos.x, y: pos.y, t: now, width });

    const ctx = canvas.getContext('2d');
    ctx.globalCompositeOperation = stroke.erase ? 'destination-out' : 'source-over';
    ctx.strokeStyle = stroke.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    paintSegmentEndingAt(ctx, pts, pts.length - 1, canvas.width, canvas.height);
  }

  function handlePointerUp() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const stroke = currentStrokeRef.current;
    if (stroke.points.length === 1) {
      // A tap with no movement never got a pointermove to paint it live -
      // draw the dot now instead of leaving nothing on the board.
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.globalCompositeOperation = stroke.erase ? 'destination-out' : 'source-over';
      ctx.fillStyle = stroke.color;
      paintDot(ctx, stroke.points[0], stroke.points[0].width, canvas.width, canvas.height);
    }
    strokesRef.current.push(stroke);
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

  // Lets a parent (e.g. a "+ New" button in a widget header, away from this
  // component's own toolbar) trigger the exact same archive-then-clear flow
  // as the trash icon below, instead of duplicating that logic.
  useImperativeHandle(ref, () => ({ clear: handleClear }));

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
});

export default DrawingCanvas;
