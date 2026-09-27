import { useEffect, useState } from 'react';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';

export default function FamilyPhotosSetup() {
  const { data, refresh } = usePolling(() => api.familyPhotos(), [], 30000);
  const [albums, setAlbums] = useState(['']);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  useEffect(() => {
    api.familyPhotoSettings().then((r) => {
      setAlbums(r.albums?.length ? r.albums : ['']);
    }).catch(() => {});
  }, []);

  function updateAlbum(index, value) {
    setAlbums((prev) => prev.map((a, i) => (i === index ? value : a)));
  }

  function addAlbumRow() {
    setAlbums((prev) => [...prev, '']);
  }

  function removeAlbumRow(index) {
    setAlbums((prev) => {
      const next = prev.filter((_, i) => i !== index);
      // Keep at least one (blank) row so there's always something to type into.
      return next.length ? next : [''];
    });
  }

  async function handleSave() {
    setSaving(true);
    setSaveMessage(null);
    try {
      const r = await api.saveFamilyPhotoAlbums(albums);
      setAlbums(r.albums.length ? r.albums : ['']);
      setSaveMessage('Saved!');
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await api.syncFamilyPhotos();
      setSyncResult(result);
      refresh();
    } catch (err) {
      setSyncResult({ success: false, error: err.message });
    } finally {
      setSyncing(false);
    }
  }

  async function handleRemove(id) {
    await api.deleteFamilyPhoto(id);
    refresh();
  }

  const photos = data?.photos || [];
  const hasSavedAlbum = albums.some((a) => a.trim());
  const failedAlbums = (syncResult?.albums || []).filter((a) => !a.success);
  const allAlbumsFailed = syncResult?.albums?.length > 0 && failedAlbums.length === syncResult.albums.length;

  return (
    <div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: 0 }}>
        Pulls photos in from one or more public iCloud Shared Albums - nobody has to upload
        anything to FamilyHub, just add photos to a shared album from any iPhone (Photos app -&gt;
        the album -&gt; the usual share sheet) like normal. Add one album per family member (or
        however you split it up) and they all mix into the same rotation. In Photos: create or open
        a Shared Album, go to its settings, turn on "Public Website", and copy that link here. Uses
        Apple's own public link, not a login, so nothing needs anyone's Apple ID or password.
      </p>

      <div className="field">
        <label>Shared Album links</label>
        {albums.map((album, i) => (
          <div className="ical-feed-row" key={i}>
            <input
              type="text"
              placeholder="https://www.icloud.com/sharedalbum/#..."
              value={album}
              onChange={(e) => updateAlbum(i, e.target.value)}
            />
            <button
              type="button"
              className="btn-icon"
              title="Remove this album"
              onClick={() => removeAlbumRow(i)}
              disabled={albums.length === 1 && !album}
            >
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="btn-link" onClick={addAlbumRow} style={{ marginTop: 4 }}>
          + Add another album
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saveMessage && <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{saveMessage}</span>}
      </div>

      {hasSavedAlbum && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
          <button className="btn btn-secondary" onClick={handleSync} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
            Also syncs automatically every hour (FAMILY_PHOTO_SYNC_MINUTES in .env changes how often).
          </span>
        </div>
      )}
      {syncResult && (
        <div style={{ marginTop: 6 }}>
          <p style={{ color: syncResult.success && !allAlbumsFailed ? 'var(--color-primary)' : 'var(--color-danger)', fontSize: '0.85rem', margin: 0 }}>
            {!syncResult.success
              ? `⚠️ ${syncResult.error}`
              : allAlbumsFailed
              ? `⚠️ Couldn't reach ${syncResult.albums.length === 1 ? 'that album' : 'any album'} - see details below.`
              : syncResult.added > 0
              ? `Added ${syncResult.added} new photo${syncResult.added === 1 ? '' : 's'} across ${syncResult.albums.length} album${syncResult.albums.length === 1 ? '' : 's'}.`
              : 'Already up to date - nothing new in any album.'}
          </p>
          {failedAlbums.map((a) => (
            <p key={a.albumUrl} style={{ color: 'var(--color-danger)', fontSize: '0.8rem', margin: '2px 0 0' }}>
              ⚠️ {a.albumUrl}: {a.error}
            </p>
          ))}
        </div>
      )}

      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
        Turn on "Show family photos" in Settings &rarr; Screensaver to cycle through these as a
        corner overlay (same idea as the whiteboard sticky note), not as the background. Removing a
        photo here only affects FamilyHub's own copy - it stays in the actual shared album for
        everyone else.
      </p>

      {photos.length > 0 && (
        <div className="family-photos-grid">
          {photos.map((photo) => (
            <div className="family-photo-tile" key={photo.id}>
              <img src={photo.url} alt={photo.caption || 'Family photo'} loading="lazy" />
              <button className="family-photo-remove" onClick={() => handleRemove(photo.id)} title="Remove">✕</button>
              {photo.albumLabel && <span className="family-photo-tile-label">{photo.albumLabel}</span>}
            </div>
          ))}
        </div>
      )}
      {data && photos.length === 0 && (
        <p style={{ color: 'var(--color-text-muted)' }}>No photos synced yet.</p>
      )}
    </div>
  );
}
