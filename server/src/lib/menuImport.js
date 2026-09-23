import fetch from 'node-fetch';
import { load } from 'cheerio';

// Best-effort scraper for online school-menu sites (Health-e Pro and similar
// platforms). These sites are typically JavaScript apps that hydrate from a
// JSON blob embedded in the initial HTML (Next.js/Nuxt/Redux-style patterns),
// so this looks for those first. If that finds nothing - e.g. the page loads
// its menu client-side via a separate API call this scraper doesn't know
// about - it falls back to parsing a plain HTML calendar table instead,
// which is the more common shape for a site's "print menu" view (server-
// rendered for printing, so no JS execution needed to see the real content).
// For Health-e Pro specifically, the interactive page never has usable data
// in its own HTML, so any Health-e Pro URL (interactive or print) is instead
// resolved to that site's print-menu view and walked forward a few months
// automatically, so the calendar keeps filling in without the user having
// to update the saved link every month.
//
// Written without being able to reach any real target site directly (this
// environment has no outbound internet access), so treat both parsing
// strategies as a starting point: run it for real, and if it finds nothing,
// the diagnostic fields returned (which script tags existed, an HTML
// preview) are what's needed to fix the matching logic.

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

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const NON_ENTREE_LINE = /^(milk|1% milk|skim milk|chocolate milk|juice|fruit|fresh fruit|vegetable|veggie|side|dessert|condiment|bread|roll|water|salad bar|choice of milk|fruit\/juice)\b/i;

const HEALTHEPRO_BASE_RE = /^(https?:\/\/menus\.healthepro\.com\/organizations\/\d+\/sites\/\d+\/menus\/\d+)(?:\/print-menu)?/i;

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

function findMenuDaysInJson(html) {
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
  return { days, scriptBlocksFound: foundBlobs.length };
}

function extractMonthYearFromUrl(url) {
  try {
    const u = new URL(url);
    const dateParam = u.searchParams.get('date');
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const [y, mo] = dateParam.split('-').map(Number);
      return { year: y, month: mo - 1 };
    }
  } catch {
    // not a valid absolute URL - no month/year hint available this way
  }
  return null;
}

function extractMonthYearFromHtml(html) {
  const pattern = new RegExp(`\\b(${MONTH_NAMES.join('|')})\\s+(\\d{4})\\b`);
  const m = html.match(pattern);
  if (!m) return null;
  return { year: Number(m[2]), month: MONTH_NAMES.indexOf(m[1]) };
}

function pickEntreeFromLines(lines) {
  const cleaned = lines.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (cleaned.length === 0) return '';
  const labeled = cleaned.find((l) => /^entr[ée]e[:\-]?\s*/i.test(l));
  if (labeled) return labeled.replace(/^entr[ée]e[:\-]?\s*/i, '').trim();
  const candidates = cleaned.filter((l) => !NON_ENTREE_LINE.test(l) && !/^\d{1,2}$/.test(l));
  const pool = candidates.length > 0 ? candidates : cleaned;
  return pool[0] || '';
}

// Fallback for pages that render a plain (non-JS-hydrated) calendar table of
// the menu - the common shape for a "print view" of one of these sites.
// Very tolerant on purpose, since the exact markup varies by site: looks for
// any date embedded directly in a day cell first, and only falls back to a
// bare day-number + month/year context (from the URL's `date=` param or a
// "Month YYYY" heading in the page) when no full date is present.
function parseCalendarTable(html, url) {
  const $ = load(html);
  const monthYear = extractMonthYearFromUrl(url) || extractMonthYearFromHtml(html);

  const ISO_DATE_RE = /\b(\d{4})-(\d{2})-(\d{2})\b/;
  const US_DATE_RE = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/;
  const LONG_DATE_RE = new RegExp(`\\b(${MONTH_NAMES.join('|')})\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`);

  const days = [];

  $('td, div[class*="day" i], li[class*="day" i]').each((_, el) => {
    const $el = $(el);
    const dataDate = $el.attr('data-date') || $el.attr('data-day') || $el.attr('data-value') || '';
    const cellText = $el.text();
    let date = null;

    const isoMatch = dataDate.match(ISO_DATE_RE) || cellText.match(ISO_DATE_RE);
    if (isoMatch) date = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

    if (!date) {
      const usMatch = cellText.match(US_DATE_RE);
      if (usMatch) {
        const [, mo, d, y] = usMatch;
        date = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }

    if (!date) {
      const longMatch = cellText.match(LONG_DATE_RE);
      if (longMatch) {
        const monthIndex = MONTH_NAMES.indexOf(longMatch[1]);
        date = `${longMatch[3]}-${String(monthIndex + 1).padStart(2, '0')}-${longMatch[2].padStart(2, '0')}`;
      }
    }

    if (!date && monthYear) {
      const directText = $el.clone().children().remove().end().text().trim();
      const numberCell = $el.find('[class*="number" i], [class*="date" i]').first().text().trim();
      const dayMatch = directText.match(/^\d{1,2}$/) || numberCell.match(/^\d{1,2}$/);
      if (dayMatch) {
        const day = Number(dayMatch[0]);
        if (day >= 1 && day <= 31) {
          date = `${monthYear.year}-${String(monthYear.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
      }
    }

    if (!date) return;

    // Each direct block-level descendant's own text as a separate line, so a
    // cell like "<div>7</div><div>Cheese Pizza</div><div>Milk</div>" yields
    // separate item lines instead of one run-on string.
    const lines = [];
    $el.find('div, li, p, span').each((__, child) => {
      const t = $(child).text().trim();
      if (t) lines.push(t);
    });
    if (lines.length === 0) {
      const t = cellText.trim();
      if (t) lines.push(t);
    }

    const entree = pickEntreeFromLines(lines);
    if (entree && !/^\d{1,2}$/.test(entree)) {
      days.push({ date, items: [{ name: entree, category: '' }] });
    }
  });

  // A cell can get matched at more than one selector level (e.g. a <div
  // class="day"> nested inside a <td>) - keep the first hit per date.
  const byDate = new Map();
  for (const d of days) if (!byDate.has(d.date)) byDate.set(d.date, d);
  return [...byDate.values()];
}

async function fetchHtml(url) {
  // node-fetch has no default timeout, so a slow/unresponsive site (or one
  // that silently drops the connection instead of rejecting it) would hang
  // this request forever - the same mistake already found and fixed for the
  // flyer OCR scan. A hard timeout means "Sync Menu" always finishes with a
  // clear result instead of appearing to do nothing.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!resp.ok) {
      return { error: `Menu site responded with ${resp.status}` };
    }
    return { html: await resp.text() };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { error: 'Timed out reaching the menu site after 20 seconds.' };
    }
    return { error: `Could not reach the menu site: ${err.message}` };
  } finally {
    clearTimeout(timeoutId);
  }
}

// Fetches one URL and tries both parsing strategies against it (JSON first,
// then the plain HTML calendar table). Returns the same shape fetchMenuItems
// does for a single page.
async function fetchAndParseOne(url) {
  const { html, error } = await fetchHtml(url);
  if (error) return { success: false, error, htmlPreview: null };

  const { days: jsonDays, scriptBlocksFound } = findMenuDaysInJson(html);
  let days = jsonDays;
  let usedTableFallback = false;
  if (days.length === 0) {
    days = parseCalendarTable(html, url);
    usedTableFallback = days.length > 0;
  }

  if (days.length === 0) {
    return {
      success: false,
      error:
        scriptBlocksFound > 0
          ? `Found ${scriptBlocksFound} embedded JSON block(s) but none looked like a day's menu (no date+items shape matched), and no plain HTML calendar table was found either.`
          : 'No embedded JSON data and no plain HTML calendar table found on the page - it may load its menu via a separate API call this scraper does not know about yet.',
      htmlPreview: html.slice(0, 3000),
      scriptBlocksFound,
    };
  }

  const items = days.map((d) => ({ date: d.date, entree: pickEntree(d.items) })).filter((d) => d.entree);
  return { success: true, items, daysFound: days.length, usedTableFallback };
}

export async function fetchMenuItems(url) {
  // Health-e Pro's interactive menu page loads its data client-side (nothing
  // useful in the raw HTML), but the same menu has a server-rendered "print"
  // view driven by a `date=` query param, one month at a time. Whenever the
  // configured URL is a Health-e Pro menu link (interactive or print, with
  // any or no date param), always walk a few months of that print view
  // instead of the single URL given - this keeps the calendar filled in as
  // time passes without the user needing to update the saved link every
  // month, and skips wasting a request on the interactive page, which never
  // has usable data in its own HTML.
  const base = url.match(HEALTHEPRO_BASE_RE)?.[1];
  if (!base) return fetchAndParseOne(url);

  const now = new Date();
  const monthAttempts = [0, 1, 2].map((offset) => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });

  const allItems = [];
  const seenDates = new Set();
  let monthsWithData = 0;
  let lastFailure = null;

  for (const monthStart of monthAttempts) {
    const printUrl = `${base}/print-menu?date=${monthStart}`;
    const result = await fetchAndParseOne(printUrl);
    if (result.success) {
      monthsWithData += 1;
      for (const item of result.items) {
        if (!seenDates.has(item.date)) {
          seenDates.add(item.date);
          allItems.push(item);
        }
      }
    } else {
      lastFailure = result;
    }
  }

  if (allItems.length === 0) {
    const fallback = lastFailure || {
      success: false,
      error: `Reached the print-menu page for each of the next ${monthAttempts.length} months, but found no day with a usable entree.`,
      htmlPreview: null,
    };
    return {
      ...fallback,
      error: lastFailure
        ? `${fallback.error} (also tried this site's print-menu view for the next ${monthAttempts.length} months with the same result.)`
        : fallback.error,
    };
  }

  return { success: true, items: allItems, daysFound: allItems.length, monthsSynced: monthsWithData };
}
