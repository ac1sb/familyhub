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
import MusicWidget from './components/widgets/MusicWidget.jsx';
import HeaderSmartHomeToggles from './components/HeaderSmartHomeToggles.jsx';
import HeaderWeather from './components/HeaderWeather.jsx';
import SettingsPanel from './components/widgets/SettingsPanel.jsx';
import Screensaver from './components/Screensaver.jsx';
import { api } from './api.js';
import { isNightNow } from './lib/theme.js';
import { getScreensaverSettings, setScreensaverSettings } from './lib/screensaverSettings.js';
import { getUiStyle, setUiStyle } from './lib/uiStyleSettings.js';
import { useIdleTimer } from './hooks/useIdleTimer.js';
import { useMinuteClock } from './hooks/useMinuteClock.js';

const DEFAULT_MEMBERS = { member_1: 'Mom', member_2: 'Dad', member_3: 'Child' };

// Its own component so the per-minute tick only re-renders the clock text,
// not the whole app (every dashboard widget) along with it.
function HeaderClock() {
  const now = useMinuteClock();
  return (
    <div className="topbar-datetime">
      {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} &middot;{' '}
      {now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
    </div>
  );
}

export default function App() {
  const [active, setActive] = useState('dashboard');
  const [config, setConfig] = useState(null);
  const [screensaver, setScreensaver] = useState(getScreensaverSettings());
  const [uiStyle, setUiStyleState] = useState(getUiStyle());
  const [menuOpen, setMenuOpen] = useState(false);

  // Picking a destination is also "close the menu" - it's a brief overlay
  // meant to disappear the moment it's done its job, not stay open until
  // separately dismissed.
  function navigate(id) {
    setActive(id);
    setMenuOpen(false);
  }

  function updateScreensaverSettings(next) {
    setScreensaver(next);
    setScreensaverSettings(next);
  }

  function updateUiStyle(next) {
    setUiStyleState(setUiStyle(next));
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
    function applyTheme() {
      const dark = isNightNow(config?.theme, new Date());
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    }
    applyTheme();
    const id = setInterval(applyTheme, 60000);
    return () => clearInterval(id);
  }, [config?.theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-ui-style', uiStyle);
  }, [uiStyle]);

  const members = config?.members || DEFAULT_MEMBERS;
  const zip = config?.weather_zip || '05255';

  return (
    <div className="app-shell">
      <Sidebar active={active} onSelect={navigate} open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="main-area">
        <div className="topbar-strip">
          <button
            className={`menu-toggle-btn${menuOpen ? ' open' : ''}`}
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
          <HeaderSmartHomeToggles />
          <HeaderClock />
          <HeaderWeather zip={zip} />
        </div>
        <main
          className={`main-content${active === 'dashboard' ? ' dashboard-mode' : ''}${
            active === 'calendar' ? ' calendar-mode' : ''
          }${active === 'lunch' ? ' lunch-mode' : ''}`}
        >
          {active === 'dashboard' && <Dashboard members={members} zip={zip} onNavigate={navigate} />}
          {active === 'calendar' && <CalendarAgenda members={members} />}
          {active === 'chores' && <ChoreList />}
          {active === 'daily' && <DailyChecklist />}
          {active === 'meals' && <MealPlanner />}
          {active === 'lunch' && <LunchCalendar childName={members.member_3} />}
          {active === 'weather' && <WeatherWidget zip={zip} />}
          {active === 'shopping' && <ShoppingList />}
          {active === 'whiteboard' && <WhiteboardPage onNavigate={navigate} />}
          {active === 'smarthome' && <SmartHomeWidget />}
          {active === 'music' && <MusicWidget />}
          {active === 'settings' && (
            <SettingsPanel
              config={config}
              onConfigUpdated={setConfig}
              screensaverSettings={screensaver}
              onScreensaverSettingsChange={updateScreensaverSettings}
              uiStyle={uiStyle}
              onUiStyleChange={updateUiStyle}
            />
          )}
        </main>
      </div>
      {showScreensaver && <Screensaver settings={screensaver} zip={zip} onDismiss={() => {}} />}
    </div>
  );
}
