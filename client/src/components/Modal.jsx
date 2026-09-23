import { createPortal } from 'react-dom';

// Renders via a portal straight onto <body>, not wherever it happens to be
// mounted in the tree. This matters on the dashboard: react-grid-layout
// positions each widget with an inline `transform`, and a CSS transform on
// an ancestor makes position:fixed children position relative to THAT
// ancestor instead of the viewport - so a modal opened from a dashboard
// widget could render partly behind/under other widgets instead of
// centered over the whole screen. Opening it from the full-page views never
// hit this, since those aren't inside a transformed grid item.
export default function Modal({ onClose, children }) {
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  );
}
