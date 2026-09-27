import crypto from 'node:crypto';

// Thin wrapper around LG's official ThinQ Connect API (thinq.developer.lge.com) -
// a real, documented REST API (unlike the reverse-engineered protocols most
// open-source LG integrations use), authenticated with a Personal Access
// Token generated on the LG ThinQ Developer Site rather than an account
// login. API_KEY below is the SDK-wide constant LG's own open-source Python
// SDK (thinq-connect/pythinqconnect) ships in its source - not a secret tied
// to any one user, same idea as a public app ID.
const API_KEY = 'v6GFvkweNo7DK7yD3ylIZ9w52aKBU0eJ7wLXkSR3';

// Which of LG's three regional gateways a country's devices are served from -
// mirrors thinqconnect's own country.py. Only washer/dryer status is used
// here, but the full list is kept so a wrong/unlisted country still resolves
// somewhere sensible (falls back to the Americas gateway) instead of failing
// outright.
const REGION_COUNTRIES = {
  kic: new Set(['AU', 'BD', 'CN', 'HK', 'ID', 'IN', 'JP', 'KH', 'KR', 'LA', 'LK', 'MM', 'MY', 'NP', 'NZ', 'PH', 'SG', 'TH', 'TW', 'VN']),
  aic: new Set(['AG', 'AR', 'AW', 'BB', 'BO', 'BR', 'BS', 'BZ', 'CA', 'CL', 'CO', 'CR', 'CU', 'DM', 'DO', 'EC', 'GD', 'GT', 'GY', 'HN', 'HT', 'JM', 'KN', 'LC', 'MX', 'NI', 'PA', 'PE', 'PR', 'PY', 'SR', 'SV', 'TT', 'US', 'UY', 'VC', 'VE']),
  eic: new Set(['AE', 'AF', 'AL', 'AM', 'AO', 'AT', 'AZ', 'BA', 'BE', 'BF', 'BG', 'BH', 'BJ', 'BY', 'CD', 'CF', 'CG', 'CH', 'CI', 'CM', 'CV', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DZ', 'EE', 'EG', 'ES', 'ET', 'FI', 'FR', 'GA', 'GB', 'GE', 'GH', 'GM', 'GN', 'GQ', 'GR', 'HR', 'HU', 'IE', 'IL', 'IQ', 'IR', 'IS', 'IT', 'JO', 'KE', 'KG', 'KW', 'KZ', 'LB', 'LR', 'LT', 'LU', 'LV', 'LY', 'MA', 'MD', 'ME', 'MK', 'ML', 'MR', 'MT', 'MU', 'MW', 'NE', 'NG', 'NL', 'NO', 'OM', 'PK', 'PL', 'PS', 'PT', 'QA', 'RO', 'RS', 'RU', 'RW', 'SA', 'SD', 'SE', 'SI', 'SK', 'SL', 'SN', 'SO', 'ST', 'SY', 'TD', 'TG', 'TN', 'TR', 'TZ', 'UA', 'UG', 'UZ', 'XK', 'YE', 'ZA', 'ZM']),
};

// The device types this integration cares about - washer/dryer status, not
// LG's whole appliance catalog (fridges, ACs, ovens, ...) ThinQ Connect also
// covers. Washcombo (stacked 2-in-1) units report status per-drum in a
// different shape and aren't handled here.
export const LAUNDRY_DEVICE_TYPES = new Set(['DEVICE_WASHER', 'DEVICE_DRYER', 'DEVICE_WASHTOWER_WASHER', 'DEVICE_WASHTOWER_DRYER']);

function regionForCountry(countryCode) {
  const code = (countryCode || 'US').toUpperCase();
  for (const [region, codes] of Object.entries(REGION_COUNTRIES)) {
    if (codes.has(code)) return region;
  }
  return 'aic';
}

// Matches thinqconnect's own _generate_message_id(): a random UUID's 16 raw
// bytes, base64url-encoded - Node's 'base64url' encoding already omits the
// padding Python's version trims off by hand.
function generateMessageId() {
  const hex = crypto.randomUUID().replace(/-/g, '');
  return Buffer.from(hex, 'hex').toString('base64url');
}

function headers({ pat, clientId, country }) {
  return {
    Authorization: `Bearer ${pat}`,
    'x-country': (country || 'US').toUpperCase(),
    'x-message-id': generateMessageId(),
    'x-client-id': clientId,
    'x-api-key': API_KEY,
    'x-service-phase': 'OP',
    'Content-Type': 'application/json',
  };
}

async function request(settings, method, endpoint) {
  const region = regionForCountry(settings.country);
  const res = await fetch(`https://api-${region}.lgthinq.com/${endpoint}`, {
    method,
    headers: headers(settings),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = body?.error;
    throw new Error(err ? `${err.message || 'LG ThinQ API error'} (${err.code})` : `LG ThinQ API error (${res.status})`);
  }
  return body?.response;
}

// Every device on the account, regardless of type - callers filter down to
// washers/dryers and exclude whatever's already linked to a local device.
export async function listThinqDevices(settings) {
  return (await request(settings, 'GET', 'devices')) || [];
}

// Raw device state - shape varies by device type; for washer/dryer this is
// roughly { runState: { currentState }, timer: { remainHour, remainMinute,
// totalHour, totalMinute, ... }, operation: {...}, ... }. See
// humanizeThinqStatus() for turning this into something displayable.
export async function getThinqDeviceStatus(settings, deviceId) {
  return request(settings, 'GET', `devices/${encodeURIComponent(deviceId)}/state`);
}

const STATE_LABELS = {
  RUNNING: 'Running',
  INITIAL: 'Ready',
  PAUSE: 'Paused',
  END: 'Done',
  ERROR: 'Error',
  POWEROFF: 'Off',
  DETECTING: 'Detecting load',
  RESERVED: 'Delay start set',
  COOLDOWN: 'Cooling down',
};

function humanizeState(raw) {
  if (!raw) return 'Unknown';
  if (STATE_LABELS[raw]) return STATE_LABELS[raw];
  return raw
    .toLowerCase()
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

// Turns a raw device state response into what the Smart Home widget actually
// shows: a short label, plus "Xh Ym left" only while it's actually running
// (a remaining time sitting on a finished/idle cycle isn't meaningful).
export function humanizeThinqStatus(status) {
  const rawState = status?.runState?.currentState;
  const label = humanizeState(rawState);
  const timer = status?.timer;
  let remainMinutes = null;
  if (rawState === 'RUNNING' && timer && (timer.remainHour || timer.remainMinute)) {
    remainMinutes = (timer.remainHour || 0) * 60 + (timer.remainMinute || 0);
  }
  return { state: label, remainMinutes };
}
