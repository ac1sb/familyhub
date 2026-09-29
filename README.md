# FamilyHub

A self-hosted, touchscreen-friendly family dashboard in the spirit of Skylight
Calendar / Mango Display — built to run on a Raspberry Pi driving a 17" touch
display, while staying reachable from phones/laptops on the same network (or
the internet, if you deploy it that way) so anyone can add to the calendar or
shopping list from another device.

## What's included

- **Home dashboard** — a full-height weekly calendar alongside today's
  weather, today/tomorrow's lunch status, chores, dinner menu, shopping
  list, and whiteboard, all in one glance. Any flagged reminder (see below)
  shows as a big banner across the top. To keep the main screen from
  turning into a wall of text, Chores and Daily Checklist show a
  completed-count next to their name plus up to 4 items - tapping one turns
  it green and drops it to the bottom of the list, so whatever's still open
  bubbles up and stays what's most visible (same idea on their own full
  pages: a "Show completed (N)" toggle keeps finished items out of the way
  by default). Shopping List is different by
  design: there's no checkbox, tapping an item crosses it off as purchased
  and it disappears from the dashboard glance immediately (nothing left to
  buy, nothing to show), leaving a tally of what's still needed plus a
  quick-add box (typing a name and hitting Add/Enter drops it straight onto
  the list). Every still-needed item renders in its own scrolling area (no
  fixed cap) - how many show without scrolling just depends on how tall
  you've dragged the widget (its resize handle, bottom-right corner), same
  idea as the Calendar widget. Its own full page can also **sync two-way with
  a Google Sheet** - paste that sheet's URL (or bare ID) into Settings →
  General → "Shopping List Google Sheet" once and it syncs automatically
  every few minutes from then on (SHOPPING_SHEET_SYNC_MINUTES in .env
  changes how often); "Sync with Sheet" on the Shopping List page is just
  for pulling in a change right away instead of waiting. It uses column F
  (row 2 down) on that spreadsheet's first tab, alongside whatever other
  columns are already there (column G quietly tracks which row is which
  item). A new item typed into column F (from a phone or anywhere else)
  lands here on the next sync, and a still-needed item added here gets a
  row there - handy both
  for adding on the go and for merging into a bigger list kept elsewhere
  before printing. Never deletes, clears, or shifts anything on either
  side - it only ever fills in blank F/G cells, so removing a row from the
  sheet doesn't remove it here (the ✕ button does that);
  syncing a sheet that already has some of the same items typed into column
  F links them up by name
  instead of creating duplicates. Requires the same connected Google
  account as Calendar sync (Settings → Calendar → Google Calendar) -
  connecting or reconnecting after this feature was added re-prompts for
  the added Sheets permission. If OAuth isn't set up yet (it needs a
  stable, reachable redirect URL, which a not-yet-networked Pi might not
  have), Settings → General → "Sheets Service Account" is a sign-in-free
  alternative just for this sync: paste in a Google Cloud service
  account's downloaded JSON key (after sharing the sheet with that
  account's email as an editor) and it's used instead of the OAuth
  connection.
  Chores, Daily Checklist, and Lunch can each
  independently pick one of three widget styles in Settings → Dashboard
  Widgets (e.g. Chores as Squares, Daily Checklist as a Carousel) -
  **List** (the classic stacked full-width bars); **Squares** (a 2x2 tile
  grid that only takes up as much height as it needs - 1-2 items sit at
  their normal size in the top row rather than stretching to fill the whole
  box; like List, it only ever shows the top 4 - the rest are a tap away on
  "See all" - so the widget is always the same fixed size, never wider or
  taller than the 2x2 grid; each tile leads with a large icon - guessed from
  the task's title against a
  ~130-icon library (`client/src/lib/taskIcons.js`) organized into 14
  categories for Chores/Daily Checklist (Personal Care, School, Pets,
  Kitchen, Cleaning, and so on; anything unrecognized falls back to a plain
  notepad icon), or picked by hand per recurring chore/daily item in
  Settings → Chore Setup / Daily Checklist Setup - tap the icon next to its
  name to browse the same categorized library and override the guess (or
  pick "Auto-guess from name" to go back to it); Lunch's tiles use a fixed
  status icon instead (🏫 school lunch day, 🥪 packed from home, 🚫 no
  school) with the day and the actual menu item as the tile's text (e.g.
  "Today: Turkey Sandwich"), so what's actually being served is readable at
  a glance instead of needing a tap to find out. A long title/menu item
  clamps to 2 lines with an ellipsis instead of overflowing the tile, full
  text via hover or "See all"); or **Carousel**
  (one big tile at a time - swipe it left/right, use the arrow buttons, or
  tap a dot to jump to a specific item). Tapping a tile/bar itself always
  toggles it (done for Chores/Daily Checklist, School/Home for Lunch), in
  any style - these are just different skins on the same list, not separate
  features, so switching back and forth never loses anything. Every widget
  can be dragged and resized to your own layout, which is saved per-device
  (in the browser) and survives `git pull`/rebuilds - or turn on **"Lock
  dashboard layout on this device"** in Settings → Dashboard Widgets once
  it's arranged the way you want, so a stray touchscreen drag (or a curious
  kid) can't move or resize anything; everything else about the dashboard
  still works normally, and it's a one-tap toggle to unlock again for
  rearranging. Widgets free-float
  rather than snapping tightly together - moving one out of the way, or
  hiding it in Settings, leaves the gap it left behind instead of the rest
  of the board auto-packing to close it up; dragging one onto another still
  pushes that one out of the way, so nothing ends up overlapping. Pick which
  widgets appear at all — and give any of them their own background color,
  overriding the normal day/night theme for just that one — in Settings →
  Dashboard Widgets (also per-device, so a phone can show fewer than the
  wall display, or its own color scheme, or a different widget style); a
  widget that's undersized for its own content grows itself to fit
  automatically, nudging anything directly in its way further down rather
  than overlapping it (Carousel-mode widgets are exempt from this, since a
  carousel tile is designed to fill whatever height it's given rather than
  ever needing more room). Also in Settings → Dashboard Widgets: a
  **dashboard background photo**, from the same free nature-photo library
  (landscapes/mountains/waterfalls/lakes/forests) the screensaver uses. Off
  by default; **Static** picks one photo and keeps it (a "New photo" button
  gets another, and changing the theme fetches a fresh one automatically);
  **Rotating** swaps it out on a timer (5/10/15/30/60 min). Turning this on
  makes every widget frosted/translucent (blurred) instead of a flat fill -
  its own custom color if it has one, otherwise the normal themed color -
  so the photo shows through the whole dashboard, not just the gaps between
  widgets; with the background off, widgets stay fully opaque as normal. A
  **frost level slider** (0-100%) controls how see-through that frosting is,
  per-device like the rest of these settings - lower lets more of the photo
  through and also reduces the blur along with it, so 0% is a genuinely
  crisp, fully see-through widget (no tint, no blur), not just an untinted
  blurry one; higher keeps widgets more solid/readable, and more blurred.
  Widget header titles switch to the theme's stronger text color plus a
  glow (a light halo behind dark text, or a dark halo behind light text in
  night mode) whenever a background photo is on, since their normal muted
  gray washes out over a busy/bright photo.
- **Built-in calendar**, four layouts on the full page (**Agenda / Week /
  Month / Day**, a toggle under the header, remembered per-device) plus an
  **All / Mom / Dad / Child** person filter next to it that narrows every
  layout down to one member's events (or back to everyone). **Agenda** is
  the original rolling view: three tappable member columns, showing more
  than the default 7 days when there's room for it - it measures the window
  and grows to fill the available height (up to 21 days) instead of leaving
  blank space below a fixed week on a tall screen. **Week** is the same
  column layout, pinned to a fixed Mon-Sun calendar week instead of rolling
  from today. **Day** is one day at a time, same columns. **Month** is a
  full Mon-Sun month grid (own layout, not columns) - each day cell shows
  up to 3 events (color-coded per member, "+N more" past that) and tapping
  a blank part of a day opens Add Event pre-filled for that date; tapping
  an event opens its usual detail view. Whichever layout, tapping a
  member's name (Agenda/Week/Day) opens **Add Event** preselected for that
  person, and tapping an existing event opens its full details (including
  its saved flyer photo, if it has one), with Edit and Delete right there.
  The compact widget on Home always stays a rolling Agenda view showing
  everyone (no view/person controls there - it's a small glance widget), at
  a much smaller scale (1-10 days): it always shows exactly as many days as
  fit its current box with no leftover scrollbar, so dragging its resize
  handle (see "Every widget can be dragged and resized" above) bigger or
  smaller changes how many days it shows automatically - no separate
  setting for it.
- **Calendar sync** — two ways to bring in outside events: paste one or more
  calendars' secret iCal feed URLs (one per family member, say) for a simple
  read-only merge with no sign-in needed, or connect a Google account via
  OAuth for two-way sync (its events show up here, and one-off events
  created in FamilyHub are pushed back to it).
- **Recurring events** — a "Repeats weekly" checkbox plus day-of-week chips,
  for anything that happens multiple times a week or the same day every week.
- **Big reminder banners** — flag any event as an "important reminder" and
  it shows as a large, hard-to-miss banner on the dashboard the day it's due
  (e.g. "Band Practice — bring your instrument!").
- **Flyer/poster scanning** — snap a photo of a flyer, printed schedule, or
  paper calendar page from the Add Event form; the server OCRs it, guesses a
  title/date/time/location with `chrono-node`, and lets you review/edit
  before saving. The photo itself is kept and attached to the event.
- **Chore list** for the week (no per-person assignment - it's one shared
  list, not split up by name), plus **recurring chores** set up once in
  Settings → Chore Setup (Daily Checklist has its own equivalent Setup tab)
  that automatically reappear (unchecked) every week/day. A recurring
  item's name is editable right there in Settings - click into it and type,
  no need to delete and re-add just to fix a typo or rename it. Both Chores and the Daily
  Checklist show as tappable tiles (like the Lunch today/tomorrow cards) -
  tap one to mark it done and a green checkmark appears on it, rather than a
  small checkbox to hit. A chore that repeats on several days (e.g.
  Mon/Wed/Thu) shows as a single row with one badge per expected day - only
  today's badge can actually be tapped (the others are shown, dimmed, so the
  week's schedule is still visible, but checking one off early or fixing a
  past day after the fact isn't allowed). A one-off chore with no day
  attached stays tappable any time, same as before.
- **Weekly dinner menu** — a row of day boxes (day tab on top, meal name
  below), with today's day tab highlighted so it stands out from the rest
  of the week. The day tabs are fixed - drag a meal box by its ⠿ handle
  onto a different day to swap the two, and only the meal box itself
  visibly moves; the day tabs never do. On the dashboard the boxes always
  stay in one row and shrink or grow to exactly fill however wide you
  resize the widget, rather than wrapping into extra rows or overflowing
  past its edge - meal names ellipsize (…) if a box gets too narrow to show
  the whole thing. The dashboard widget specifically is a rolling "next 5
  days" view (like the calendar's), not a fixed Mon-Sun week - so on a
  Saturday or Sunday it rolls into next week's menu instead of running out
  of days to show; editing or swapping a day there still writes to the
  correct week underneath even when two boxes span a week boundary. The
  full page always shows the current Mon-Sun week for planning ahead.
  Recipes can also be filled in automatically from a photo - see
  **Meal Plan Photos** below - instead of typing each one in by hand.
- **Lunch calendar** for one child — a full monthly view (tap a day to toggle
  School/Pack-from-home, mark no-school days, jot the menu item), always
  filling the whole screen instead of stopping at a fixed cell size and
  leaving blank space below. Two layouts, a **Square/List** toggle at the
  top of the page (per-device, remembered next visit): **Square** is the
  original month grid, its day cells stretched to fill the page (so they
  end up roughly square instead of short and wide) for a real wall-calendar
  feel; **List** is a full-width row per school day instead - better for a
  long entree name that a small grid cell would cramp. Both layouts extend
  into the tail end of the adjacent month to complete a week that spans a
  month boundary - shown dimmed but fully editable - instead of cutting off
  mid-week right when the month changes over. Plus a
  dashboard card that shows *today's* status until 3pm and then flips to
  *tomorrow's*, so packing a lunch is never a last-minute scramble. Can
  auto-sync the entrée for each day from a school lunch menu site (including
  JS-rendered sites, via a headless-browser fallback) instead of typing it
  in by hand. Set `LUNCH_MENU_URL` in `server/.env` to pre-fill that sync
  URL on a fresh install instead of re-pasting it into Settings every time
  - the `date=` part of the URL never needs updating by hand either way,
  since each sync always walks forward to the current + next couple of
  months regardless of what's saved.
- **Shopping list**, editable from any device, with support for quick
  handwritten/drawn items in addition to typed ones. Tap an item to cross it
  off as purchased (no checkbox) - the full list keeps it visible, dated and
  sorted to the bottom, until the ✕ deletes it outright.
- **Whiteboard** — a shared drawing pad synced to every screen and phone;
  draw right in the dashboard widget for a quick note, or open the full
  page for a bigger canvas. Saving from the full page returns you to the
  dashboard automatically. Clearing the board archives whatever was on it
  first, so past notes are browsable (on the full page) instead of just
  thrown away. Finger-drawn strokes are smoothed (a curve through the
  points instead of straight segments between them) and taper by drawing
  speed - thinner on a quick stroke, a touch thicker where it slows down or
  pauses - so a message written with a finger reads more like natural
  handwriting than a jagged, uniform-width line; a plain tap leaves a dot
  (for a period or the dot over an "i") instead of nothing.
- **Smart Home** — a tiled-button control widget (like the LIFX app itself):
  tap a tile to flip it on/off, press and hold a dimmable/color one to pull
  up a brightness/color popover, from the dashboard or the full page
  (grouped by room). A quick-access strip of the same devices sits in the
  header on every page with the same tap/hold gesture. **LIFX is real**:
  paste a Personal Access Token (from cloud.lifx.com/settings) in Settings
  → Smart Home Setup, tap **Discover LIFX Lights** to pull in every bulb on
  the account not already added, and every toggle/brightness/color change
  after that calls the actual bulb via the LIFX Cloud API - a failed call
  (bulb offline, bad token) shows an error and reverts instead of pretending
  it worked. **Lutron Caseta has no real integration yet** - it (and any
  LIFX device added by typing a name instead of using Discover) stays a
  local-only mock, same as the four example devices (Dining Room, Living
  Room, Lamp, Kitchen Counter) seeded in on first run; see "Known
  limitations" below for what real Caseta support would need. **LG ThinQ
  washer/dryer status is also real** - read-only (no remote start/stop, just
  whether it's running and how much time is left), using LG's official
  ThinQ Connect API rather than a reverse-engineered one, so it needs no
  Home Assistant server or bridge. Generate a Personal Access Token at
  [thinq.developer.lge.com](https://thinq.developer.lge.com) (Cloud
  Developer → Docs → ThinQ Connect → Personal Access Token, for the LG
  account the appliances are registered to), paste it in Settings → Smart
  Home Setup along with the two-letter country code they're registered in,
  then tap **Discover LG Appliances** to add the washer/dryer it finds.
  Status is fetched fresh on every request, never cached, so there's nothing
  to go stale. Its tile shows a live, ticking countdown clock while it's
  actually running (client-side, between polls) - hidden once it's done or
  idle, since a leftover remaining time on a finished cycle isn't meaningful.
  The header's quick-access strip shows it too, as a read-only status chip
  (not a toggle) - unlike the Smart Home page's tile, this one never hides
  itself, so a glance at the header answers "is it done yet" (Running with a
  countdown, or Done) without opening the full page.
- **Weather** — a row of quick-glance chips in the header on every page,
  opposite the smart-home toggles with a prominent date/time between them
  (current temp, high/low, and precipitation chance - deliberately just
  those three; the morning/afternoon/evening breakdown and the clothing hint
  are a tap away on the Weather page instead of cluttering every page's
  header), a "Today" card on the dashboard, and a full 7-day forecast on its
  own sidebar tab. Geocoded from a US zip code via Open-Meteo (no API key
  required).
- **Day/night theme** — switches automatically on a schedule you set in
  Settings → Appearance (or pin it to always-light/always-dark).
- **Control style** — per-device (Settings → Appearance): Flat (the original
  minimal look), Soft (a gentle shadow/lift on buttons and cards), or Tactile
  (chamfered, beveled buttons with a pressed-in click) - purely visual, applies
  immediately with no Save button.
- **Screensaver** — per-device (Settings → Screensaver): idle timeout, photo
  interval, and background theme (landscapes/mountains/waterfalls/lakes/
  forests), with a clock/date/weather overlay and a Preview button. Off by
  default on every device; turn it on for the wall display only. Optionally
  overlays the shared whiteboard in a corner - the same live drawing as
  everywhere else, sized to actually be readable from across the room
  (scales with the screen, well up from a small thumbnail, without growing
  large enough to reach the centered clock) rather than a small tan
  sticky-note prop, so a message left on the board is still visible while
  the screensaver's up. Also optionally shows a daily briefing card listing
  today's calendar events, which starts appearing at 5am (so it reads as
  "here's your day" rather than showing up overnight), **family
  photos** (synced in from a shared Google Drive folder, see below) cycling
  in their own corner, and/or **laundry status** - the same LG ThinQ
  washer/dryer status and live countdown as the header chip, for a glance at
  the screensaver instead of dismissing it - deliberately not the
  background, so none of these compete with the chosen theme. All four
  overlays periodically relocate to a different corner of the screen to
  avoid burn-in on a display that's on all day, and never land on top of
  each other even with all four on.
- **Music** (Settings → Music) — connects Spotify and controls whatever
  device is currently active on the account: play/pause, skip, volume, and
  switching devices, from a dashboard tile or its own page. With
  [librespot](https://github.com/librespot-org/librespot) set up on the Pi
  (see below), the Pi itself becomes a real, selectable Spotify Connect
  speaker rather than just a remote. Requires Spotify Premium.
- **Editable Settings** — rename household members, change the weather zip,
  and set the day/night schedule, all from the app (no `.env` editing or
  restart required after first setup).
- **Slide-down navigation menu** — one button per widget for a large, focused
  view of just that widget. Tucked behind a single menu button in the
  header's upper-left corner rather than a permanent sidebar, so the main
  page keeps the full width of the screen; tapping it slides the menu down
  over the page, and picking a destination (or tapping outside it) slides it
  away again.
- **Multi-device sync** — every screen polls the API every 10–30s, so an
  event/chore/list item added from a phone shows up on the Pi display
  shortly after, and vice versa.

Everything is built as a normal client/server web app (React + Express +
SQLite) so it can be hosted anywhere with Node.js and reached from any
browser on the network.

## Project layout

```
server/   Express API + SQLite database (Node's built-in node:sqlite) + OCR + Google OAuth
client/   React (Vite) touchscreen UI
```

## Requirements

- Node.js **22.5+** (needed for the built-in `node:sqlite` module — no native
  compiler/build tools required, so this installs cleanly on Windows, macOS,
  Linux, and a Raspberry Pi with just Node itself)
- A US zip code for weather (Open-Meteo + Zippopotam.us, both free, no keys)
- Optional: a Google Cloud OAuth client if you want Google Calendar sync

## Setup

```bash
npm run install:all
cp server/.env.example server/.env
# edit server/.env: set WEATHER_ZIP, member names, Google credentials, etc.
```

### Development (hot reload)

Run the API and the Vite dev server in two terminals:

```bash
npm run dev:server   # http://localhost:4000
npm run dev:client   # http://localhost:5173 (proxies /api and /uploads to :4000)
```

Open `http://localhost:5173` while developing.

### Production build (what you'll actually run on the Pi / server)

```bash
npm run build         # builds client/dist
npm start             # Express serves the API + the built client on one port
```

Then visit `http://<host>:4000/` from any device on the network.

### Updating to the latest version

Once it's set up, pulling and running new changes is one command from the
repo root:

```bash
npm run update
```

This runs `git pull`, reinstalls any new/changed dependencies in both
`server/` and `client/`, rebuilds the client, and starts the server - the
same four steps you'd otherwise run by hand. Stop the currently running
server first (Ctrl+C) if one's already up, since this starts a new one at
the end.

The one thing it can't do automatically: if a future update adds a new
dependency that npm's install-scripts safety check blocks (the same kind of
prompt `esbuild` triggered during setup), `npm run update` will pause with
that warning instead of finishing. Run `npm install-scripts approve
<package-name>` as it tells you to, then run `npm run update` again.

If `npm run update` (or `npm run build`) fails on Windows with `Cannot find
module @rollup/rollup-win32-x64-msvc` (or a similar `@rollup/rollup-<platform>`
error on another OS), that's a known npm bug
([npm/cli#4828](https://github.com/npm/cli/issues/4828)), not anything wrong
with FamilyHub - it happens when `package-lock.json` was last regenerated on
a different OS than the one installing now (this repo gets worked on across
Linux/Mac/Windows machines). Fix: delete `client/node_modules` and
`client/package-lock.json`, then run `npm run update` again to reinstall clean.

If it instead fails with an `ERESOLVE`/`peer dependency` error mentioning `vite`
and `@vitejs/plugin-react` - especially if the "Found" version of `vite` looks
newer than `^5.4.6` - that's not a project bug either: it means `client/package.json`
(and/or `client/package-lock.json`) has a local edit that no longer matches the
checked-in one (commonly from having run `npm install vite@latest` by hand at
some point to chase down an unrelated warning). Check with `git status`; if
those files show as modified, run `git checkout -- client/package.json
client/package-lock.json` to drop the local edit, then do the same clean
reinstall as above (delete `client/node_modules` and `client/package-lock.json`,
then `npm run update` again).

#### Updating from inside the app

Settings → General → Software Update has a **Check for updates** /
**Update now** button that does the same thing without SSH: `git pull`,
reinstall dependencies, rebuild the client, then restart the server. The
display goes blank for a minute or two while it restarts, then reloads
itself automatically. If `git pull`, installing, or building fails, nothing
is touched and the currently-running app keeps serving as if nothing
happened - only a *successful* update ever restarts anything.

By default this stops the running Node process itself and starts a fresh
one, which is fine for the simple "just run `npm start`" setup this README
otherwise describes. If you run FamilyHub under a process supervisor
instead (`pm2`, a `systemd` service, ...), set `UPDATE_RESTART_CMD` in
`server/.env` to whatever restarts it *there* (e.g. `pm2 restart familyhub`
or `sudo systemctl restart familyhub`) - otherwise the in-app button and
your supervisor's own restart policy would both try to manage the same
process and fight each other.

## Configuring household members & weather

Open the app's **Settings → General** tab to rename the three household
members or change the weather zip code — changes save immediately and take
effect across the app (agenda columns, lunch tracker, chore assignment) with
no restart needed.

The `MEMBER_1_NAME` / `MEMBER_2_NAME` / `MEMBER_3_NAME` / `WEATHER_ZIP`
values in `server/.env` are only the *first-run defaults*; once anything is
saved from Settings, the database value takes over and the `.env` value is
ignored from then on.

## Recurring chores

Chores you add from the Chores widget's "Add a one-time chore" field are
just that — one-time. For a chore that should reappear every week already
unchecked (trash day, feeding a pet, etc.), add it once in **Settings →
Chore Setup**. Toggle a chore off there to pause it without losing its
setup, or delete it to remove it for good.

## Connecting a shared calendar (easiest option)

If you just want a calendar's events to show up on the agenda and don't need
FamilyHub to write anything back to it, skip Google OAuth entirely: open
that calendar's Settings in Google Calendar -> "Integrate calendar" -> copy
its **Secret address in iCal format**, then paste that URL into Settings ->
Calendar -> "Shared calendar feeds." No Google Cloud project, no sign-in, no
client ID/secret - the secret URL is the only credential involved, and it's
read-only (FamilyHub never writes to it).

You can add more than one - "+ Add another feed" adds another URL/column
pair, so each family member's own calendar can sync to their own column
instead of everyone sharing one feed. Each feed defaults to showing under
"Family" (every column); pick a specific person from its dropdown instead if
that calendar is really just theirs.

## Connecting Google Calendar (two-way sync)

1. In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   create an **OAuth client ID** of type "Web application".
2. Add an authorized redirect URI matching where the server will run, e.g.
   `http://<host>:4000/api/google/oauth2callback`.
3. Put the client ID/secret/redirect URI into `server/.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=http://<host>:4000/api/google/oauth2callback
   ```
4. Restart the server, open the app's **Settings** tab, and tap
   **Connect Google Calendar**.

This syncs both ways: that calendar's events show up in the agenda, and
one-off events created *in* FamilyHub are pushed to it too (so they show up
on your phone's Google Calendar app, for instance). Recurring events
("Repeats weekly") are the one exception - they stay FamilyHub-only for now,
since our weekly-recurrence model doesn't map cleanly onto how Google
expands a recurring series, and pushing them would risk showing every
occurrence twice.

By default this syncs to the signed-in account's own ("primary") calendar.
To sync to a *shared* family calendar instead, share that calendar with the
OAuth account as an editor, then paste its Calendar ID (same "Integrate
calendar" settings page as above) into Settings -> Calendar -> "Google
Calendar to sync events to".

If you connected Google Calendar before this two-way sync existed, that
connection only has read access - disconnect and reconnect once from
Settings to approve the write permission.

Same as the iCal feed above, synced Google events default to "Family" (every
column) - the "Show its events under" dropdown next to the Calendar ID field
pins them to one member's column instead, for when the connected calendar is
really just that person's own schedule.

### Pushing each person's events onto their own Google Calendar

The single Calendar ID above is one shared destination for every event,
regardless of which column it's under. Settings -> Calendar also has a
separate, optional **"Push each person's events onto their own Google
Calendar"** section that routes events per-person instead, using that same
one OAuth connection - nobody else needs their own API/OAuth setup:

1. Have each of the two adult members share their personal Google Calendar
   with the connected account as an editor (**⋮ → Settings and sharing →
   Share with specific people → add that account → "Make changes to
   events"**).
2. Paste each one's Calendar ID into their field in that Settings section.

An event assigned to one of those two members' columns is then pushed onto
that person's own calendar. A third member's events (assumed to be a child
without their own Google account) are pushed onto **both** configured
calendars instead, so both parents see it without a third calendar field.
Reassigning an event to a different person later moves it: it's removed from
whichever calendar(s) it was on and pushed fresh to the new one(s) (a new
event on Google's side, since there's no cross-calendar "move" for this).
Recurring events are skipped here for the same reason as the shared calendar
above.

## Flyer / poster photo scanning

The Add Event modal has a "Scan a flyer" file/camera input. On a touchscreen
or phone this opens the camera directly; on a desktop it's a normal file
picker. The server runs OCR (`tesseract.js`) on the photo, tries to extract a
title, date/time, and location, and pre-fills the form — always editable
before you save. The original photo is stored under `server/uploads/` and
its path is saved on the event.

Note: the first OCR run downloads the English trained-data file, so the Pi
needs internet access at least once.

## Family Photos (screensaver from one or more Google Drive folders)

**Settings → Family Photos** syncs in photos from one or more shared Google
Drive folders, so anyone in the family can add a photo the normal way
(Photos app → the share icon → **Save to Drive** → pick the folder) without
uploading anything to FamilyHub directly. Add more than one folder (one per
person, or however you want to split it up, using "+ Add another folder")
and they all mix into the same rotation — the same photo shared into two
folders is only ever stored once. Set one up:

1. In Google Drive, create a folder and share it (**⋮ → Share**) with
   whoever should be able to add photos to it - make sure the Google account
   you'll connect to FamilyHub (below) has at least viewer access too.
2. From an iPhone: Photos app → pick a photo → the share icon → **Save to
   Drive** (needs the Google Drive app installed) → choose that folder.
   Repeat for however many photos, from however many phones.
3. Copy the folder's link (its address bar when open in Drive, or just its
   ID) into Settings → Family Photos → "Google Drive folders" → **Save**,
   then **Sync Now** for the first pull (after that it re-syncs on its own
   every hour — `FAMILY_PHOTO_SYNC_MINUTES` in `.env` changes that). Repeat
   for any other folders.
4. Turn on **"Show family photos as a corner overlay"** in Settings →
   Screensaver to cycle through them - deliberately a corner element (same
   idea as the whiteboard sticky note), not the background photo, so it
   doesn't replace whatever theme you've picked there.

Requires the same Google account connected for Calendar sync (Settings →
Calendar) - connecting or reconnecting after this feature was added
re-prompts for the added Drive permission (read-only; FamilyHub never writes
to Drive). One folder failing to sync doesn't hold up the others - Settings
shows which one and why, right under the Sync Now button. Downloaded photos
are kept locally even if later removed from the Drive folder (removing one
from Settings only drops FamilyHub's own copy, not the real file).

HEIC photos (the default format on newer iPhones, which most browsers can't
display) are automatically converted to JPEG at sync time, so they show up
normally on the screensaver without needing any camera setting changed.

## Meal Plan Photos (auto-fill the Dinner Menu from a screenshot)

**Settings → Meal Plan Photos** reads recipe names off a meal-kit delivery's
order-slip screenshot (built against Hungryroot's, but not tied to its exact
wording) and writes them straight onto the upcoming Dinner Menu - no typing.
Set it up:

1. In Google Drive, create a folder (it can be the same one used for Family
   Photos, or its own) and share it with whoever takes the screenshot.
2. When a delivery's order slip shows up (an email, the delivery service's
   app, etc.), screenshot it and save it into that folder the same way as a
   Family Photo (share icon → **Save to Drive**).
3. Copy the folder's link or ID into Settings → Meal Plan Photos → **Save**,
   pick which day of the week should never get a meal filled in (defaults to
   Saturday), then **Sync Now** for the first pull (after that it checks the
   folder on its own every hour, same as Family Photos).

There is **no review step** - whatever the OCR reads off a new photo in the
folder is applied immediately, one recipe per day, starting the day after the
delivery date printed on the photo itself (OCR reads that too, not just the
recipe names) and skipping the configured day each time - e.g. a Friday
delivery with Saturday skipped starts on Sunday, however late the actual sync
happens to run (checking the folder is hourly, so a photo dropped in Friday
afternoon might not be read until evening). If a photo has no readable date
on it, it falls back to starting the day after whenever the sync runs
instead. Either way, a day that already has a meal in it - typed in by hand,
or from an earlier sync - is skipped over rather than overwritten, so this
only ever fills in a genuine gap, never clobbers something already there.
Settings shows the last several photos it processed and
exactly what it read from each one, so a misread is easy to catch and fix by
hand on the Dinner Menu page. A photo is only ever processed once (tracked by
its Drive file, the same way Family Photos avoids re-downloading); saving an
unrelated photo to the same folder can still land nonsense on the menu if it
happens to contain enough text, so keep this folder dedicated to order slips.
Requires the same Google account connected for Calendar sync (Settings →
Calendar).

## Spotify / Music (the Pi as a real Connect speaker)

**Settings → Music** connects Spotify and lets the Music page (and its
dashboard tile) control whatever device is currently playing, and also start
something itself: **"Play a playlist"** lists the account's own playlists and
starts one directly on the current (or a chosen) device, even with nothing
playing anywhere yet - no need to press play on a phone first just to get
something going. The interesting part beyond that is making the **Pi
itself** one of those devices, with a real speaker wired to it, using
[librespot](https://github.com/librespot-org/librespot) (an open-source
Spotify Connect client). Once it's running, "FamilyHub" (or whatever name
you give it) shows up as a device to switch to from the Music page, from
Spotify on anyone's phone, or from any other device on the account.

**Requires Spotify Premium** (a Family plan account works fine) - librespot
can't log in and act as a Connect device on a free account, and neither
Spotify's playback-control API nor the OAuth connection below function
without one.

### 1. Create a Spotify app and connect it

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   → **Create app**.
2. Add a **Redirect URI**. Spotify now rejects a plain `http://` URI outright
   unless the host is the literal loopback IP - `http://localhost:...`
   is **not** treated the same as `http://127.0.0.1:...` even though both
   point at the same machine, and using `localhost` gets a
   `redirect_uri: Insecure` error. Without real HTTPS set up (a reverse
   proxy with a certificate - out of scope here), use:
   `http://127.0.0.1:4000/api/spotify/oauth2callback`
   This means the one-time "Connect Spotify" click has to happen from a
   browser running **on the machine hosting FamilyHub itself** (the Pi's own
   browser, or `http://127.0.0.1:4000` typed there directly) - `127.0.0.1`
   always means "this machine" to whatever browser opens it, so it can't be
   done from your phone or another computer on the network. Once connected,
   the saved tokens work from every device as normal; only this first
   authorization click cares about the exact address. If you do have real
   HTTPS in front of FamilyHub, use that URL instead and skip the
   same-machine requirement.
3. Copy its **Client ID** and **Client Secret** into `server/.env`:
   ```
   SPOTIFY_CLIENT_ID=...
   SPOTIFY_CLIENT_SECRET=...
   SPOTIFY_REDIRECT_URI=http://127.0.0.1:4000/api/spotify/oauth2callback
   ```
4. Restart the server, then from a browser on that same machine, Settings →
   Music → **Connect Spotify**.

### 2. Install librespot on the Pi

Raspberry Pi OS Bookworm (Debian 12) ships a `librespot` package:
```
sudo apt update && sudo apt install -y librespot
```
If that's not available on your image, build it from source instead (needs
the Rust toolchain, which this pulls in for you):
```
sudo apt install -y curl build-essential pkg-config libasound2-dev
curl https://sh.rustup.rs -sSf | sh -s -- -y
source "$HOME/.cargo/env"
cargo install librespot
```
(the binary lands at `~/.cargo/bin/librespot` with this route - use that
full path in the systemd unit below instead of `/usr/bin/librespot`.)

### 3. Point it at your speaker

**Wired (aux/USB)** - usually just works. `aplay -l` lists the audio
devices Linux sees; if the Pi has more than one (e.g. onboard 3.5mm jack
*and* HDMI) and picked the wrong one, force it with
`sudo raspi-config` → System Options → Audio.

**Bluetooth** - pair and trust the speaker once first:
```
bluetoothctl
power on
agent on
scan on
# note the speaker's MAC address once it shows up in the scan, then:
pair AA:BB:CC:DD:EE:FF
trust AA:BB:CC:DD:EE:FF
connect AA:BB:CC:DD:EE:FF
exit
```
Then make sure it's the system's *default* audio output (exactly how
depends on whether your Pi OS image uses PipeWire, PulseAudio, or plain
ALSA/bluealsa - this is the one step most likely to need adjusting for your
specific setup; `pactl set-default-sink <sink-name>` is the PipeWire/
PulseAudio version, `pactl list sinks short` shows the exact name to use).

### 4. Run librespot as a systemd service (so it survives reboots)

Create `/etc/systemd/system/librespot.service`:
```ini
[Unit]
Description=Librespot Spotify Connect
After=sound.target network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/bin/librespot --name "FamilyHub" --bitrate 320 --initial-volume 70
Restart=always
RestartSec=5
User=pi

[Install]
WantedBy=multi-user.target
```
Then:
```
sudo systemctl daemon-reload
sudo systemctl enable --now librespot
```
(`--backend alsa` is librespot's default and covers both the wired and
Bluetooth cases above once the speaker is the default audio output; only
add `--backend pulseaudio` explicitly if your image uses PulseAudio/
PipeWire and ALSA alone doesn't reach it.)

### 5. Use it

Music page → **Change device** → pick **"FamilyHub"** (or whatever
`--name` you used) → **Play here**. From then on, starting playback
anywhere on the account and switching to that device sends the audio
through the Pi's speaker, and the Music page's play/pause/skip/volume
controls operate it directly.

## Running on a Raspberry Pi as a kiosk

1. Install Node.js 22.5+ on the Pi (via [nvm](https://github.com/nvm-sh/nvm)
   or NodeSource — the Node version in Raspberry Pi OS's own package
   repository is usually too old, so don't rely on `apt install nodejs`).
2. Copy this project to the Pi, run `npm run install:all`, `npm run build`,
   configure `server/.env`, then `npm start` (or run it under `pm2` /
   a `systemd` service so it survives reboots).
3. Point Chromium at it in kiosk mode, e.g. add to `~/.config/lxsession/LXDE-pi/autostart`:
   ```
   @chromium-browser --kiosk --noerrdialogs --disable-infobars --incognito http://localhost:4000
   ```
4. Disable screen blanking (`raspi-config` → Display Options, or
   `xset s off; xset -dpms` in the autostart script) so the display stays on.

Because the server is reachable over the network, anyone on Wi-Fi can open
`http://<pi-ip>:4000` on their phone to add events, check off chores, or
update the shopping list — it'll show up on the Pi's display within
seconds.

## Data & backups

All data lives in a single SQLite file at `server/data/familyhub.sqlite3`,
alongside saved flyer photos in `server/uploads/`. Both are gitignored, which
means:

- **`git pull` on an existing checkout never touches them.** Git only ever
  updates files it tracks; it cannot see or remove untracked/ignored files,
  so pulling the latest code is always safe for your data.
- **A fresh `git clone` starts empty**, since there's nothing to bring over -
  this is what happens when you set up a new machine, or reinstall. If you
  want data to carry over automatically in that situation, set `DB_PATH` and
  `UPLOADS_DIR` in `server/.env` to a location *outside* the repo folder
  (see `server/.env.example`) - then re-cloning the code next to that folder
  leaves your data untouched no matter what.

Either way, back up `server/data/familyhub.sqlite3` and `server/uploads/`
(or wherever `DB_PATH`/`UPLOADS_DIR` point) the same way you'd back up any
other file on the Pi.

## Known limitations (v1)

- LIFX control and LG ThinQ washer/dryer status are both real (see above);
  Lutron Caseta is still a mockup -
  toggling a Caseta device only updates FamilyHub's own database, not a
  real switch. The base Smart Bridge (non-Pro) has no public local API for
  third-party apps like FamilyHub to call directly, even though it natively
  supports Apple HomeKit - the Bridge PRO is what exposes the LEAP/Telnet
  integration protocol a direct FamilyHub integration would need. Without a
  Bridge PRO, the practical path is running a
  [Home Assistant](https://www.home-assistant.io/) instance with its
  **HomeKit Controller** integration paired to the base Bridge (working
  around the Pro requirement via HomeKit itself), and FamilyHub calling
  Home Assistant's own REST API instead of Lutron directly - one simple,
  well-documented integration point that also covers LIFX (and anything
  else added to Home Assistant later) instead of one bespoke integration
  per brand.
- Google Calendar sync is two-way for one-off events, but recurring
  ("Repeats weekly") events are never pushed to Google - they stay
  FamilyHub-only. The shared iCal feeds are always read-only, by design.
- Family Photos syncs from Google Drive, not Google Photos - Google's Photos
  API no longer allows an app like FamilyHub ongoing read access to a shared
  album (a 2025 change; the only remaining option is an interactive
  one-at-a-time picker UI, not something a background sync can use), so
  Drive is the closest equivalent that still supports it.
- Music requires Spotify Premium - a free account can neither be controlled
  through Spotify's playback API nor used to run librespot as a Connect
  device at all, so there's no reduced/remote-only mode for a free account.
  Making the Pi itself a speaker (rather than just controlling one that's
  already playing elsewhere) also needs librespot installed and configured
  directly on the Pi - something outside FamilyHub's own Settings page,
  covered in the setup section above instead.
- Google Drive is used for two OCR-driven syncs (Family Photos, Meal Plan
  Photos) but there's no Google Docs integration - a one-way append of
  shopping items would be buildable but isn't built yet. No integration with
  Life360 either: it has no public API, and the only integrations that exist
  talk to a reverse-engineered private endpoint using your real login, which
  isn't something this project takes on.
- OCR on flyers is best-effort; always double-check the pre-filled date/time
  before saving.
- No authentication yet — anyone with network access to the app can view and
  edit everything. Fine for a home network; put it behind a VPN or reverse
  proxy with auth if you expose it to the internet. This applies doubly to
  the Software Update button above: anyone who can reach the app can trigger
  a `git pull` + rebuild + restart, so don't expose this app to the internet
  without adding auth in front of it first.
- The database uses Node's built-in `node:sqlite` module, which Node still
  labels "experimental" (you may see a startup warning on some Node
  versions) even though its API is stable enough for this app. This was
  chosen specifically over `better-sqlite3` to avoid native-module compiling
  — which needs a C++ toolchain and fails on newer/less common Node builds
  (this is what broke the first Windows install) and would otherwise need
  to be cross-compiled again for the Raspberry Pi's ARM chip.
