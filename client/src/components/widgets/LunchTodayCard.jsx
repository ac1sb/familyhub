import { useState } from 'react';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';
import { addDays, toISODate } from '../../lib/week.js';
import { stripDailyChoices } from '../../lib/lunchText.js';
import { getWidgetDisplayMode } from '../../lib/widgetDisplayMode.js';
import TileCarousel from '../TileCarousel.jsx';

// Squares/Carousel modes reuse the same "tile has a .done look" convention
// as Chores/Daily Checklist - there's no real done/not-done here, so School
// (lunch is covered) is treated as the "affirmative" state to highlight,
// same green tint, and the icon carries the actual status at a glance.
function statusIcon(item) {
  if (item?.noSchool) return '🚫';
  return item?.status === 'school' ? '🏫' : '🥪';
}

export default function LunchTodayCard({ childName, onExpand }) {
  const [displayMode] = useState(() => getWidgetDisplayMode('lunch'));
  const now = new Date();
  const todayKey = toISODate(now);
  const rangeEnd = toISODate(addDays(now, 2));
  const { data, setData, refresh } = usePolling(() => api.lunchRange(todayKey, rangeEnd), [todayKey, rangeEnd], 30000);

  const byDate = {};
  for (const d of data?.days || []) byDate[d.date] = d;

  // Today + tomorrow only - a quick "what's for lunch" glance, not a weekly view.
  const shownDates = [todayKey, toISODate(addDays(now, 1))];

  async function updateDay(date, patch) {
    setData((prev) => ({
      days: (prev?.days || []).map((d) => (d.date === date ? { ...d, ...patch } : d)),
    }));
    await api.setLunchDay(date, patch);
    refresh();
  }

  function toggleStatus(date, currentStatus) {
    updateDay(date, { status: currentStatus === 'school' ? 'home' : 'school' });
  }

  // Shared shape for Squares/Carousel, which (unlike the bespoke list rows
  // below) both work off a generic "items with a .done flag" model.
  const items = shownDates.map((date, i) => {
    const day = byDate[date];
    const noSchool = !!day?.no_school;
    return {
      date,
      label: i === 0 ? 'Today' : 'Tomorrow',
      status: day?.status || 'home',
      noSchool,
      menuItem: noSchool ? 'No School' : stripDailyChoices(day?.menu_item) || 'No menu yet',
      done: !noSchool && day?.status === 'school',
    };
  });

  function toggleItem(item) {
    if (item.noSchool) return;
    toggleStatus(item.date, item.status);
  }

  return (
    <section className="widget-card lunch-today">
      <div className="widget-header">
        <h2>Lunch &mdash; {childName}</h2>
        {onExpand && <button className="see-all" onClick={onExpand}>Full month &rarr;</button>}
      </div>

      {displayMode === 'carousel' && (
        <TileCarousel
          items={items}
          onToggle={toggleItem}
          renderTile={(item) => (
            <>
              <span className="tile-icon">{statusIcon(item)}</span>
              <span className="tile-title">{item.label}: {item.menuItem}</span>
              {item.done && <span className="tile-check">✓</span>}
            </>
          )}
        />
      )}

      {displayMode === 'squares' && (
        <div className="tile-grid">
          {items.map((item) => (
            <button
              type="button"
              className={`tile-square${item.done ? ' done' : ''}`}
              key={item.date}
              aria-pressed={item.done}
              title={`${item.label}: ${item.menuItem}`}
              disabled={item.noSchool}
              onClick={() => toggleItem(item)}
            >
              <span className="tile-icon">{statusIcon(item)}</span>
              <span className="tile-title">{item.label}</span>
              {item.done && <span className="tile-check">✓</span>}
            </button>
          ))}
        </div>
      )}

      {displayMode === 'list' && (
        <div className="lunch-today-list">
          {shownDates.map((date, i) => {
            const day = byDate[date];
            const noSchool = !!day?.no_school;
            const statusClass = noSchool ? 'no-school' : `status-${day?.status || 'home'}`;
            const label = i === 0 ? 'Today' : 'Tomorrow';

            return (
              <button
                key={date}
                type="button"
                className={`lunch-today-row ${statusClass}${date === todayKey ? ' is-today' : ''}`}
                onClick={() => !noSchool && toggleStatus(date, day?.status || 'home')}
                disabled={noSchool}
              >
                <span className="ltr-day">{label}</span>
                <span className="ltr-meal">{noSchool ? 'No School' : stripDailyChoices(day?.menu_item) || 'No menu yet'}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
