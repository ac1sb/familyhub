import { useEffect, useState } from 'react';
import { fetchScreensaverPhoto } from '../lib/screensaverPhotos.js';
import { api } from '../api.js';

export default function Screensaver({ settings, zip, onDismiss }) {
  const [photo, setPhoto] = useState(null);
  const [weather, setWeather] = useState(null);
  const [now, setNow] = useState(new Date());
  const [whiteboard, setWhiteboard] = useState(null);

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
      <div className="screensaver-tap-hint">Tap anywhere to continue</div>
    </div>
  );
}
