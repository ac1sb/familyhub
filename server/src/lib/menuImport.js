import fetch from 'node-fetch';

// Best-effort scraper for online school-menu sites (Health-e Pro and similar
// platforms). These sites are typically JavaScript apps that hydrate from a
// JSON blob embedded in the initial HTML (Next.js/Nuxt/Redux-style patterns),
// so this looks for those first, then falls back to a generic recursive
// search for anything date-shaped with food items nested inside. It was
// written without being able to reach the target site directly (this
// environment has no outbound internet access), so treat it as a starting
// point: run it for real, and if it finds nothing, the diagnostic fields it
// returns (which script tags existed, an HTML preview) are what's needed to
// fix the matching logic.

const EMBEDDED_JSON_PATTERNS = [
  /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  /<script[^>]*id=["']__NUXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  /window\.__NUXT__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/i,
  /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/i,
  /window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/i,
  /window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/i,
];

const DATE_KEYS = ['date', 'day', 'menuDate', 'serviceDate', 'servingDate', 'menu_date'];
const ITEM_LIST_KEYS = ['items', 'menuItems', 'menu_items', 'foods', 'recipes', 'foodItems', 'food_items'];
const ITEM_NAME_KEYS = ['name', 'title', 'foodName', 'food_name', 'description', 'recipeName'];
const CATEGORY_KEYS = ['category', 'type', 'mealCategory', 'foodCategory', 'categoryName', 'groupName'];
const ENTREE_PATTERN = /entr[ée]e|main\s*dish|^main$/i;

function isPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

function firstDefined(obj, keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return undefined;
}

function normalizeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

// Walk an arbitrary JSON blob looking for objects that look like "a day's
// menu": something with a date-like field and a nested list of food items.
function findMenuDays(node, out, depth = 0) {
  if (depth > 12 || out.length > 400) return;
  if (Array.isArray(node)) {
    for (const child of node) findMenuDays(child, out, depth + 1);
    return;
  }
  if (!isPlainObject(node)) return;

  const dateRaw = firstDefined(node, DATE_KEYS);
  const itemListKey = ITEM_LIST_KEYS.find((k) => Array.isArray(node[k]) && node[k].length > 0);
  if (dateRaw && itemListKey) {
    const date = normalizeDate(dateRaw);
    if (date) {
      const items = node[itemListKey]
        .map((item) => (isPlainObject(item) ? item : { name: String(item) }))
        .map((item) => ({
          name: firstDefined(item, ITEM_NAME_KEYS) || '',
          category: firstDefined(item, CATEGORY_KEYS) || '',
        }))
        .filter((item) => item.name);
      if (items.length > 0) out.push({ date, items });
    }
  }

  for (const value of Object.values(node)) {
    if (isPlainObject(value) || Array.isArray(value)) findMenuDays(value, out, depth + 1);
  }
}

function pickEntree(items) {
  const entreeItems = items.filter((item) => ENTREE_PATTERN.test(item.category));
  const pool = entreeItems.length > 0 ? entreeItems : items.slice(0, 1);
  return pool.map((item) => item.name).join(' / ');
}

export async function fetchMenuItems(url) {
  const resp = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  if (!resp.ok) {
    return { success: false, error: `Menu site responded with ${resp.status}`, htmlPreview: null };
  }
  const html = await resp.text();

  const foundBlobs = [];
  // Some named patterns below (e.g. __NEXT_DATA__) target a script tag that
  // the generic application/json scan would also match; track raw text seen
  // so the same blob is never parsed and counted twice.
  const seenRaw = new Set();
  function collect(raw) {
    if (seenRaw.has(raw)) return;
    seenRaw.add(raw);
    try {
      foundBlobs.push(JSON.parse(raw));
    } catch {
      // not valid JSON on its own (e.g. trailing script content) - skip it
    }
  }

  for (const pattern of EMBEDDED_JSON_PATTERNS) {
    const match = html.match(pattern);
    if (match) collect(match[1]);
  }
  // Also grab any plain `<script type="application/json">` blocks, a common
  // hydration pattern that isn't tied to a specific framework global.
  const genericScriptRe = /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = genericScriptRe.exec(html))) {
    collect(m[1]);
  }

  const days = [];
  for (const blob of foundBlobs) findMenuDays(blob, days);

  if (days.length === 0) {
    return {
      success: false,
      error:
        foundBlobs.length > 0
          ? `Found ${foundBlobs.length} embedded JSON block(s) but none looked like a day's menu (no date+items shape matched).`
          : 'No embedded JSON data found in the page - it may load its menu via a separate API call this scraper does not know about yet.',
      htmlPreview: html.slice(0, 3000),
      scriptBlocksFound: foundBlobs.length,
    };
  }

  const items = days.map((d) => ({ date: d.date, entree: pickEntree(d.items) })).filter((d) => d.entree);

  return { success: true, items, daysFound: days.length };
}
