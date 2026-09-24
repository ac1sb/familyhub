import { useEffect, useRef, useState } from 'react';
import { TASK_ICON_CATEGORIES, getTaskIcon } from '../lib/taskIcons.js';

// A small "current icon" button that expands into a categorized picker -
// same collapsed-until-tapped pattern as DrawingCanvas's color swatch, since
// showing all ~130 icons at once everywhere would be far too much for a
// settings row. `icon` is the explicitly-saved choice (or null/undefined to
// keep auto-guessing from `title`); `onChange` receives the new icon, or
// null when "Auto" is picked.
export default function IconPicker({ icon, title, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', handleOutside, true);
    return () => document.removeEventListener('pointerdown', handleOutside, true);
  }, [open]);

  const isAuto = !icon;
  const displayIcon = icon || getTaskIcon(title);

  return (
    <div className="icon-picker" ref={wrapRef}>
      <button
        type="button"
        className={`icon-picker-trigger${isAuto ? ' auto' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title={isAuto ? 'Auto-guessed from the name - tap to pick your own' : 'Tap to change the icon'}
      >
        {displayIcon}
      </button>
      {open && (
        <div className="icon-picker-panel">
          <button
            type="button"
            className={`icon-picker-auto-btn${isAuto ? ' selected' : ''}`}
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            ✨ Auto-guess from name
          </button>
          {TASK_ICON_CATEGORIES.map((category) => (
            <div className="icon-picker-category" key={category.name}>
              <div className="icon-picker-category-label">{category.name}</div>
              <div className="icon-picker-grid">
                {category.icons.map(({ icon: ic }) => (
                  <button
                    type="button"
                    key={ic}
                    className={`icon-picker-option${!isAuto && icon === ic ? ' selected' : ''}`}
                    onClick={() => {
                      onChange(ic);
                      setOpen(false);
                    }}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
