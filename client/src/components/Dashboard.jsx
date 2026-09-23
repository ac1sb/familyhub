import { useState } from 'react';
import GridLayout, { WidthProvider } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import CalendarAgenda from './widgets/CalendarAgenda.jsx';
import ChoreList from './widgets/ChoreList.jsx';
import DailyChecklist from './widgets/DailyChecklist.jsx';
import MealPlanner from './widgets/MealPlanner.jsx';
import ShoppingList from './widgets/ShoppingList.jsx';
import WhiteboardPreview from './widgets/WhiteboardPreview.jsx';
import TodayWeatherCard from './widgets/TodayWeatherCard.jsx';
import LunchTodayCard from './widgets/LunchTodayCard.jsx';
import ReminderBanner from './ReminderBanner.jsx';
import { DEFAULT_LAYOUT, getDashboardLayout, setDashboardLayout } from '../lib/dashboardLayout.js';

const AutoWidthGridLayout = WidthProvider(GridLayout);

export default function Dashboard({ members, zip, onNavigate }) {
  const [layout, setLayout] = useState(getDashboardLayout());

  function handleLayoutChange(next) {
    setLayout(next);
    setDashboardLayout(next);
  }

  function resetLayout() {
    setLayout(DEFAULT_LAYOUT);
    setDashboardLayout(DEFAULT_LAYOUT);
  }

  return (
    <div className="dashboard-wrap">
      <ReminderBanner members={members} />

      <div className="dashboard-toolbar">
        <button className="see-all" onClick={resetLayout}>&#8635; Reset layout</button>
      </div>

      <AutoWidthGridLayout
        className="dashboard-rgl"
        layout={layout}
        cols={12}
        rowHeight={26}
        margin={[8, 8]}
        containerPadding={[0, 0]}
        draggableHandle=".widget-header"
        draggableCancel="button, input, select, textarea, a"
        resizeHandles={['se']}
        compactType="vertical"
        onLayoutChange={handleLayoutChange}
      >
        <div key="calendar">
          <CalendarAgenda members={members} compact fillHeight onExpand={() => onNavigate('calendar')} />
        </div>
        <div key="weather">
          <TodayWeatherCard zip={zip} />
        </div>
        <div key="lunch">
          <LunchTodayCard childName={members.member_3} onExpand={() => onNavigate('lunch')} />
        </div>
        <div key="chores">
          <ChoreList members={members} compact onExpand={() => onNavigate('chores')} />
        </div>
        <div key="daily">
          <DailyChecklist members={members} compact onExpand={() => onNavigate('daily')} />
        </div>
        <div key="meals">
          <MealPlanner compact onExpand={() => onNavigate('meals')} />
        </div>
        <div key="shopping">
          <ShoppingList compact onExpand={() => onNavigate('shopping')} />
        </div>
        <div key="whiteboard">
          <WhiteboardPreview onExpand={() => onNavigate('whiteboard')} />
        </div>
      </AutoWidthGridLayout>
    </div>
  );
}
