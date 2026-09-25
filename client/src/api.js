import { dataUrlToBlob } from './lib/canvas.js';

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
  eventsRange: (start, days = 7) => request(`/events?start=${start}&days=${days}`),
  createEvent: (data) => request('/events', { method: 'POST', body: JSON.stringify(data) }),
  updateEvent: (id, data) => request(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEvent: (id) => request(`/events/${id}`, { method: 'DELETE' }),

  chores: (week) => request(`/chores?week=${week}`),
  createChore: (week, data) => request(`/chores?week=${week}`, { method: 'POST', body: JSON.stringify(data) }),
  updateChore: (id, data) => request(`/chores/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  choreTemplates: () => request('/chore-templates'),
  createChoreTemplate: (data) => request('/chore-templates', { method: 'POST', body: JSON.stringify(data) }),
  updateChoreTemplate: (id, data) => request(`/chore-templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteChoreTemplate: (id) => request(`/chore-templates/${id}`, { method: 'DELETE' }),

  dailyTasks: (date) => request(`/daily-tasks?date=${date}`),
  createDailyTask: (date, data) => request(`/daily-tasks?date=${date}`, { method: 'POST', body: JSON.stringify(data) }),
  updateDailyTask: (id, data) => request(`/daily-tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  dailyTaskTemplates: () => request('/daily-task-templates'),
  createDailyTaskTemplate: (data) => request('/daily-task-templates', { method: 'POST', body: JSON.stringify(data) }),
  updateDailyTaskTemplate: (id, data) =>
    request(`/daily-task-templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDailyTaskTemplate: (id) => request(`/daily-task-templates/${id}`, { method: 'DELETE' }),

  meals: (week) => request(`/meals?week=${week}`),
  setMeal: (week, day, name) => request(`/meals/${day}?week=${week}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  reorderMeals: (week, names) => request(`/meals?week=${week}`, { method: 'PUT', body: JSON.stringify({ names }) }),

  lunchRange: (start, end) => request(`/lunch?start=${start}&end=${end}`),
  setLunchDay: (date, data) => request(`/lunch/${date}`, { method: 'PUT', body: JSON.stringify(data) }),
  lunchImportSettings: () => request('/lunch/import-settings'),
  importLunchMenu: (url) => request('/lunch/import', { method: 'POST', body: JSON.stringify({ url }) }),

  shopping: () => request('/shopping'),
  addShoppingItem: (name) => request('/shopping', { method: 'POST', body: JSON.stringify({ name }) }),
  addInkShoppingItem: (dataUrl) => {
    const form = new FormData();
    form.append('image', dataUrlToBlob(dataUrl), 'item.png');
    return request('/shopping/ink', { method: 'POST', body: form });
  },
  updateShoppingItem: (id, data) => request(`/shopping/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteShoppingItem: (id) => request(`/shopping/${id}`, { method: 'DELETE' }),
  shoppingSheetSettings: () => request('/shopping/sheet-settings'),
  saveShoppingSheetId: (sheetId) => request('/shopping/sheet-settings', { method: 'POST', body: JSON.stringify({ sheetId }) }),
  syncShoppingSheet: (sheetId) => request('/shopping/sync-sheet', { method: 'POST', body: JSON.stringify({ sheetId }) }),

  whiteboard: () => request('/whiteboard'),
  saveWhiteboard: (dataUrl) => {
    const form = new FormData();
    form.append('image', dataUrlToBlob(dataUrl), 'whiteboard.png');
    return request('/whiteboard', { method: 'POST', body: form });
  },
  whiteboardNotes: () => request('/whiteboard/notes'),
  archiveWhiteboardNote: (dataUrl) => {
    const form = new FormData();
    form.append('image', dataUrlToBlob(dataUrl), 'note.png');
    return request('/whiteboard/notes', { method: 'POST', body: form });
  },
  deleteWhiteboardNote: (id) => request(`/whiteboard/notes/${id}`, { method: 'DELETE' }),

  smartDevices: () => request('/smart-devices'),
  createSmartDevice: (data) => request('/smart-devices', { method: 'POST', body: JSON.stringify(data) }),
  updateSmartDevice: (id, data) => request(`/smart-devices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSmartDevice: (id) => request(`/smart-devices/${id}`, { method: 'DELETE' }),
  lifxSettings: () => request('/smart-devices/lifx/settings'),
  saveLifxToken: (token) => request('/smart-devices/lifx/settings', { method: 'POST', body: JSON.stringify({ token }) }),
  discoverLifxLights: () => request('/smart-devices/lifx/discover'),

  weather: (zip) => request(`/weather${zip ? `?zip=${zip}` : ''}`),

  settings: () => request('/settings'),
  updateSettings: (data) => request('/settings', { method: 'PUT', body: JSON.stringify(data) }),

  googleStatus: () => request('/google/status'),
  googleAuthUrl: () => request('/google/auth-url'),
  googleDisconnect: () => request('/google/disconnect', { method: 'POST' }),

  updateCheck: () => request('/update/check'),
  updateStatus: () => request('/update/status'),
  updateRun: () => request('/update/run', { method: 'POST' }),

  scanFlyer: (file) => {
    const form = new FormData();
    form.append('photo', file);
    return request('/flyer/scan', { method: 'POST', body: form });
  },
};
