// Reads a public iCloud Shared Album (the link from Photos -> an album's
// Shared Album settings -> "Public Website" toggle) via Apple's undocumented
// (but long-stable, and used by several open-source tools) shared-streams
// API - there's no official API for this, so this is reverse-engineered and
// could break if Apple changes the format. No login/token of any kind is
// needed since a public shared album is, by design, viewable by anyone with
// the link.
const DEFAULT_HOST = 'p23-sharedstreams.icloud.com';

// Accepts the full link Photos gives you (either the classic
// icloud.com/sharedalbum/#TOKEN form or a bare token) and pulls out just the
// token the API calls key off of.
export function extractAlbumToken(input) {
  const trimmed = (input || '').trim();
  const hashIndex = trimmed.lastIndexOf('#');
  const afterHash = hashIndex >= 0 ? trimmed.slice(hashIndex + 1) : trimmed;
  const afterSlash = afterHash.includes('/') ? afterHash.slice(afterHash.lastIndexOf('/') + 1) : afterHash;
  return afterSlash.trim();
}

async function postJSON(host, token, path, body) {
  const resp = await fetch(`https://${host}/${token}/sharedstreams/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`iCloud didn't return JSON (HTTP ${resp.status}) - the album link may no longer be public`);
  }
  return data;
}

// Apple splits shared albums across several "partition" servers - the
// default one hands back a redirect host instead of data when the album
// actually lives elsewhere, so this follows that redirect once.
async function webstream(token) {
  let data = await postJSON(DEFAULT_HOST, token, 'webstream', { streamCtag: null });
  const redirectHost = data['X-Apple-MMe-Host'];
  if (redirectHost && redirectHost !== DEFAULT_HOST) {
    data = await postJSON(redirectHost, token, 'webstream', { streamCtag: null });
    return { data, host: redirectHost };
  }
  return { data, host: DEFAULT_HOST };
}

function largestDerivative(derivatives) {
  const entries = Object.values(derivatives || {});
  if (entries.length === 0) return null;
  return entries.reduce((best, d) => (Number(d.width) > Number(best.width) ? d : best));
}

// Returns { streamName, photos } for the album - streamName is the album's
// own title (so callers can label where a photo came from without the
// person having to type a name for it themselves), and each photo is
// { guid, checksum, width, height, caption, takenAt, url } - takenAt is
// whichever of dateCreated/batchDateCreated iCloud actually sent (its shape
// has varied across accounts), and may be null.
export async function listSharedAlbumPhotos(albumUrlOrToken) {
  const token = extractAlbumToken(albumUrlOrToken);
  if (!token) throw new Error('That doesn\'t look like an iCloud Shared Album link');

  const { data, host } = await webstream(token);
  const photos = data.photos;
  if (!Array.isArray(photos)) {
    throw new Error('iCloud didn\'t return a photo list - check the album is still shared publicly');
  }

  const chosen = photos
    .map((p) => {
      const derivative = largestDerivative(p.derivatives);
      if (!derivative) return null;
      return {
        guid: p.photoGuid,
        checksum: derivative.checksum,
        width: Number(derivative.width) || null,
        height: Number(derivative.height) || null,
        caption: p.caption || null,
        takenAt: p.dateCreated || p.batchDateCreated || null,
      };
    })
    .filter(Boolean);

  if (chosen.length === 0) return { streamName: data.streamName || null, photos: [] };

  const assetData = await postJSON(host, token, 'webasseturls', {
    photoGuids: chosen.map((p) => p.guid),
  });
  const items = assetData.items || {};

  const withUrls = chosen
    .map((p) => {
      const asset = items[p.checksum];
      if (!asset) return null;
      return { ...p, url: `https://${asset.url_location}${asset.url_path}` };
    })
    .filter(Boolean);

  return { streamName: data.streamName || null, photos: withUrls };
}
