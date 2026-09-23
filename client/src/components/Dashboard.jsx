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
import { DEFAULT_LAYOUT, getDashboardLayout, setDashboardLayout } from '../lib/dashboardLayout.js';

const AutoWidthGridLayout = WidthProvider(GridLayout);

const ROW_HEIGHT = 26;
const ROW_MARGIN = 8;
// The "next few days" agenda is meant to scroll internally - it can span an
// unbounded number of upcoming events/days, so it should never dictate the
// dashboard's height the way a short list widget should.
const NO_AUTO_GROW = new Set(['calendar']);

export default function Dashboard({ members, zip, onNavigate }) {
  const [layout, setLayout] = useState(getDashboardLayout());
  const wrapRef = useRef(null);

  function handleLayoutChange(next) {
    setLayout(next);
    setDashboardLayout(next);
  }

  function resetLayout() {
    setLayout(DEFAULT_LAYOUT);
    setDashboardLayout(DEFAULT_LAYOUT);
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

  return (
    <div className="dashboard-wrap" ref={wrapRef}>
      <ReminderBanner members={members} />

      <div className="dashboard-toolbar">
        <button className="see-all" onClick={resetLayout}>&#8635; Reset layout</button>
      </div>

      <AutoWidthGridLayout
        className="dashboard-rgl"
        layout={layout}
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
        <div key="calendar" data-grid-id="calendar">
          <CalendarAgenda members={members} compact fillHeight onExpand={() => onNavigate('calendar')} />
        </div>
        <div key="weather" data-grid-id="weather">
          <TodayWeatherCard zip={zip} />
        </div>
        <div key="lunch" data-grid-id="lunch">
          <LunchTodayCard childName={members.member_3} onExpand={() => onNavigate('lunch')} />
        </div>
        <div key="chores" data-grid-id="chores">
          <ChoreList members={members} compact onExpand={() => onNavigate('chores')} />
        </div>
        <div key="daily" data-grid-id="daily">
          <DailyChecklist members={members} compact onExpand={() => onNavigate('daily')} />
        </div>
        <div key="meals" data-grid-id="meals">
          <MealPlanner compact onExpand={() => onNavigate('meals')} />
        </div>
        <div key="shopping" data-grid-id="shopping">
          <ShoppingList compact onExpand={() => onNavigate('shopping')} />
        </div>
        <div key="whiteboard" data-grid-id="whiteboard">
          <WhiteboardPreview onExpand={() => onNavigate('whiteboard')} />
        </div>
        <div key="smarthome" data-grid-id="smarthome">
          <SmartHomeWidget compact onExpand={() => onNavigate('smarthome')} />
        </div>
      </AutoWidthGridLayout>
    </div>
  );
}
