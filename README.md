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
  completed-count next to their name plus up to 4 items - tapping one shows
  a green checkmark right there instead of yanking it out of view. It only
  rolls off (making room for the next open item) once there's an open item
  waiting that isn't already shown, so with 4 or fewer items nothing ever
  disappears, it just accumulates checkmarks. Shopping List is different by
  design: there's no checkbox, tapping an item crosses it off as purchased
  and it disappears from the dashboard glance immediately (nothing left to
  buy, nothing to show), leaving a tally of what's still needed plus a
  quick-add box (typing a name and hitting Add/Enter drops it straight onto
  the list). The full list ("See all") still shows purchased items -
  struck through, dated ("Got it Sep 24"), and sorted to the bottom - until
  the ✕ removes one for good. Chores and Daily Checklist can each
  independently pick one of three widget styles in Settings → Dashboard
  Widgets (e.g. Chores as Squares, Daily Checklist as a Carousel) - **List**
  (the classic stacked full-width bars), **Squares** (always exactly 2
  tiles side by side, however the widget is resized - the tiles stretch to
  fill whatever width/height that gives them rather than shrinking to fit
  more per row; each tile leads with a large icon taking up most of the
  tile instead of being text-only - guessed from the task's title against a
  ~130-icon library (`client/src/lib/taskIcons.js`) organized into 14
  categories (Personal Care, School, Pets, Kitchen, Cleaning, and so on;
  anything unrecognized falls back to a plain notepad icon), or picked by
  hand per recurring chore/daily item in Settings → Chore Setup / Daily
  Checklist Setup - tap the icon next to its name to browse the same
  categorized library and override the guess (or pick "Auto-guess from
  name" to go back to it). A long title clamps to 2 lines with an ellipsis
  instead of overflowing the tile, full text via hover or "See all"), or
  **Carousel**
  (one big tile at a time -
  swipe it left/right, use the arrow buttons, or tap a dot to jump to a
  specific item). Tapping a tile/bar itself always marks it done, in any
  style - these are just different skins on the same list, not separate
  features, so switching back and forth never loses anything. Every widget
  can be dragged and resized to your own layout, which is saved per-device
  (in the browser) and survives `git pull`/rebuilds. Pick which widgets
  appear at all — and give any of them their own background color,
  overriding the normal day/night theme for just that one — in Settings →
  Dashboard Widgets (also per-device, so a phone can show fewer than the
  wall display, or its own color scheme, or a different widget style); a
  widget that's undersized for its own content grows itself to fit
  automatically (Carousel-mode widgets are exempt from this, since a
  carousel tile is designed to fill whatever height it's given rather than
  ever needing more room).
- **Built-in calendar** with an **agenda view**: three tappable columns for
  the household members (Mom / Dad / Child by default — rename in Settings).
  Tapping a member's name opens **Add Event**, preselected for that person.
  Tapping an existing event opens its full details (including its saved
  flyer photo, if it has one), with Edit and Delete right there. The full
  page shows more than the default 7 days when there's room for it - it
  measures the window and grows to fill the available height (up to 21 days)
  instead of leaving blank space below a fixed week on a tall screen.
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
  Mon/Wed/Thu) shows as a single row with one badge per expected day - tap a
  day's badge to mark it done, and it gets its own checkmark too.
- **Weekly dinner menu** — a row of day boxes (day tab on top, meal name
  below), with today's day tab highlighted so it stands out from the rest
  of the week. The day tabs are fixed - drag a meal box by its ⠿ handle
  onto a different day to swap the two, and only the meal box itself
  visibly moves; the day tabs never do. The boxes reflow into a grid and
  resize themselves to fill however you resize the widget.
- **Lunch calendar** for one child — a full monthly view (tap a day to toggle
  School/Pack-from-home, mark no-school days, jot the menu item), plus a
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
- **Smart Home (mockup)** — a Lutron Caseta / LIFX control widget: add your
  switches and bulbs once in Settings → Smart Home Setup (name, room, and
  LIFX vs. Caseta dimmer/switch), then toggle them, drag brightness, and
  pick a LIFX bulb's color from the dashboard or the full page (grouped by
  room). A quick-access strip of the same devices sits in the header on
  every page — tap one to flip it on/off, or press and hold a
  dimmable one to pull up a brightness slider. Four example devices (Dining
  Room, Living Room, Lamp, Kitchen Counter) are seeded in on first run.
  This is currently a prototype of the control UI and data model - nothing
  is sent to a real bulb or bridge yet; see "Known limitations" below for
  what a real integration would need.
- **Weather** — a row of quick-glance chips in the header on every page,
  opposite the smart-home toggles with a prominent date/time between them
  (current temp, high/low, precipitation chance, a
  morning/afternoon/evening timeline, and a clothing hint), a "Today" card
  on the dashboard, and a full 7-day forecast on its own sidebar tab.
  Geocoded from a US zip code via Open-Meteo (no API key required).
- **Day/night theme** — switches automatically on a schedule you set in
  Settings → Appearance (or pin it to always-light/always-dark).
- **Screensaver** — per-device (Settings → Screensaver): idle timeout, photo
  interval, and theme (landscapes/mountains/waterfalls/lakes/forests), with
  a clock/date/weather overlay and a Preview button. Off by default on every
  device; turn it on for the wall display only. Optionally overlays the
  shared whiteboard in a corner - the same live drawing as everywhere else,
  sized to actually be readable from across the room (scales with the
  screen, well up from a small thumbnail, without growing large enough to
  reach the centered clock) rather than a small tan sticky-note prop, so a
  message left on the board is still visible while the screensaver's up.
  Also optionally shows a daily
  briefing card listing today's calendar events, which starts appearing at
  5am (so it reads as "here's your day" rather than showing up overnight).
  Both overlays periodically relocate to a different corner of the screen
  to avoid burn-in on a display that's on all day.
- **Editable Settings** — rename household members, change the weather zip,
  and set the day/night schedule, all from the app (no `.env` editing or
  restart required after first setup).
- **Left sidebar navigation** — one button per widget for a large, focused
  view of just that widget.
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
General -> "Shared calendar feeds." No Google Cloud project, no sign-in, no
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
calendar" settings page as above) into Settings -> General -> "Google
Calendar to sync events to".

If you connected Google Calendar before this two-way sync existed, that
connection only has read access - disconnect and reconnect once from
Settings to approve the write permission.

Same as the iCal feed above, synced Google events default to "Family" (every
column) - the "Show its events under" dropdown next to the Calendar ID field
pins them to one member's column instead, for when the connected calendar is
really just that person's own schedule.

## Flyer / poster photo scanning

The Add Event modal has a "Scan a flyer" file/camera input. On a touchscreen
or phone this opens the camera directly; on a desktop it's a normal file
picker. The server runs OCR (`tesseract.js`) on the photo, tries to extract a
title, date/time, and location, and pre-fills the form — always editable
before you save. The original photo is stored under `server/uploads/` and
its path is saved on the event.

Note: the first OCR run downloads the English trained-data file, so the Pi
needs internet access at least once.

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

- The Smart Home widget is a mockup: toggling a device, dragging brightness,
  or picking a color only updates FamilyHub's own database, not a real bulb
  or switch. A real integration would add: for LIFX, calls to the
  [LIFX Cloud API](https://api.developer.lifx.com/) (needs a personal access
  token) or its LAN protocol; for Lutron Caseta, the Smart Bridge has no
  public local API, so the usual path is a
  [Home Assistant](https://www.home-assistant.io/) instance with the Caseta
  integration, with FamilyHub calling *that* instead of the bridge directly.
- Google Calendar sync is two-way for one-off events, but recurring
  ("Repeats weekly") events are never pushed to Google - they stay
  FamilyHub-only. The shared iCal feeds are always read-only, by design.
- No integration with Google Drive/Docs or Life360. Drive/Docs would be
  buildable (Drive: reuse the flyer OCR pipeline against a shared folder;
  Docs: one-way append of shopping items) but aren't built yet. Life360 has
  no public API - the only integrations that exist talk to a
  reverse-engineered private endpoint using your real login, which isn't
  something this project takes on.
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
