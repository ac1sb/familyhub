const BASE = '/api';

async function request(path, options = {}) {
  const resp = await fetch(`${BASE}${path}`, {
    headers: options.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!resp.ok) {
    let message = `Request failed: ${resp.status}`;
    try {
      const body = await resp.json();
      message = body.error || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  if (resp.status === 204) return null;
  return resp.json();
}

export const api = {
  config: () => request('/config'),

  events: (week) => request(`/events?week=${week}`),
  createEvent: (data) => request('/events', { method: 'POST', body: JSON.stringify(data) }),
  updateEvent: (id, data) => request(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEvent: (id) => request(`/events/${id}`, { method: 'DELETE' }),

  chores: (week) => request(`/chores?week=${week}`),
  createChore: (week, data) => request(`/chores?week=${week}`, { method: 'POST', body: JSON.stringify(data) }),
  updateChore: (id, data) => request(`/chores/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteChore: (id) => request(`/chores/${id}`, { method: 'DELETE' }),

  choreTemplates: () => request('/chore-templates'),
  createChoreTemplate: (data) => request('/chore-templates', { method: 'POST', body: JSON.stringify(data) }),
  updateChoreTemplate: (id, data) => request(`/chore-templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteChoreTemplate: (id) => request(`/chore-templates/${id}`, { method: 'DELETE' }),

  meals: (week) => request(`/meals?week=${week}`),
  setMeal: (week, day, name) => request(`/meals/${day}?week=${week}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  reorderMeals: (week, names) => request(`/meals?week=${week}`, { method: 'PUT', body: JSON.stringify({ names }) }),

  lunchRange: (start, end) => request(`/lunch?start=${start}&end=${end}`),
  setLunchDay: (date, data) => request(`/lunch/${date}`, { method: 'PUT', body: JSON.stringify(data) }),

  shopping: () => request('/shopping'),
  addShoppingItem: (name) => request('/shopping', { method: 'POST', body: JSON.stringify({ name }) }),
  updateShoppingItem: (id, data) => request(`/shopping/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteShoppingItem: (id) => request(`/shopping/${id}`, { method: 'DELETE' }),

  weather: (zip) => request(`/weather${zip ? `?zip=${zip}` : ''}`),

  settings: () => request('/settings'),
  updateSettings: (data) => request('/settings', { method: 'PUT', body: JSON.stringify(data) }),

  googleStatus: () => request('/google/status'),
  googleAuthUrl: () => request('/google/auth-url'),
  googleDisconnect: () => request('/google/disconnect', { method: 'POST' }),

  scanFlyer: (file) => {
    const form = new FormData();
    form.append('photo', file);
    return request('/flyer/scan', { method: 'POST', body: form });
  },
};
