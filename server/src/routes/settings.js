import { Router } from 'express';
import {
  getMemberNames,
  setMemberNames,
  getWeatherZip,
  setWeatherZip,
  getThemeSettings,
  setThemeSettings,
} from '../lib/appConfig.js';

const router = Router();

function fullSettings() {
  return { members: getMemberNames(), weather_zip: getWeatherZip(), theme: getThemeSettings() };
}

router.get('/', (req, res) => {
  res.json(fullSettings());
});

router.put('/', (req, res) => {
  const { member_1, member_2, member_3, weather_zip, theme_mode, dark_start, dark_end } = req.body;

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

  res.json(fullSettings());
});

export default router;
