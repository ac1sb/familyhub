import { useEffect, useRef, useState } from 'react';
import GridLayout, { WidthProvider } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import CalendarAgenda from './widgets/CalendarAgenda.jsx';
import ChoreList from './widgets/ChoreList.jsx';
import DailyChecklist from './widgets/DailyChecklist.jsx';
import MealPlanner from './widgets/MealPlanner.jsx';
import ShoppingList from './widgets/ShoppingList.jsx';
import WhiteboardPreview from './widgets/WhiteboardPreview.jsx';
import SmartHomeWidget from './widgets/SmartHomeWidget.jsx';
import TodayWeatherCard from './widgets/TodayWeatherCard.jsx';
import LunchTodayCard from './widgets/LunchTodayCard.jsx';
import ReminderBanner from './ReminderBanner.jsx';
import {
  WIDGET_CATALOG,
  getDashboardLayout,
  setDashboardLayout,
  getEnabledWidgets,
  getWidgetColors,
} from '../lib/dashboardLayout.js';
import { getWidgetDisplayMode } from '../lib/widgetDisplayMode.js';

const AutoWidthGridLayout = WidthProvider(GridLayout);

const ROW_HEIGHT = 26;
const ROW_MARGIN = 8;
// The "next few days" agenda is meant to scroll internally - it can span an
// unbounded number of upcoming events/days, so it should never dictate the
// dashboard's height the way a short list widget should.
const NO_AUTO_GROW = new Set(['calendar']);
// A Carousel-mode tile (see TileCarousel.jsx / styles.css) is built to
// stretch and fill however much height its widget is given, down to a
// ~110px floor - unlike a stacked list, it never genuinely "needs" more
// room. Auto-growing it anyway chases a few px of harmless rounding
// overflow forever, since the tile just re-stretches to fill the taller
// box on the next render: the widget grows without bound. Skip auto-grow
// for whichever of these widgets is currently in carousel mode.
const CAROUSEL_CAPABLE_WIDGETS = new Set(['chores', 'daily']);

export default function Dashboard({ members, zip, onNavigate }) {
  const [layout, setLayout] = useState(getDashboardLayout());
  const [enabledWidgets] = useState(() => getEnabledWidgets());
  const [widgetColors] = useState(() => getWidgetColors());
  const wrapRef = useRef(null);

  // react-grid-layout only ever knows about the currently-visible items (it's
  // handed `visibleLayout`, not the full set), so its own onLayoutChange
  // callback would silently drop the saved position of any widget that's
  // currently turned off in Settings if applied directly - merge its
  // changes back into the full layout instead of replacing it outright.
  function handleLayoutChange(next) {
    setLayout((prev) => {
      const nextById = new Map(next.map((item) => [item.i, item]));
      const merged = prev.map((item) => nextById.get(item.i) || item);
      setDashboardLayout(merged);
      return merged;
    });
  }

  // A widget's saved height can fall behind its actual content - more
  // shopping items, a longer synced lunch entree, a style change that made
  // rows taller - leaving it stuck with an internal scrollbar until someone
  // thinks to drag it bigger. Periodically check each widget's real content
  // height against its allocated box and grow (never shrink) the box to
  // fit, saving the result like a manual resize would.
  useEffect(() => {
    const id = setInterval(() => {
      const container = wrapRef.current;
      if (!container) return;
      setLayout((prevLayout) => {
        let changed = false;
        const next = prevLayout.map((item) => {
          if (NO_AUTO_GROW.has(item.i)) return item;
          if (CAROUSEL_CAPABLE_WIDGETS.has(item.i) && getWidgetDisplayMode(item.i) === 'carousel') return item;
          const card = container.querySelector(`[data-grid-id="${item.i}"] .widget-card`);
          if (!card) return item;
          const deficit = card.scrollHeight - card.clientHeight;
          if (deficit <= 4) return item;
          changed = true;
          const extraRows = Math.ceil(deficit / (ROW_HEIGHT + ROW_MARGIN));
          return { ...item, h: item.h + extraRows };
        });
        if (!changed) return prevLayout;
        setDashboardLayout(next);
        return next;
      });
    }, 4000);
    return () => clearInterval(id);
  }, []);

  const widgetContent = {
    calendar: <CalendarAgenda members={members} compact fillHeight onExpand={() => onNavigate('calendar')} />,
    weather: <TodayWeatherCard zip={zip} />,
    lunch: <LunchTodayCard childName={members.member_3} onExpand={() => onNavigate('lunch')} />,
    chores: <ChoreList members={members} compact onExpand={() => onNavigate('chores')} />,
    daily: <DailyChecklist members={members} compact onExpand={() => onNavigate('daily')} />,
    meals: <MealPlanner compact onExpand={() => onNavigate('meals')} />,
    shopping: <ShoppingList compact onExpand={() => onNavigate('shopping')} />,
    whiteboard: <WhiteboardPreview onExpand={() => onNavigate('whiteboard')} />,
    smarthome: <SmartHomeWidget compact onExpand={() => onNavigate('smarthome')} />,
  };

  const visibleLayout = layout.filter((item) => enabledWidgets.has(item.i));

  return (
    <div className="dashboard-wrap" ref={wrapRef}>
      <ReminderBanner members={members} />

      <AutoWidthGridLayout
        className="dashboard-rgl"
        layout={visibleLayout}
        cols={12}
        rowHeight={ROW_HEIGHT}
        margin={[ROW_MARGIN, ROW_MARGIN]}
        containerPadding={[0, 0]}
        draggableHandle=".widget-header"
        draggableCancel="button, input, select, textarea, a"
        resizeHandles={['se']}
        compactType="vertical"
        onLayoutChange={handleLayoutChange}
      >
        {WIDGET_CATALOG.filter((w) => enabledWidgets.has(w.id)).map((w) => (
          <div
            key={w.id}
            data-grid-id={w.id}
            className={widgetColors[w.id] ? 'has-custom-color' : undefined}
            style={widgetColors[w.id] ? { '--widget-bg': widgetColors[w.id] } : undefined}
          >
            {widgetContent[w.id]}
          </div>
        ))}
      </AutoWidthGridLayout>
    </div>
  );
}
