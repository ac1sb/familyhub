import { useEffect, useRef, useState } from 'react';

const SWIPE_THRESHOLD_PX = 50;
const TAP_MAX_MOVEMENT_PX = 8;

// One big tile at a time instead of a stacked list - swipe left/right (or
// use the arrow buttons) to move through the items, tap the tile itself to
// toggle it done. An alternative to the default list view for Chores/Daily
// Checklist, picked in Settings -> Dashboard Widgets.
export default function TileCarousel({ items, renderTile, onToggle }) {
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const lastXRef = useRef(0);

  // Keep the index in range as the underlying item count changes (one
  // checked off and rolled out, one added, etc.) instead of pointing past
  // the end of a now-shorter list.
  useEffect(() => {
    if (index > items.length - 1) setIndex(Math.max(0, items.length - 1));
  }, [items.length, index]);

  function clampIndex(i) {
    return Math.max(0, Math.min(items.length - 1, i));
  }

  function handlePointerDown(e) {
    if (items.length <= 1) return;
    draggingRef.current = true;
    startXRef.current = e.clientX;
    lastXRef.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e) {
    if (!draggingRef.current) return;
    lastXRef.current = e.clientX;
    setDragX(e.clientX - startXRef.current);
  }

  function handlePointerUp() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const delta = lastXRef.current - startXRef.current;
    setDragX(0);
    if (Math.abs(delta) < TAP_MAX_MOVEMENT_PX) {
      onToggle(items[index]);
    } else if (delta <= -SWIPE_THRESHOLD_PX) {
      setIndex((i) => clampIndex(i + 1));
    } else if (delta >= SWIPE_THRESHOLD_PX) {
      setIndex((i) => clampIndex(i - 1));
    }
  }

  if (items.length === 0) return null;
  const item = items[clampIndex(index)];

  return (
    <div className="tile-carousel">
      <div className="tile-carousel-track">
        {items.length > 1 && (
          <button
            type="button"
            className="btn-icon tile-carousel-arrow"
            onClick={() => setIndex((i) => clampIndex(i - 1))}
            disabled={index === 0}
            aria-label="Previous item"
          >
            &larr;
          </button>
        )}

        <button
          type="button"
          className={`tile-carousel-tile${item.done ? ' done' : ''}`}
          style={{ transform: `translateX(${dragX}px)` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          aria-pressed={item.done}
        >
          {renderTile(item)}
        </button>

        {items.length > 1 && (
          <button
            type="button"
            className="btn-icon tile-carousel-arrow"
            onClick={() => setIndex((i) => clampIndex(i + 1))}
            disabled={index === items.length - 1}
            aria-label="Next item"
          >
            &rarr;
          </button>
        )}
      </div>

      {items.length > 1 && (
        <div className="tile-carousel-dots">
          {items.map((it, i) => (
            <button
              key={it.id}
              type="button"
              className={`tile-carousel-dot${i === index ? ' active' : ''}`}
              onClick={() => setIndex(i)}
              aria-label={`Show item ${i + 1} of ${items.length}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
