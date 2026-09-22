import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Dashboard from './components/Dashboard.jsx';
import CalendarAgenda from './components/widgets/CalendarAgenda.jsx';
import ChoreList from './components/widgets/ChoreList.jsx';
import MealPlanner from './components/widgets/MealPlanner.jsx';
import LunchTracker from './components/widgets/LunchTracker.jsx';
import WeatherWidget from './components/widgets/WeatherWidget.jsx';
import ShoppingList from './components/widgets/ShoppingList.jsx';
import SettingsPanel from './components/widgets/SettingsPanel.jsx';
import { api } from './api.js';

const DEFAULT_MEMBERS = { member_1: 'Mom', member_2: 'Dad', member_3: 'Child' };

export default function App() {
  const [active, setActive] = useState('dashboard');
  const [config, setConfig] = useState(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    api.config().then(setConfig).catch(() => setConfig({ members: DEFAULT_MEMBERS, weather_zip: '05255' }));
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const members = config?.members || DEFAULT_MEMBERS;
  const zip = config?.weather_zip || '05255';

  return (
    <div className="app-shell">
      <Sidebar active={active} onSelect={setActive} />
      <div className="main-area">
        <header className="topbar">
          <div className="datetime">
            {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} &middot;{' '}
            {now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
          </div>
          <WeatherWidget zip={zip} compact />
        </header>
        <main className="main-content">
          {active === 'dashboard' && <Dashboard members={members} onNavigate={setActive} />}
          {active === 'calendar' && <CalendarAgenda members={members} />}
          {active === 'chores' && <ChoreList members={members} />}
          {active === 'meals' && <MealPlanner />}
          {active === 'lunch' && <LunchTracker childName={members.member_3} />}
          {active === 'weather' && <WeatherWidget zip={zip} />}
          {active === 'shopping' && <ShoppingList />}
          {active === 'settings' && <SettingsPanel config={config} />}
        </main>
      </div>
    </div>
  );
}
