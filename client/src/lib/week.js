export const WEEKDAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + diffToMonday);
  return d;
}

export function toISODate(date) {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function currentWeekStart() {
  return toISODate(startOfWeek(new Date()));
}

// Chores specifically reset on Sunday rather than Monday (a separate
// convention from the calendar/meals week above).
export function startOfWeekSunday(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday .. 6 = Saturday
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

export function currentWeekStartSunday() {
  return toISODate(startOfWeekSunday(new Date()));
}

// Sun-first day-index order (0=Mon..6=Sun encoding stays the same everywhere
// it's stored; this just controls display/iteration order to match a week
// that visually starts on Sunday).
export const SUNDAY_FIRST_DAY_ORDER = [6, 0, 1, 2, 3, 4, 5];

export function formatDayHeader(date) {
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function todayISO() {
  return toISODate(new Date());
}

// Days for a month-grid: leading blanks (nulls) so the 1st lines up under its
// real weekday (Mon-first), followed by every date in that month.
export function monthGridDays(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const firstWeekday = (first.getDay() + 6) % 7; // 0=Mon..6=Sun
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const cells = Array(firstWeekday).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(toISODate(new Date(year, monthIndex, day)));
  }
  return cells;
}

export function formatMonthLabel(year, monthIndex) {
  return new Date(year, monthIndex, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

// Same as monthGridDays, but skips Saturday/Sunday entirely (a 5-column
// Mon-Fri grid), and - unlike monthGridDays - fills the first/last partial
// week with real days from the adjacent month instead of leaving blank
// cells. A school week spanning a month boundary (the common case right
// around the 1st) is then one continuous, fully editable run of days rather
// than getting cut off mid-week; each cell reports whether it's actually in
// the month being viewed (inMonth) so the caller can dim the borrowed ones.
export function weekdayGridDays(year, monthIndex) {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7; // 0=Mon..6=Sun
  const lastWeekday = (new Date(year, monthIndex, daysInMonth).getDay() + 6) % 7;

  const cells = [];

  // Leading weekdays borrowed from the previous month, back to that week's
  // Monday - only needed when the 1st itself falls on a weekday.
  if (firstWeekday <= 4) {
    for (let i = firstWeekday; i >= 1; i--) {
      cells.push({ date: toISODate(new Date(year, monthIndex, 1 - i)), inMonth: false });
    }
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, monthIndex, day);
    const weekday = (date.getDay() + 6) % 7;
    if (weekday <= 4) cells.push({ date: toISODate(date), inMonth: true });
  }

  // Trailing weekdays borrowed from the next month, forward to that week's
  // Friday - only needed when the last day itself falls on a weekday.
  if (lastWeekday <= 4) {
    for (let i = 1; i <= 4 - lastWeekday; i++) {
      cells.push({ date: toISODate(new Date(year, monthIndex, daysInMonth + i)), inMonth: false });
    }
  }

  return cells;
}
