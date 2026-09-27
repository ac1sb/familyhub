import { useEffect, useState } from 'react';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';

export default function FamilyPhotosSetup() {
  const { data, refresh } = usePolling(() => api.familyPhotos(), [], 30000);
  const [albumUrl, setAlbumUrl] = useState('');
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  useEffect(() => {
    api.familyPhotoSettings().then((r) => {
      setAlbumUrl(r.albumUrl || '');
      setSaved(r.albumUrl || '');
    }).catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const r = await api.saveFamilyPhotoAlbumUrl(albumUrl.trim());
      setAlbumUrl(r.albumUrl);
      setSaved(r.albumUrl);
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

  return (
    <div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: 0 }}>
        Pulls photos in from a public iCloud Shared Album - nobody has to upload anything to
        FamilyHub, just add photos to the shared album from any iPhone (Photos app -&gt; the album
        -&gt; the usual share sheet) like normal. In Photos: create or open a Shared Album, go to its
        settings, turn on "Public Website", and copy that link here. Uses Apple's own public link,
        not a login, so nothing needs anyone's Apple ID or password.
      </p>

      <div className="field">
        <label htmlFor="family-photo-album-url">Shared Album link</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            id="family-photo-album-url"
            type="text"
            placeholder="https://www.icloud.com/sharedalbum/#..."
            value={albumUrl}
            onChange={(e) => setAlbumUrl(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="btn btn-secondary" onClick={handleSave} disabled={saving || albumUrl.trim() === saved}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {saved && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <button className="btn btn-secondary" onClick={handleSync} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
            Also syncs automatically every hour (FAMILY_PHOTO_SYNC_MINUTES in .env changes how often).
          </span>
        </div>
      )}
      {syncResult && (
        <p style={{ color: syncResult.success ? 'var(--color-primary)' : 'var(--color-danger)', fontSize: '0.85rem' }}>
          {syncResult.success
            ? (syncResult.added > 0 ? `Added ${syncResult.added} new photo${syncResult.added === 1 ? '' : 's'}.` : 'Already up to date - nothing new in the album.')
            : `⚠️ ${syncResult.error}`}
        </p>
      )}

      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
        Pick "Family Photos" as the theme in Screensaver settings (or the dashboard background) to
        cycle through these. Removing a photo here only affects FamilyHub's own copy - it stays in
        the actual shared album for everyone else.
      </p>

      {photos.length > 0 && (
        <div className="family-photos-grid">
          {photos.map((photo) => (
            <div className="family-photo-tile" key={photo.id}>
              <img src={photo.url} alt={photo.caption || 'Family photo'} loading="lazy" />
              <button className="family-photo-remove" onClick={() => handleRemove(photo.id)} title="Remove">✕</button>
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
