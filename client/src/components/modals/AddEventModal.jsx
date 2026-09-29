import { useEffect, useRef, useState } from 'react';
import { api } from '../../api.js';
import { WEEKDAY_SHORT } from '../../lib/week.js';
import Modal from '../Modal.jsx';

function toLocalInputValue(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ordinal(n) {
  if (n % 10 === 1 && n % 100 !== 11) return `${n}st`;
  if (n % 10 === 2 && n % 100 !== 12) return `${n}nd`;
  if (n % 10 === 3 && n % 100 !== 13) return `${n}rd`;
  return `${n}th`;
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
  const [end, setEnd] = useState(() => (existingEvent?.end_datetime ? toLocalInputValue(existingEvent.end_datetime) : ''));
  const [recurring, setRecurring] = useState(existingEvent?.recurring || false);
  const [recurrenceDays, setRecurrenceDays] = useState(existingEvent?.recurrence_days || []);
  const [recurrenceType, setRecurrenceType] = useState(existingEvent?.recurrence_type || 'weekly');
  const [recurrenceInterval, setRecurrenceInterval] = useState(existingEvent?.recurrence_interval || 1);
  const [isReminder, setIsReminder] = useState(existingEvent?.is_reminder || false);
  const [photoPath, setPhotoPath] = useState(existingEvent?.photo_path || null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scanWarning, setScanWarning] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [copyDate, setCopyDate] = useState('');
  const [copying, setCopying] = useState(false);
  const [copyMessage, setCopyMessage] = useState(null);
  const titleInputRef = useRef(null);

  // Drives the single "repeats" dropdown from the three underlying fields the
  // server actually stores, so "every other week" and "monthly" are just two
  // more options next to the original weekly one instead of separate controls.
  const recurrencePattern = !recurring ? 'none' : recurrenceType === 'monthly' ? 'monthly' : recurrenceInterval >= 2 ? 'biweekly' : 'weekly';

  function handlePatternChange(value) {
    if (value === 'none') {
      setRecurring(false);
      return;
    }
    setRecurring(true);
    if (value === 'monthly') {
      setRecurrenceType('monthly');
      setRecurrenceInterval(1);
    } else if (value === 'biweekly') {
      setRecurrenceType('weekly');
      setRecurrenceInterval(2);
    } else {
      setRecurrenceType('weekly');
      setRecurrenceInterval(1);
    }
  }

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
    if (end && new Date(end) <= new Date(start)) {
      setError('End time must be after the start time');
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
      end_datetime: end ? new Date(end).toISOString() : null,
      recurring,
      recurrence_days: recurring && recurrenceType === 'weekly' ? recurrenceDays : [],
      recurrence_type: recurrenceType,
      recurrence_interval: recurrenceInterval,
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

  async function handleCopy() {
    if (!copyDate) return;
    setCopying(true);
    setError(null);
    setCopyMessage(null);
    try {
      const origStart = new Date(start);
      const [year, month, day] = copyDate.split('-').map(Number);
      const newStart = new Date(origStart);
      newStart.setFullYear(year, month - 1, day);
      let newEndIso = null;
      if (end) {
        const durationMs = new Date(end) - origStart;
        newEndIso = new Date(newStart.getTime() + durationMs).toISOString();
      }
      await api.createEvent({
        title: title.trim() || 'Untitled event',
        description,
        location,
        member,
        start_datetime: newStart.toISOString(),
        end_datetime: newEndIso,
        recurring: false,
        recurrence_days: [],
        recurrence_type: 'weekly',
        recurrence_interval: 1,
        photo_path: photoPath,
        is_reminder: isReminder,
      });
      setCopyMessage(`Copied to ${copyDate}.`);
      setCopyDate('');
    } catch (err) {
      setError(err.message);
    } finally {
      setCopying(false);
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
          <label htmlFor="ev-start">Starts</label>
          <input id="ev-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="ev-end">Ends (optional)</label>
          <input id="ev-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} min={start} />
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
          <label htmlFor="ev-repeats">Repeats</label>
          <select id="ev-repeats" value={recurrencePattern} onChange={(e) => handlePatternChange(e.target.value)}>
            <option value="none">Does not repeat</option>
            <option value="weekly">Weekly (pick one or more days below)</option>
            <option value="biweekly">Every other week</option>
            <option value="monthly">Monthly, same date</option>
          </select>
          {recurring && recurrenceType === 'weekly' && (
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
          {recurring && recurrenceType === 'monthly' && (
            <p style={{ marginTop: 10, marginBottom: 0, color: 'var(--color-text-muted)' }}>
              Repeats on the {ordinal(new Date(start).getDate())} of every month.
            </p>
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

        {isEditing && (
          <div className="field">
            <label htmlFor="ev-copy-date">Copy this event to another day</label>
            <div className="checkbox-row" style={{ gap: 8 }}>
              <input
                id="ev-copy-date"
                type="date"
                value={copyDate}
                onChange={(e) => {
                  setCopyDate(e.target.value);
                  setCopyMessage(null);
                }}
              />
              <button type="button" className="btn btn-secondary" onClick={handleCopy} disabled={!copyDate || copying}>
                {copying ? 'Copying…' : 'Copy'}
              </button>
            </div>
            {copyMessage && <p style={{ color: 'var(--color-accent)', margin: '6px 0 0' }}>{copyMessage}</p>}
          </div>
        )}

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
