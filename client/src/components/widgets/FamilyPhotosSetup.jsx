import { useEffect, useState } from 'react';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';

export default function FamilyPhotosSetup() {
  const { data, refresh } = usePolling(() => api.familyPhotos(), [], 30000);
  const [folders, setFolders] = useState(['']);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  useEffect(() => {
    api.familyPhotoSettings().then((r) => {
      setFolders(r.folders?.length ? r.folders : ['']);
    }).catch(() => {});
  }, []);

  function updateFolder(index, value) {
    setFolders((prev) => prev.map((f, i) => (i === index ? value : f)));
  }

  function addFolderRow() {
    setFolders((prev) => [...prev, '']);
  }

  function removeFolderRow(index) {
    setFolders((prev) => {
      const next = prev.filter((_, i) => i !== index);
      // Keep at least one (blank) row so there's always something to type into.
      return next.length ? next : [''];
    });
  }

  async function handleSave() {
    setSaving(true);
    setSaveMessage(null);
    try {
      const r = await api.saveFamilyPhotoFolders(folders);
      setFolders(r.folders.length ? r.folders : ['']);
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
  const hasSavedFolder = folders.some((f) => f.trim());
  const failedFolders = (syncResult?.folders || []).filter((f) => !f.success);
  const allFoldersFailed = syncResult?.folders?.length > 0 && failedFolders.length === syncResult.folders.length;

  return (
    <div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: 0 }}>
        Pulls photos in from one or more shared Google Drive folders - nobody has to upload
        anything to FamilyHub itself, just add photos to a shared folder from any iPhone (Photos
        app &rarr; the share icon &rarr; <strong>Save to Drive</strong> &rarr; pick the folder) like
        normal. Add one folder per family member (or however you split it up) and they all mix into
        the same rotation. Requires the Google account connected in Settings &rarr; Calendar - if it
        was connected before this feature was added, disconnect and reconnect once to approve the
        added Drive permission.
      </p>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: 0 }}>
        Set up a folder once: create a folder in Google Drive, share it (⋮ &rarr; Share) with
        whoever should add photos, and make sure the connected Google account (above) has at least
        viewer access to it too. Paste the folder's URL below (the address bar when it's open in
        Drive) or just its ID.
      </p>

      <div className="field">
        <label>Google Drive folders</label>
        {folders.map((folder, i) => (
          <div className="ical-feed-row" key={i}>
            <input
              type="text"
              placeholder="https://drive.google.com/drive/folders/..."
              value={folder}
              onChange={(e) => updateFolder(i, e.target.value)}
            />
            <button
              type="button"
              className="btn-icon"
              title="Remove this folder"
              onClick={() => removeFolderRow(i)}
              disabled={folders.length === 1 && !folder}
            >
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="btn-link" onClick={addFolderRow} style={{ marginTop: 4 }}>
          + Add another folder
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saveMessage && <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{saveMessage}</span>}
      </div>

      {hasSavedFolder && (
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
          <p style={{ color: syncResult.success && !allFoldersFailed ? 'var(--color-primary)' : 'var(--color-danger)', fontSize: '0.85rem', margin: 0 }}>
            {!syncResult.success
              ? `⚠️ ${syncResult.error}`
              : allFoldersFailed
              ? `⚠️ Couldn't reach ${syncResult.folders.length === 1 ? 'that folder' : 'any folder'} - see details below.`
              : syncResult.added > 0
              ? `Added ${syncResult.added} new photo${syncResult.added === 1 ? '' : 's'} across ${syncResult.folders.length} folder${syncResult.folders.length === 1 ? '' : 's'}.`
              : 'Already up to date - nothing new in any folder.'}
          </p>
          {failedFolders.map((f) => (
            <p key={f.folderId} style={{ color: 'var(--color-danger)', fontSize: '0.8rem', margin: '2px 0 0' }}>
              ⚠️ {f.folderId}: {f.error}
            </p>
          ))}
        </div>
      )}

      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
        Turn on "Show family photos" in Settings &rarr; Screensaver to cycle through these as a
        corner overlay (same idea as the whiteboard sticky note), not as the background. Removing a
        photo here only affects FamilyHub's own copy - it stays in the actual Drive folder for
        everyone else. Note: HEIC photos (the default format on newer iPhones) may not preview in
        every browser - if a synced photo doesn't show up, try switching your iPhone's Camera format
        to "Most Compatible" (Settings → Camera → Formats) for new photos, or save as JPEG before
        adding older ones.
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
