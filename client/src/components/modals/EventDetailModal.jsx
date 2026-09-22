import { useState } from 'react';
import AddEventModal from './AddEventModal.jsx';
import { formatTime } from '../../lib/week.js';

export default function EventDetailModal({ event, members, onClose, onChanged }) {
  const [editing, setEditing] = useState(false);
  const isGoogle = event.source === 'google';

  if (editing) {
    return (
      <AddEventModal
        members={members}
        existingEvent={event}
        onClose={onClose}
        onSaved={(saved) => onChanged?.(saved)}
      />
    );
  }

  const memberLabel = event.member === 'family' ? 'Whole Family' : members?.[event.member] || event.member;
  const occurrence = event.occurrence_start || event.start_datetime;
  const eventDate = new Date(occurrence);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{event.title}</h3>

        <span className={`member-choice ${event.member} event-detail-badge`}>{memberLabel}</span>

        <div className="event-detail-row">
          <span className="event-detail-label">When</span>
          <span>
            {eventDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            {!event.all_day && ` at ${formatTime(occurrence)}`}
            {event.all_day && ' (all day)'}
          </span>
        </div>

        {event.recurring && (
          <div className="event-detail-row">
            <span className="event-detail-label">Repeats</span>
            <span>Weekly &#8635;</span>
          </div>
        )}

        {event.location && (
          <div className="event-detail-row">
            <span className="event-detail-label">Where</span>
            <span>📍 {event.location}</span>
          </div>
        )}

        {event.description && (
          <div className="event-detail-row">
            <span className="event-detail-label">Notes</span>
            <span>{event.description}</span>
          </div>
        )}

        {event.is_reminder && (
          <div className="event-detail-row">
            <span className="event-detail-label">🔔</span>
            <span>Shows as a reminder banner on the dashboard</span>
          </div>
        )}

        {event.photo_path && (
          <div className="field">
            <label>Saved photo</label>
            <img className="event-detail-photo" src={event.photo_path} alt={`Flyer for ${event.title}`} />
          </div>
        )}

        {isGoogle && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
            Synced from Google Calendar — edit or delete it there.
          </p>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          {!isGoogle && (
            <button className="btn btn-primary" onClick={() => setEditing(true)}>Edit</button>
          )}
        </div>
      </div>
    </div>
  );
}
