import CalendarAgenda from './widgets/CalendarAgenda.jsx';
import ChoreList from './widgets/ChoreList.jsx';
import MealPlanner from './widgets/MealPlanner.jsx';
import ShoppingList from './widgets/ShoppingList.jsx';

export default function Dashboard({ members, onNavigate }) {
  return (
    <div className="dashboard-grid">
      <div className="dash-calendar">
        <CalendarAgenda members={members} compact onExpand={() => onNavigate('calendar')} />
      </div>
      <ChoreList members={members} compact onExpand={() => onNavigate('chores')} />
      <MealPlanner compact onExpand={() => onNavigate('meals')} />
      <ShoppingList compact onExpand={() => onNavigate('shopping')} />
    </div>
  );
}
