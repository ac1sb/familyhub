import { getSetting, setSetting } from './settings.js';

// Household member names and the weather zip code are editable from the
// Settings page at runtime; the DB-stored value (if any) always wins over
// the .env default, so a restart never reverts what someone typed in there.
export function getMemberNames() {
  return {
    member_1: getSetting('member_1_name') || process.env.MEMBER_1_NAME || 'Mom',
    member_2: getSetting('member_2_name') || process.env.MEMBER_2_NAME || 'Dad',
    member_3: getSetting('member_3_name') || process.env.MEMBER_3_NAME || 'Child',
  };
}

export function setMemberNames({ member_1, member_2, member_3 }) {
  if (member_1 !== undefined) setSetting('member_1_name', member_1);
  if (member_2 !== undefined) setSetting('member_2_name', member_2);
  if (member_3 !== undefined) setSetting('member_3_name', member_3);
}

export function getWeatherZip() {
  return getSetting('weather_zip') || process.env.WEATHER_ZIP || '05255';
}

export function setWeatherZip(zip) {
  setSetting('weather_zip', zip);
}
