import { useEffect, useRef, useState } from 'react';
import { api } from '../../api.js';
import { WEEKDAY_SHORT } from '../../lib/week.js';
import Modal from '../Modal.jsx';

function toLocalInputValue(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AddEventModal({ members, defaultMember, defaultDate, existingEvent, onClose, onSaved }) {
  const isEditing = !!existingEvent;
  const [title, setTitle] = useState(existingEvent?.title || '');
  const [location, setLocation] = useState(existingEvent?.location || '');
  const [description, setDescription] = useState(existingEvent?.description || '');
  const [member, setMember] = useState(existingEvent?.member || defaultMember || 'family');
  // defaultDate (e.g. a clicked day on the Month view) keeps that day's date
  // but still defaults to the current time of day, rather than midnight.
  const [start, setStart] = useState(() => {
    if (existingEvent?.start_datetime) return toLocalInputValue(existingEvent.start_datetime);
    if (defaultDate) {
      const now = new Date();
      const d = new Date(defaultDate);
      d.setHours(now.getHours(), now.getMinutes());
      return toLocalInputValue(d);
    }
    return toLocalInputValue(new Date());
  });
  const [recurring, setRecurring] = useState(existingEvent?.recurring || false);
  const [recurrenceDays, setRecurrenceDays] = useState(existingEvent?.recurrence_days || []);
  const [isReminder, setIsReminder] = useState(existingEvent?.is_reminder || false);
  const [photoPath, setPhotoPath] = useState(existingEvent?.photo_path || null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scanWarning, setScanWarning] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const titleInputRef = useRef(null);

  useEffect(() => {
    if (!isEditing) setMember(defaultMember || 'family');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultMember]);

  function toggleDay(idx) {
    setRecurring(true);
    setRecurrenceDays((prev) => (prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx].sort()));
  }

  async function handleFlyerUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setScanError(null);
    setScanWarning(null);
    try {
      const result = await api.scanFlyer(file);
      // The photo is kept no matter what: even when OCR can't read it, or
      // fails outright, the picture itself was already saved server-side and
      // should never be silently dropped from the event being created.
      if (result.photo_path) setPhotoPath(result.photo_path);
      if (result.title) setTitle(result.title);
      if (result.location) setLocation(result.location);
      if (result.start_datetime) setStart(toLocalInputValue(result.start_datetime));
      if (!result.success) setScanError(result.error);
      else if (result.warning) setScanWarning(result.warning);
    } catch (err) {
      setScanError(err.message);
    } finally {
      setScanning(false);
    }
  }

  async function handleSave() {
    if (!title.trim()) {
      // Easy to miss otherwise, especially right after a flyer scan that
      // couldn't read a title automatically - the field is empty, the person
      // taps Add, and nothing visibly happens unless this is impossible to miss.
      setError('Please enter a title');
      titleInputRef.current?.focus();
      titleInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      title: title.trim(),
      description,
      location,
      member,
      start_datetime: new Date(start).toISOString(),
      recurring,
      recurrence_days: recurring ? recurrenceDays : [],
      photo_path: photoPath,
      is_reminder: isReminder,
    };
    try {
      const saved = isEditing ? await api.updateEvent(existingEvent.id, payload) : await api.createEvent(payload);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const confirmMsg = recurring
      ? 'Delete this event? Since it repeats, this removes it for every week, not just this one.'
      : 'Delete this event?';
    if (!window.confirm(confirmMsg)) return;
    setDeleting(true);
    setError(null);
    try {
      await api.deleteEvent(existingEvent.id);
      onSaved?.(null);
      onClose();
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  }

  return (
    <Modal onClose={onClose}>
        <h3 className="modal-title">{isEditing ? 'Edit Calendar Event' : 'Add Calendar Event'}</h3>

        <div className="field">
          <label>Scan a flyer, poster, or paper calendar</label>
          <div className="flyer-dropzone">
            {photoPath && <img className="flyer-preview" src={photoPath} alt="Scanned flyer" />}
            <input type="file" accept="image/*" capture="environment" onChange={handleFlyerUpload} />
            {scanning && <p>Reading photo&hellip; extracting date, time &amp; location.</p>}
            {scanError && <p style={{ color: 'var(--color-danger)' }}>⚠️ {scanError}</p>}
            {!scanError && scanWarning && <p style={{ color: 'var(--color-accent)' }}>ℹ️ {scanWarning}</p>}
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
          <input
            id="ev-title"
            ref={titleInputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={error ? { borderColor: 'var(--color-danger)', borderWidth: 2 } : undefined}
          />
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

        <div className="field">
          <div className="checkbox-row">
            <input
              id="ev-reminder"
              type="checkbox"
              checked={isReminder}
              onChange={(e) => setIsReminder(e.target.checked)}
            />
            <label htmlFor="ev-reminder" style={{ margin: 0 }}>
              🔔 Show as a big reminder banner on the dashboard the day it's due
            </label>
          </div>
        </div>

        {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

        <div className="modal-actions">
          {isEditing && (
            <button className="btn btn-danger" onClick={handleDelete} disabled={deleting || saving} style={{ marginRight: 'auto' }}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || deleting}>
            {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Event'}
          </button>
        </div>
    </Modal>
  );
}
