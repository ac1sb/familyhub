import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';

// One family member's avatar - a photo if they've uploaded one (Settings ->
// General), otherwise a colored circle with their name's first initial. Both
// the color and the photo are configured per-member in Settings, independent
// of each other and of the existing member badge colors used elsewhere
// (Calendar, Meal Planner) - changing one never touches the other.
export default function AvatarWidget({ member, name }) {
  const { data } = usePolling(() => api.avatars(), [], 30000);
  const avatar = data?.[member];
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';

  return (
    <section className="widget-card avatar-widget">
      <div className="widget-header">
        <h2>{name}</h2>
      </div>
      <div className="avatar-body">
        <div className="avatar-circle" style={!avatar?.photo ? { background: avatar?.color } : undefined}>
          {avatar?.photo ? (
            <img src={avatar.photo} alt={name} className="avatar-photo" />
          ) : (
            <span className="avatar-initial">{initial}</span>
          )}
        </div>
      </div>
    </section>
  );
}
