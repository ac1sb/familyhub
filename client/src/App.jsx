import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Dashboard from './components/Dashboard.jsx';
import CalendarAgenda from './components/widgets/CalendarAgenda.jsx';
import ChoreList from './components/widgets/ChoreList.jsx';
import DailyChecklist from './components/widgets/DailyChecklist.jsx';
import MealPlanner from './components/widgets/MealPlanner.jsx';
import LunchCalendar from './components/widgets/LunchCalendar.jsx';
import WeatherWidget from './components/widgets/WeatherWidget.jsx';
import ShoppingList from './components/widgets/ShoppingList.jsx';
import WhiteboardPage from './components/WhiteboardPage.jsx';
import SmartHomeWidget from './components/widgets/SmartHomeWidget.jsx';
import HeaderSmartHomeToggles from './components/HeaderSmartHomeToggles.jsx';
import HeaderWeather from './components/HeaderWeather.jsx';
import SettingsPanel from './components/widgets/SettingsPanel.jsx';
import Screensaver from './components/Screensaver.jsx';
import { api } from './api.js';
import { isNightNow } from './lib/theme.js';
import { getScreensaverSettings, setScreensaverSettings } from './lib/screensaverSettings.js';
import { useIdleTimer } from './hooks/useIdleTimer.js';

const DEFAULT_MEMBERS = { member_1: 'Mom', member_2: 'Dad', member_3: 'Child' };

export default function App() {
  const [active, setActive] = useState('dashboard');
  const [config, setConfig] = useState(null);
  const [now, setNow] = useState(new Date());
  const [screensaver, setScreensaver] = useState(getScreensaverSettings());

  function updateScreensaverSettings(next) {
    setScreensaver(next);
    setScreensaverSettings(next);
  }

  // Tapping the overlay is itself "activity", so useIdleTimer's own window
  // listener resets isIdle back to false as soon as the tap bubbles up -
  // no separate dismissed flag needed, and nothing underneath ever sees the tap
  // since the overlay is a fixed layer covering the full viewport.
  const isIdle = useIdleTimer(screensaver.idleMinutes * 60000, screensaver.enabled);
  const showScreensaver = screensaver.enabled && isIdle;

  useEffect(() => {
    api.config().then(setConfig).catch(() => setConfig({ members: DEFAULT_MEMBERS, weather_zip: '05255' }));
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const dark = isNightNow(config?.theme, now);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, [config?.theme, now]);

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
        </header>
        <div className="topbar-strip">
          <HeaderSmartHomeToggles />
          <HeaderWeather zip={zip} />
        </div>
        <main className={`main-content${active === 'dashboard' ? ' dashboard-mode' : ''}`}>
          {active === 'dashboard' && <Dashboard members={members} zip={zip} onNavigate={setActive} />}
          {active === 'calendar' && <CalendarAgenda members={members} />}
          {active === 'chores' && <ChoreList members={members} />}
          {active === 'daily' && <DailyChecklist members={members} />}
          {active === 'meals' && <MealPlanner />}
          {active === 'lunch' && <LunchCalendar childName={members.member_3} />}
          {active === 'weather' && <WeatherWidget zip={zip} />}
          {active === 'shopping' && <ShoppingList />}
          {active === 'whiteboard' && <WhiteboardPage onNavigate={setActive} />}
          {active === 'smarthome' && <SmartHomeWidget />}
          {active === 'settings' && (
            <SettingsPanel
              config={config}
              onConfigUpdated={setConfig}
              screensaverSettings={screensaver}
              onScreensaverSettingsChange={updateScreensaverSettings}
            />
          )}
        </main>
      </div>
      {showScreensaver && <Screensaver settings={screensaver} zip={zip} onDismiss={() => {}} />}
    </div>
  );
}
