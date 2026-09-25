const KEY = 'familyhub.calendarPageView.v1';
const VALID_VIEWS = new Set(['agenda', 'week', 'month', 'day']);
const VALID_MEMBERS = new Set(['member_1', 'member_2', 'member_3']);

const DEFAULTS = {
  view: 'agenda', // 'agenda' (rolling window) | 'week' | 'month' | 'day'
  member: null, // null = All, otherwise one of member_1/2/3
};

// Per-device, like every other display choice on this dashboard - which
// calendar layout and which family member's events to show, only used by
// the full Calendar page (the compact dashboard widget always stays a
// rolling agenda showing everyone, since it's a small glance widget).
export function getCalendarPageSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      view: VALID_VIEWS.has(parsed.view) ? parsed.view : DEFAULTS.view,
      member: VALID_MEMBERS.has(parsed.member) ? parsed.member : null,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setCalendarPageSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // private browsing / storage blocked - choice just won't persist on this device
  }
}
