import { useEffect, useRef, useState } from 'react';
import GridLayout, { WidthProvider } from 'react-grid-layout/legacy';
import { collides } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import CalendarAgenda from './widgets/CalendarAgenda.jsx';
import ChoreList from './widgets/ChoreList.jsx';
import DailyChecklist from './widgets/DailyChecklist.jsx';
import MealPlanner from './widgets/MealPlanner.jsx';
import ShoppingList from './widgets/ShoppingList.jsx';
import WhiteboardPreview from './widgets/WhiteboardPreview.jsx';
import SmartHomeWidget from './widgets/SmartHomeWidget.jsx';
import MusicWidget from './widgets/MusicWidget.jsx';
import TodayWeatherCard from './widgets/TodayWeatherCard.jsx';
import AvatarWidget from './widgets/AvatarWidget.jsx';
import ReminderBanner from './ReminderBanner.jsx';
import {
  WIDGET_CATALOG,
  getDashboardLayout,
  setDashboardLayout,
  getEnabledWidgets,
  getWidgetColors,
  getDashboardLocked,
} from '../lib/dashboardLayout.js';
import { getWidgetDisplayMode } from '../lib/widgetDisplayMode.js';
import { getDashboardBackgroundSettings, setDashboardBackgroundSettings } from '../lib/dashboardBackgroundSettings.js';
import { fetchThemedPhoto } from '../lib/photoLibrary.js';
import { getDashboardTheme } from '../lib/dashboardTheme.js';

const AutoWidthGridLayout = WidthProvider(GridLayout);

const ROW_HEIGHT = 26;
const ROW_MARGIN = 8;
const PAGE_COUNT = 2;
// A completed swipe needs to travel at least this far, and be more
// horizontal than vertical, to switch pages - anything short of that (a tap,
// or a mostly-vertical scroll) leaves the current page alone.
const SWIPE_THRESHOLD_PX = 60;
// The gesture never reaches for the page-swipe at all if it started inside
// one of these - a widget's own horizontal swipe (the Carousel display mode,
// the calendar's horizontal day scroller) or any normal interactive control.
const SWIPE_EXCLUDE_SELECTOR = 'button, input, select, textarea, a, .tile-carousel, .agenda-days-scroll';
// The "next few days" agenda and the shopping list are both meant to scroll
// internally - each can span an unbounded number of upcoming events/days or
// still-needed items, so neither should dictate the dashboard's height the
// way a short list widget should; how much shows before scrolling is just
// whatever height the widget is manually resized to.
const NO_AUTO_GROW = new Set(['calendar', 'shopping']);
// A Carousel or Squares tile (see TileCarousel.jsx / .tile-grid in
// styles.css) is built to stretch and fill however much height its widget
// is given, down to a small floor - unlike a stacked list, it never
// genuinely "needs" more room. Auto-growing it anyway chases a few px of
// harmless rounding overflow forever, since the tile just re-stretches to
// fill the taller box on the next render: the widget grows without bound.
// Skip auto-grow for whichever of these widgets is currently in one of
// those self-filling display modes.
const SELF_FILLING_MODES = new Set(['carousel', 'squares']);
const SELF_FILLING_CAPABLE_WIDGETS = new Set(['chores', 'daily']);

function widgetPage(item) {
  return item.page ?? 0;
}

// With auto-compaction off (see compactType={null} below - it's what lets
// widgets keep whatever gaps you leave instead of always snapping together),
// growing a widget's height in the auto-grow effect below would otherwise
// just overlap whatever sits beneath it, since nothing else pushes those
// widgets out of the way automatically anymore. Cascades a minimal
// push-down to only the widgets actually in the way, leaving every other
// gap on the board untouched - not a full re-pack of the layout. Only ever
// called with items already filtered to a single page, since two widgets on
// different (never simultaneously visible) pages can share the same
// coordinates without actually overlapping.
function pushDownOverlaps(layout, grownIds) {
  const byId = new Map(layout.map((item) => [item.i, { ...item }]));
  const queue = [...grownIds];
  const queued = new Set(queue);
  while (queue.length > 0) {
    const id = queue.shift();
    queued.delete(id);
    const item = byId.get(id);
    for (const other of byId.values()) {
      if (other.i === item.i || other.static) continue;
      if (!collides(item, other)) continue;
      const shift = item.y + item.h - other.y;
      if (shift <= 0) continue;
      other.y += shift;
      if (!queued.has(other.i)) {
        queue.push(other.i);
        queued.add(other.i);
      }
    }
  }
  return layout.map((item) => byId.get(item.i));
}

export default function Dashboard({ members, zip, onNavigate }) {
  const [layout, setLayout] = useState(getDashboardLayout());
  const [enabledWidgets] = useState(() => getEnabledWidgets());
  const [widgetColors] = useState(() => getWidgetColors());
  const [locked] = useState(() => getDashboardLocked());
  const [background] = useState(() => getDashboardBackgroundSettings());
  const [backgroundPhoto, setBackgroundPhoto] = useState(background.photo);
  const [theme] = useState(() => getDashboardTheme());
  const [activePage, setActivePage] = useState(0);
  const wrapRef = useRef(null);
  const swipeRef = useRef({ tracking: false, startX: 0, startY: 0 });

  // Off: nothing to do. Static: reuse whatever's cached for the current
  // theme (Settings clears it when the theme changes or "New photo" is
  // tapped), only fetching if there's nothing yet. Rotating: fetch right
  // away and again on the configured interval, same pattern as the
  // screensaver's own photo rotation.
  useEffect(() => {
    if (background.mode === 'off') return undefined;

    if (background.mode === 'static') {
      if (background.photo) return undefined;
      let cancelled = false;
      fetchThemedPhoto(background.theme).then((photo) => {
        if (cancelled) return;
        setBackgroundPhoto(photo);
        setDashboardBackgroundSettings({ ...background, photo });
      });
      return () => {
        cancelled = true;
      };
    }

    let cancelled = false;
    function loadPhoto() {
      fetchThemedPhoto(background.theme).then((photo) => {
        if (!cancelled) setBackgroundPhoto(photo);
      });
    }
    loadPhoto();
    const id = setInterval(loadPhoto, Math.max(1, background.intervalMinutes) * 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // react-grid-layout only ever knows about the currently-visible items (it's
  // handed one page's slice, not the full set), so its own onLayoutChange
  // callback would silently drop the saved position of every widget on the
  // other page (and any currently turned off in Settings) if applied
  // directly - merge its changes back into the full layout instead of
  // replacing it outright. Shared by both pages' grids.
  function handleLayoutChange(next) {
    setLayout((prev) => {
      const nextById = new Map(next.map((item) => [item.i, item]));
      // react-grid-layout's own callback echoes back its own plain layout
      // objects - just the fields it manages (i/x/y/w/h/moved/static, etc) -
      // not custom ones like `page`. Applying those wholesale (as this used
      // to) silently wiped `page` back to undefined on every layout change,
      // including the one RGL fires right after mount. Only pull the
      // position/size fields it actually owns; keep everything else as-is.
      const merged = prev.map((item) => {
        const updated = nextById.get(item.i);
        if (!updated) return item;
        return { ...item, x: updated.x, y: updated.y, w: updated.w, h: updated.h };
      });
      setDashboardLayout(merged);
      return merged;
    });
  }

  // A widget's saved height can fall behind its actual content - more
  // shopping items, a longer synced lunch entree, a style change that made
  // rows taller - leaving it stuck with an internal scrollbar until someone
  // thinks to drag it bigger. Periodically check each widget's real content
  // height against its allocated box and grow (never shrink) the box to
  // fit, saving the result like a manual resize would. Run once per page,
  // since two widgets on different pages can share the same x/y without
  // ever actually colliding.
  useEffect(() => {
    if (locked) return undefined;
    const id = setInterval(() => {
      const container = wrapRef.current;
      if (!container) return;
      setLayout((prevLayout) => {
        let next = prevLayout;
        let anyGrown = false;
        for (let page = 0; page < PAGE_COUNT; page += 1) {
          const grownIds = [];
          const pageItems = next
            .filter((item) => widgetPage(item) === page)
            .map((item) => {
              if (NO_AUTO_GROW.has(item.i)) return item;
              if (SELF_FILLING_CAPABLE_WIDGETS.has(item.i) && SELF_FILLING_MODES.has(getWidgetDisplayMode(item.i))) return item;
              const card = container.querySelector(`[data-grid-id="${item.i}"] .widget-card`);
              if (!card) return item;
              const deficit = card.scrollHeight - card.clientHeight;
              if (deficit <= 4) return item;
              const extraRows = Math.ceil(deficit / (ROW_HEIGHT + ROW_MARGIN));
              grownIds.push(item.i);
              return { ...item, h: item.h + extraRows };
            });
          if (grownIds.length === 0) continue;
          anyGrown = true;
          const pushed = pushDownOverlaps(pageItems, grownIds);
          const pushedById = new Map(pushed.map((item) => [item.i, item]));
          next = next.map((item) => pushedById.get(item.i) || item);
        }
        if (!anyGrown) return prevLayout;
        setDashboardLayout(next);
        return next;
      });
    }, 4000);
    return () => clearInterval(id);
  }, [locked]);

  function goToPage(page) {
    setActivePage(Math.max(0, Math.min(PAGE_COUNT - 1, page)));
  }

  function handlePagerPointerDown(e) {
    if (e.target.closest(SWIPE_EXCLUDE_SELECTOR)) {
      swipeRef.current.tracking = false;
      return;
    }
    swipeRef.current = { tracking: true, startX: e.clientX, startY: e.clientY };
  }

  function handlePagerPointerUp(e) {
    if (!swipeRef.current.tracking) return;
    swipeRef.current.tracking = false;
    const dx = e.clientX - swipeRef.current.startX;
    const dy = e.clientY - swipeRef.current.startY;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) <= Math.abs(dy)) return;
    goToPage(dx < 0 ? activePage + 1 : activePage - 1);
  }

  const widgetContent = {
    calendar: <CalendarAgenda members={members} compact fillHeight onExpand={() => onNavigate('calendar')} />,
    weather: <TodayWeatherCard zip={zip} />,
    chores: <ChoreList compact onExpand={() => onNavigate('chores')} />,
    daily: <DailyChecklist compact onExpand={() => onNavigate('daily')} />,
    meals: (
      <MealPlanner
        compact
        childName={members.member_3}
        onExpand={() => onNavigate('meals')}
        onExpandLunch={() => onNavigate('lunch')}
      />
    ),
    shopping: <ShoppingList compact onExpand={() => onNavigate('shopping')} />,
    whiteboard: <WhiteboardPreview onExpand={() => onNavigate('whiteboard')} />,
    smarthome: <SmartHomeWidget compact onExpand={() => onNavigate('smarthome')} />,
    music: <MusicWidget compact onExpand={() => onNavigate('music')} />,
    avatar_member_1: <AvatarWidget member="member_1" name={members.member_1} />,
    avatar_member_2: <AvatarWidget member="member_2" name={members.member_2} />,
    avatar_member_3: <AvatarWidget member="member_3" name={members.member_3} />,
  };

  return (
    <div
      className={`dashboard-wrap${backgroundPhoto ? ' has-background-photo' : ''}`}
      ref={wrapRef}
      data-dashboard-theme={theme}
      style={
        backgroundPhoto
          ? {
              backgroundImage: `url(${backgroundPhoto.url})`,
              '--frost-opacity': `${background.frostOpacity}%`,
              // Blur scales down with the frost slider too - at 0% that
              // means an actually crisp, unblurred photo (not just an
              // untinted one), so the low end of the slider reads as
              // "clear" rather than merely "less tinted."
              '--frost-blur': `${(background.frostOpacity / 100) * 12}px`,
            }
          : undefined
      }
    >
      <ReminderBanner members={members} />

      <div
        className="dashboard-pager"
        style={{ transform: `translateX(-${activePage * (100 / PAGE_COUNT)}%)` }}
        onPointerDown={handlePagerPointerDown}
        onPointerUp={handlePagerPointerUp}
        onPointerCancel={() => {
          swipeRef.current.tracking = false;
        }}
      >
        {Array.from({ length: PAGE_COUNT }, (_, page) => {
          const pageLayout = layout.filter((item) => enabledWidgets.has(item.i) && widgetPage(item) === page);
          const pageWidgetIds = new Set(pageLayout.map((item) => item.i));
          const pageWidgets = WIDGET_CATALOG.filter((w) => pageWidgetIds.has(w.id));
          return (
            <div className="dashboard-page" key={page}>
              <AutoWidthGridLayout
                className="dashboard-rgl"
                layout={pageLayout}
                cols={12}
                rowHeight={ROW_HEIGHT}
                margin={[ROW_MARGIN, ROW_MARGIN]}
                containerPadding={[0, 0]}
                draggableHandle=".widget-header"
                draggableCancel="button, input, select, textarea, a"
                resizeHandles={['se']}
                compactType={null}
                isDraggable={!locked}
                isResizable={!locked}
                onLayoutChange={handleLayoutChange}
              >
                {pageWidgets.map((w) => (
                  <div
                    key={w.id}
                    data-grid-id={w.id}
                    style={widgetColors[w.id] ? { '--widget-bg': widgetColors[w.id] } : undefined}
                  >
                    {widgetContent[w.id]}
                  </div>
                ))}
              </AutoWidthGridLayout>
            </div>
          );
        })}
      </div>

      {PAGE_COUNT > 1 && (
        <div className="dashboard-page-dots">
          {Array.from({ length: PAGE_COUNT }, (_, page) => (
            <button
              key={page}
              type="button"
              className={`dashboard-page-dot${page === activePage ? ' active' : ''}`}
              onClick={() => goToPage(page)}
              aria-label={`Show dashboard page ${page + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
