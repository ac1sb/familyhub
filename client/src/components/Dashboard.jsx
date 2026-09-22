import CalendarAgenda from './widgets/CalendarAgenda.jsx';
import ChoreList from './widgets/ChoreList.jsx';
import MealPlanner from './widgets/MealPlanner.jsx';
import ShoppingList from './widgets/ShoppingList.jsx';
import TodayWeatherCard from './widgets/TodayWeatherCard.jsx';
import ReminderBanner from './ReminderBanner.jsx';

export default function Dashboard({ members, zip, onNavigate }) {
  return (
    <div className="dashboard-grid">
      <div className="dash-calendar">
        <ReminderBanner members={members} />
        <CalendarAgenda members={members} fillHeight />
      </div>
      <div className="dash-side">
        <TodayWeatherCard zip={zip} />
        <div className="dash-side-flex">
          <ChoreList members={members} compact onExpand={() => onNavigate('chores')} />
          <MealPlanner compact onExpand={() => onNavigate('meals')} />
          <ShoppingList compact onExpand={() => onNavigate('shopping')} />
        </div>
      </div>
    </div>
  );
}
