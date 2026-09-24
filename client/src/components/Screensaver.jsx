import { useEffect, useState } from 'react';
import { fetchThemedPhoto } from '../lib/photoLibrary.js';
import { api } from '../api.js';
import { formatTime, todayISO } from '../lib/week.js';

const BRIEFING_START_HOUR = 5;
const BRIEFING_ITEM_LIMIT = 5;

// Both overlays periodically relocate to a different corner so nothing
// sits in the exact same pixels for hours on end (screen burn-in on a
// display that's on all day). They always sit two corners apart from each
// other, so they can never land on top of one another.
const CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
const MOVE_INTERVAL_MS = 4 * 60000;
const MOVE_FADE_MS = 600;

export default function Screensaver({ settings, zip, onDismiss }) {
  const [photo, setPhoto] = useState(null);
  const [weather, setWeather] = useState(null);
  const [now, setNow] = useState(new Date());
  const [whiteboard, setWhiteboard] = useState(null);
  const [todayEvents, setTodayEvents] = useState([]);
  const [cornerIndex, setCornerIndex] = useState(0);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setMoving(true);
      setTimeout(() => {
        setCornerIndex((i) => (i + 1) % CORNERS.length);
        setMoving(false);
      }, MOVE_FADE_MS);
    }, MOVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // Today's calendar, refreshed periodically so a screensaver left running
  // overnight still has the right day's events once it rolls past midnight
  // - only actually shown once it's past BRIEFING_START_HOUR, so it reads as
  // a "here's your day" briefing rather than showing up at 11pm.
  useEffect(() => {
    if (!settings.showDailyBriefing) return;
    let cancelled = false;
    function load() {
      api.eventsRange(todayISO(), 1).then((data) => {
        if (!cancelled) setTodayEvents(data.events || []);
      }).catch(() => {});
    }
    load();
    const id = setInterval(load, 5 * 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [settings.showDailyBriefing]);

  // A live reflection of the shared whiteboard, not a separate copy - draw
  // on the board from any device and it shows up here too, the same as
  // everywhere else it appears.
  useEffect(() => {
    if (!settings.showWhiteboard) return;
    let cancelled = false;
    function load() {
      api.whiteboard().then((data) => {
        if (!cancelled) setWhiteboard(data);
      }).catch(() => {});
    }
    load();
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [settings.showWhiteboard]);

  useEffect(() => {
    let cancelled = false;
    async function loadPhoto() {
      const next = await fetchThemedPhoto(settings.theme);
      if (!cancelled) setPhoto(next);
    }
    loadPhoto();
    const id = setInterval(loadPhoto, Math.max(5, settings.photoIntervalSeconds) * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [settings.theme, settings.photoIntervalSeconds]);

  useEffect(() => {
    api.weather(zip).then(setWeather).catch(() => setWeather(null));
  }, [zip]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="screensaver-overlay"
      style={photo ? { backgroundImage: `url(${photo.url})` } : undefined}
      onClick={onDismiss}
      onTouchStart={onDismiss}
    >
      <div className="screensaver-scrim" />
      <div className="screensaver-content">
        <div className="screensaver-time">
          {now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
        </div>
        <div className="screensaver-date">
          {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
        {weather?.current && (
          <div className="screensaver-weather">
            {weather.current.temperature}°F &middot; {weather.current.condition}
          </div>
        )}
      </div>
      {photo && (
        <div className="screensaver-credit">
          📷 {photo.credit}
          {photo.license ? ` · ${photo.license}` : ''}
        </div>
      )}
      {settings.showWhiteboard && whiteboard?.image_path && (
        <div
          className={`screensaver-postit corner-${CORNERS[cornerIndex]}`}
          style={{ opacity: moving ? 0 : 1 }}
        >
          <div className="screensaver-postit-label">📝 Whiteboard</div>
          <img src={whiteboard.image_path} alt="Whiteboard note" />
        </div>
      )}
      {settings.showDailyBriefing && now.getHours() >= BRIEFING_START_HOUR && todayEvents.length > 0 && (
        <div
          className={`screensaver-briefing corner-${CORNERS[(cornerIndex + 2) % CORNERS.length]}`}
          style={{ opacity: moving ? 0 : 1 }}
        >
          <div className="screensaver-briefing-label">📅 Today</div>
          {todayEvents.slice(0, BRIEFING_ITEM_LIMIT).map((ev) => (
            <div className="screensaver-briefing-row" key={`${ev.id}-${ev.occurrence_start}`}>
              <span className="screensaver-briefing-time">{ev.all_day ? 'All day' : formatTime(ev.occurrence_start)}</span>
              <span className="screensaver-briefing-title">{ev.title}</span>
            </div>
          ))}
          {todayEvents.length > BRIEFING_ITEM_LIMIT && (
            <div className="screensaver-briefing-more">+{todayEvents.length - BRIEFING_ITEM_LIMIT} more</div>
          )}
        </div>
      )}
      <div className="screensaver-tap-hint">Tap anywhere to continue</div>
    </div>
  );
}
