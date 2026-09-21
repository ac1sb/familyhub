import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { WEEKDAY_SHORT } from '../../lib/week.js';

function toLocalInputValue(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AddEventModal({ members, defaultMember, onClose, onSaved }) {
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [member, setMember] = useState(defaultMember || 'family');
  const [start, setStart] = useState(toLocalInputValue(new Date()));
  const [recurring, setRecurring] = useState(false);
  const [recurrenceDays, setRecurrenceDays] = useState([]);
  const [photoPath, setPhotoPath] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => setMember(defaultMember || 'family'), [defaultMember]);

  function toggleDay(idx) {
    setRecurring(true);
    setRecurrenceDays((prev) => (prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx].sort()));
  }

  async function handleFlyerUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setScanError(null);
    try {
      const result = await api.scanFlyer(file);
      if (result.title) setTitle(result.title);
      if (result.location) setLocation(result.location);
      if (result.start_datetime) setStart(toLocalInputValue(result.start_datetime));
      setPhotoPath(result.photo_path);
    } catch (err) {
      setScanError(err.message);
    } finally {
      setScanning(false);
    }
  }

  async function handleSave() {
    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.createEvent({
        title: title.trim(),
        description,
        location,
        member,
        start_datetime: new Date(start).toISOString(),
        recurring,
        recurrence_days: recurring ? recurrenceDays : [],
        photo_path: photoPath,
      });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Add Calendar Event</h3>

        <div className="field">
          <label>Scan a flyer, poster, or paper calendar</label>
          <div className="flyer-dropzone">
            {photoPath && <img className="flyer-preview" src={photoPath} alt="Scanned flyer" />}
            <input type="file" accept="image/*" capture="environment" onChange={handleFlyerUpload} />
            {scanning && <p>Reading photo&hellip; extracting date, time &amp; location.</p>}
            {scanError && <p style={{ color: 'var(--color-danger)' }}>{scanError}</p>}
            {!scanning && !photoPath && <p>Take a picture and we'll fill in the details below for you to check.</p>}
          </div>
        </div>

        <div className="field">
          <label>Who is this for?</label>
          <div className="member-choice-row">
            {Object.entries(members).map(([key, name]) => (
              <button
                key={key}
                type="button"
                className={`member-choice ${key}${member === key ? ' selected' : ''}`}
                onClick={() => setMember(key)}
              >
                {name}
              </button>
            ))}
            <button
              type="button"
              className={`member-choice family${member === 'family' ? ' selected' : ''}`}
              onClick={() => setMember('family')}
            >
              Whole Family
            </button>
          </div>
        </div>

        <div className="field">
          <label htmlFor="ev-title">Title</label>
          <input id="ev-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="ev-start">Date &amp; time</label>
          <input id="ev-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="ev-loc">Location</label>
          <input id="ev-loc" type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="ev-desc">Notes</label>
          <textarea id="ev-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="field">
          <div className="checkbox-row">
            <input
              id="ev-recurring"
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
            />
            <label htmlFor="ev-recurring" style={{ margin: 0 }}>
              Repeats weekly (multiple times a week, or the same day every week)
            </label>
          </div>
          {recurring && (
            <div className="weekday-chips" style={{ marginTop: 10 }}>
              {WEEKDAY_SHORT.map((label, idx) => (
                <button
                  key={label}
                  type="button"
                  className={`weekday-chip${recurrenceDays.includes(idx) ? ' selected' : ''}`}
                  onClick={() => toggleDay(idx)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Add Event'}
          </button>
        </div>
      </div>
    </div>
  );
}
