const WIDGETS = [
  { id: 'calendar', icon: '📅', label: 'Calendar' },
  { id: 'chores', icon: '✅', label: 'Chores' },
  { id: 'meals', icon: '🍽️', label: 'Dinner' },
  { id: 'lunch', icon: '🥪', label: 'Lunch' },
  { id: 'weather', icon: '⛅', label: 'Weather' },
  { id: 'shopping', icon: '🛒', label: 'Shopping' },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
];

export default function Sidebar({ active, onSelect }) {
  return (
    <nav className="sidebar">
      <div className="sidebar-brand">FamilyHub</div>
      {WIDGETS.map((w) => (
        <button
          key={w.id}
          className={`sidebar-btn${active === w.id ? ' active' : ''}`}
          onClick={() => onSelect(w.id)}
        >
          <span className="icon">{w.icon}</span>
          <span className="label">{w.label}</span>
        </button>
      ))}
      <div className="sidebar-spacer" />
    </nav>
  );
}

export { WIDGETS };
