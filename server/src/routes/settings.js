import { Router } from 'express';
import { getMemberNames, setMemberNames, getWeatherZip, setWeatherZip } from '../lib/appConfig.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({ members: getMemberNames(), weather_zip: getWeatherZip() });
});

router.put('/', (req, res) => {
  const { member_1, member_2, member_3, weather_zip } = req.body;

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

  res.json({ members: getMemberNames(), weather_zip: getWeatherZip() });
});

export default router;
