import { Router } from 'express';
import {
  getMemberNames,
  setMemberNames,
  getWeatherZip,
  setWeatherZip,
  getThemeSettings,
  setThemeSettings,
  getIcalFeeds,
  setIcalFeeds,
  getGoogleCalendarId,
  setGoogleCalendarId,
  getGoogleEventsMember,
  setGoogleEventsMember,
} from '../lib/appConfig.js';

const router = Router();
const VALID_MEMBERS = ['family', 'member_1', 'member_2', 'member_3'];

function fullSettings() {
  return {
    members: getMemberNames(),
    weather_zip: getWeatherZip(),
    theme: getThemeSettings(),
    ical_feeds: getIcalFeeds(),
    google_calendar_id: getGoogleCalendarId(),
    google_events_member: getGoogleEventsMember(),
  };
}

router.get('/', (req, res) => {
  res.json(fullSettings());
});

router.put('/', (req, res) => {
  const {
    member_1, member_2, member_3, weather_zip, theme_mode, dark_start, dark_end,
    ical_feeds, google_calendar_id, google_events_member,
  } = req.body;

  const trimmedOrUndefined = (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

  setMemberNames({
    member_1: trimmedOrUndefined(member_1),
    member_2: trimmedOrUndefined(member_2),
    member_3: trimmedOrUndefined(member_3),
  });

  const zip = trimmedOrUndefined(weather_zip);
  if (zip) {
    if (!/^\d{5}$/.test(zip)) {
      return res.status(400).json({ error: 'weather_zip must be a 5-digit US zip code' });
    }
    setWeatherZip(zip);
  }

  if (theme_mode !== undefined && !['auto', 'light', 'dark'].includes(theme_mode)) {
    return res.status(400).json({ error: "theme_mode must be 'auto', 'light', or 'dark'" });
  }
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (dark_start !== undefined && !timePattern.test(dark_start)) {
    return res.status(400).json({ error: 'dark_start must be HH:MM' });
  }
  if (dark_end !== undefined && !timePattern.test(dark_end)) {
    return res.status(400).json({ error: 'dark_end must be HH:MM' });
  }
  setThemeSettings({ theme_mode, dark_start, dark_end });

  if (google_calendar_id !== undefined) setGoogleCalendarId(google_calendar_id.trim() || 'primary');

  if (google_events_member !== undefined) {
    if (!VALID_MEMBERS.includes(google_events_member)) {
      return res.status(400).json({ error: 'google_events_member must be family, member_1, member_2, or member_3' });
    }
    setGoogleEventsMember(google_events_member);
  }

  if (ical_feeds !== undefined) {
    if (!Array.isArray(ical_feeds)) {
      return res.status(400).json({ error: 'ical_feeds must be an array' });
    }
    for (const feed of ical_feeds) {
      if (feed.member !== undefined && !VALID_MEMBERS.includes(feed.member)) {
        return res.status(400).json({ error: 'each ical_feeds member must be family, member_1, member_2, or member_3' });
      }
    }
    setIcalFeeds(ical_feeds);
  }

  res.json(fullSettings());
});

export default router;
