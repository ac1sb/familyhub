import { useEffect, useRef, useState } from 'react';

const SWIPE_THRESHOLD_PX = 50;
const PAGE_SIZE = 4;

// Squares mode's 2x2 grid, for widgets whose item count isn't capped at 4
// (Settings -> Dashboard Widgets no longer trims Squares mode down to a
// fixed glance limit the way List/Carousel still do) - past 4 items, this
// pages through them 4 at a time instead of cramming more tiles into the
// grid or growing the widget. Swipe (touch drag) or use the arrow buttons;
// dots below mark pages, not individual items.
export default function TileGridPager({ items, renderTile }) {
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const [page, setPage] = useState(0);
  const [dragX, setDragX] = useState(0);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const lastXRef = useRef(0);

  // Keep the page in range as the underlying item count changes (one rolls
  // off, one's added) instead of pointing past the end of a now-shorter list.
  useEffect(() => {
    if (page > pageCount - 1) setPage(Math.max(0, pageCount - 1));
  }, [pageCount, page]);

  function clampPage(p) {
    return Math.max(0, Math.min(pageCount - 1, p));
  }

  function handlePointerDown(e) {
    if (pageCount <= 1) return;
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
    if (delta <= -SWIPE_THRESHOLD_PX) setPage((p) => clampPage(p + 1));
    else if (delta >= SWIPE_THRESHOLD_PX) setPage((p) => clampPage(p - 1));
  }

  const start = clampPage(page) * PAGE_SIZE;
  const pageItems = items.slice(start, start + PAGE_SIZE);

  return (
    <div className="tile-pager">
      <div className="tile-pager-track">
        {pageCount > 1 && (
          <button
            type="button"
            className="btn-icon tile-carousel-arrow"
            onClick={() => setPage((p) => clampPage(p - 1))}
            disabled={page === 0}
            aria-label="Previous items"
          >
            &larr;
          </button>
        )}

        <div
          className="tile-grid"
          style={{ transform: `translateX(${dragX}px)` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {pageItems.map(renderTile)}
        </div>

        {pageCount > 1 && (
          <button
            type="button"
            className="btn-icon tile-carousel-arrow"
            onClick={() => setPage((p) => clampPage(p + 1))}
            disabled={page === pageCount - 1}
            aria-label="Next items"
          >
            &rarr;
          </button>
        )}
      </div>

      {pageCount > 1 && (
        <div className="tile-carousel-dots">
          {Array.from({ length: pageCount }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`tile-carousel-dot${i === page ? ' active' : ''}`}
              onClick={() => setPage(i)}
              aria-label={`Show items ${i * PAGE_SIZE + 1}-${Math.min((i + 1) * PAGE_SIZE, items.length)} of ${items.length}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
