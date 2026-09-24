// Shared photo-fetching used by both the Screensaver and the dashboard
// background - a themed nature photo, pulled from Wikimedia Commons with a
// no-API-key-needed Picsum fallback if that fails or returns nothing.
export const THEMES = [
  { id: 'landscapes', label: 'Landscapes' },
  { id: 'mountains', label: 'Mountains' },
  { id: 'waterfalls', label: 'Waterfalls' },
  { id: 'lakes', label: 'Lakes' },
  { id: 'forests', label: 'Forests' },
];

// Wikimedia Commons category to pull "Featured pictures" from for each theme,
// with a broader (non-featured) category as a second try before giving up
// and falling back to Picsum, which needs no API call and basically never fails.
const CATEGORY_ATTEMPTS = {
  landscapes: ['Featured pictures of landscapes', 'Landscapes'],
  mountains: ['Featured pictures of mountains', 'Mountains'],
  waterfalls: ['Featured pictures of waterfalls', 'Waterfalls'],
  lakes: ['Featured pictures of lakes', 'Lakes'],
  forests: ['Featured pictures of forests', 'Forests'],
};

function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, '').trim();
}

async function fetchFromCategory(category) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');
  url.searchParams.set('generator', 'categorymembers');
  url.searchParams.set('gcmtitle', `Category:${category}`);
  url.searchParams.set('gcmtype', 'file');
  url.searchParams.set('gcmlimit', '50');
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|extmetadata');
  url.searchParams.set('iiurlwidth', '1920');

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Wikimedia request failed (${resp.status})`);
  const data = await resp.json();
  const pages = Object.values(data.query?.pages || {}).filter((p) => p.imageinfo?.[0]?.thumburl);
  if (pages.length === 0) throw new Error('No images in category');

  const pick = pages[Math.floor(Math.random() * pages.length)];
  const info = pick.imageinfo[0];
  return {
    url: info.thumburl || info.url,
    credit: stripHtml(info.extmetadata?.Artist?.value) || 'Wikimedia Commons',
    license: stripHtml(info.extmetadata?.LicenseShortName?.value),
    source: 'wikimedia',
  };
}

function picsumPhoto() {
  return {
    url: `https://picsum.photos/1920/1080?random=${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    credit: 'Lorem Picsum',
    license: '',
    source: 'picsum',
  };
}

export async function fetchThemedPhoto(theme) {
  const attempts = CATEGORY_ATTEMPTS[theme] || CATEGORY_ATTEMPTS.landscapes;
  for (const category of attempts) {
    try {
      return await fetchFromCategory(category);
    } catch {
      // try the next category, then fall through to Picsum below
    }
  }
  return picsumPhoto();
}
