import fs from 'node:fs';

// Some school menu sites (Health-e Pro among them) are pure client-rendered
// single-page apps: the server sends back an empty `<div id="app"></div>`
// shell, and the actual menu is fetched by the browser's own JavaScript after
// load, via an XHR/fetch call to some other endpoint. A plain HTTP fetch (see
// fetchHtml in menuImport.js) can never see that data - there's nothing in
// the raw response but the empty shell. The only way to see what a real
// visitor sees is to actually run the page's JavaScript, which means a real
// (headless) browser.
//
// Rather than bundling Playwright's own ~300MB Chromium download (heavy for
// a Raspberry Pi), this drives whatever Chromium/Chrome is already on the
// machine - the same browser already required for FamilyHub's own kiosk
// display works fine. Set CHROMIUM_PATH in server/.env if it isn't found
// automatically.
const CANDIDATE_PATHS = [
  process.env.CHROMIUM_PATH,
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/snap/bin/chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].filter(Boolean);

export function findChromiumPath() {
  for (const p of CANDIDATE_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

let chromiumModulePromise = null;
function loadChromium() {
  if (!chromiumModulePromise) {
    chromiumModulePromise = import('playwright-core')
      .then((mod) => mod.chromium)
      .catch(() => null);
  }
  return chromiumModulePromise;
}

// Renders each URL in turn with one shared headless browser instance (much
// cheaper than launching a fresh browser per page, which matters when a
// caller needs to walk several months of a print-menu view in one sync).
// For each URL, returns the fully-rendered HTML plus every JSON response
// the page loaded while rendering - the site's own data, straight from the
// same API call a real browser would have made.
export async function renderPages(urls, { timeoutMs = 25000 } = {}) {
  const chromium = await loadChromium();
  if (!chromium) {
    return {
      error:
        'playwright-core is not installed on the server - run "npm install" in the server folder to enable rendering JavaScript-driven menu sites.',
    };
  }
  const executablePath = findChromiumPath();
  if (!executablePath) {
    return {
      error:
        'No Chromium/Chrome browser found on this machine to render the page with. Set CHROMIUM_PATH in server/.env to a Chrome/Chromium executable - the same one used for kiosk mode works fine.',
    };
  }

  let browser;
  const results = [];
  try {
    browser = await chromium.launch({ executablePath, headless: true });
    for (const url of urls) {
      const page = await browser.newPage();
      const jsonBlobs = [];
      page.on('response', async (response) => {
        const contentType = response.headers()['content-type'] || '';
        if (!contentType.includes('application/json')) return;
        try {
          jsonBlobs.push(await response.json());
        } catch {
          // response claimed JSON but didn't parse as any - ignore it
        }
      });

      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });
        const html = await page.content();
        results.push({ url, html, jsonBlobs });
      } catch (err) {
        results.push({ url, error: err.message });
      } finally {
        await page.close();
      }
    }
  } catch (err) {
    return { error: `Could not start the headless browser: ${err.message}` };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  return { results };
}
