import { useEffect, useState } from 'react';
import { fetchScreensaverPhoto } from '../lib/screensaverPhotos.js';
import { api } from '../api.js';
import { formatTime, todayISO } from '../lib/week.js';

const BRIEFING_START_HOUR = 5;
const BRIEFING_ITEM_LIMIT = 5;

export default function Screensaver({ settings, zip, onDismiss }) {
  const [photo, setPhoto] = useState(null);
  const [weather, setWeather] = useState(null);
  const [now, setNow] = useState(new Date());
  const [whiteboard, setWhiteboard] = useState(null);
  const [todayEvents, setTodayEvents] = useState([]);

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
      const next = await fetchScreensaverPhoto(settings.theme);
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
        <div className="screensaver-postit">
          <div className="screensaver-postit-label">📝 Whiteboard</div>
          <img src={whiteboard.image_path} alt="Whiteboard note" />
        </div>
      )}
      {settings.showDailyBriefing && now.getHours() >= BRIEFING_START_HOUR && todayEvents.length > 0 && (
        <div className="screensaver-briefing">
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
