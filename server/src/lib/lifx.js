// Thin wrapper around the LIFX Cloud HTTP API (https://api.developer.lifx.com) -
// used by routes/smartDevices.js for any 'lifx' device that has a real bulb
// wired up (its external_id set). Uses the runtime's native fetch (Node 22+),
// same as the rest of the server.
const LIFX_API_BASE = 'https://api.lifx.com/v1';

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function parseErrorBody(res) {
  try {
    const body = await res.json();
    return body.error || JSON.stringify(body);
  } catch {
    return res.statusText;
  }
}

// Every light on the account, regardless of on/off/group - callers filter
// down to whichever aren't already linked to a local device.
export async function listLifxLights(token) {
  const res = await fetch(`${LIFX_API_BASE}/lights/all`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`LIFX API error (${res.status}): ${await parseErrorBody(res)}`);
  return res.json();
}

// selector is the light's own "id:<...>" (what listLifxLights returns as
// `.id`, prefixed with "id:" to address exactly that one bulb rather than a
// group/label match). Only the fields actually passed are changed - the
// same "just the touched fields" shape the local PUT /:id route already
// uses, so a brightness-only drag doesn't also force the power state.
export async function setLifxState(token, selector, { isOn, brightness, color } = {}) {
  const body = { duration: 0.5 }; // a short, smooth transition instead of an instant jump
  if (isOn !== undefined) body.power = isOn ? 'on' : 'off';
  if (brightness !== undefined) body.brightness = Math.max(0, Math.min(100, brightness)) / 100;
  if (color !== undefined) body.color = color; // LIFX accepts "#rrggbb" directly

  const res = await fetch(`${LIFX_API_BASE}/lights/${encodeURIComponent(selector)}/state`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`LIFX API error (${res.status}): ${await parseErrorBody(res)}`);
  return res.json();
}
