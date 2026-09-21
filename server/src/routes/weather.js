import { Router } from 'express';
import fetch from 'node-fetch';

const router = Router();

const WEATHER_CODES = {
  0: { label: 'Clear sky', icon: 'sun' },
  1: { label: 'Mostly clear', icon: 'sun' },
  2: { label: 'Partly cloudy', icon: 'cloud-sun' },
  3: { label: 'Overcast', icon: 'cloud' },
  45: { label: 'Fog', icon: 'fog' },
  48: { label: 'Fog', icon: 'fog' },
  51: { label: 'Light drizzle', icon: 'drizzle' },
  53: { label: 'Drizzle', icon: 'drizzle' },
  55: { label: 'Heavy drizzle', icon: 'drizzle' },
  61: { label: 'Light rain', icon: 'rain' },
  63: { label: 'Rain', icon: 'rain' },
  65: { label: 'Heavy rain', icon: 'rain' },
  66: { label: 'Freezing rain', icon: 'rain' },
  67: { label: 'Freezing rain', icon: 'rain' },
  71: { label: 'Light snow', icon: 'snow' },
  73: { label: 'Snow', icon: 'snow' },
  75: { label: 'Heavy snow', icon: 'snow' },
  77: { label: 'Snow grains', icon: 'snow' },
  80: { label: 'Rain showers', icon: 'rain' },
  81: { label: 'Rain showers', icon: 'rain' },
  82: { label: 'Violent showers', icon: 'rain' },
  85: { label: 'Snow showers', icon: 'snow' },
  86: { label: 'Snow showers', icon: 'snow' },
  95: { label: 'Thunderstorm', icon: 'storm' },
  96: { label: 'Thunderstorm w/ hail', icon: 'storm' },
  99: { label: 'Thunderstorm w/ hail', icon: 'storm' },
};

let cache = { key: null, expires: 0, data: null };

async function geocodeZip(zip, country) {
  const resp = await fetch(`https://api.zippopotam.us/${country}/${zip}`);
  if (!resp.ok) throw new Error(`Could not geocode zip ${zip}`);
  const data = await resp.json();
  const place = data.places?.[0];
  if (!place) throw new Error('No location found for zip');
  return {
    lat: Number(place.latitude),
    lon: Number(place.longitude),
    label: `${place['place name']}, ${place['state abbreviation'] || data['country abbreviation']}`,
  };
}

router.get('/', async (req, res) => {
  const zip = req.query.zip || process.env.WEATHER_ZIP || '05255';
  const country = (req.query.country || process.env.WEATHER_COUNTRY || 'us').toLowerCase();
  const cacheKey = `${zip}-${country}`;

  if (cache.key === cacheKey && cache.expires > Date.now()) {
    return res.json(cache.data);
  }

  try {
    const { lat, lon, label } = await geocodeZip(zip, country);
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', lat);
    url.searchParams.set('longitude', lon);
    url.searchParams.set('daily', 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max');
    url.searchParams.set('current_weather', 'true');
    url.searchParams.set('temperature_unit', 'fahrenheit');
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('forecast_days', '7');

    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Forecast request failed');
    const raw = await resp.json();

    const daily = raw.daily.time.map((date, i) => ({
      date,
      code: raw.daily.weathercode[i],
      condition: WEATHER_CODES[raw.daily.weathercode[i]]?.label || 'Unknown',
      icon: WEATHER_CODES[raw.daily.weathercode[i]]?.icon || 'cloud',
      high: Math.round(raw.daily.temperature_2m_max[i]),
      low: Math.round(raw.daily.temperature_2m_min[i]),
      precipitation_chance: raw.daily.precipitation_probability_max?.[i] ?? null,
    }));

    const data = {
      location: label,
      zip,
      current: {
        temperature: Math.round(raw.current_weather.temperature),
        code: raw.current_weather.weathercode,
        condition: WEATHER_CODES[raw.current_weather.weathercode]?.label || 'Unknown',
        icon: WEATHER_CODES[raw.current_weather.weathercode]?.icon || 'cloud',
      },
      daily,
      updated_at: new Date().toISOString(),
    };

    cache = { key: cacheKey, expires: Date.now() + 30 * 60 * 1000, data };
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
