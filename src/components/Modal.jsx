import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Accessible modal dialog: labelled, focuses its first control, keeps Tab
 * focus inside, restores focus on close, and closes on Escape when allowed.
 */
export default function Modal({ open, title, onClose, children, className = '', dismissible = true, labelledBy }) {
  const ref = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const node = ref.current;
    const focusables = () =>
      [...node.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
        (el) => !el.disabled,
      );
    const first = node.querySelector('[data-autofocus]') || focusables()[0];
    first?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape' && dismissible && onClose) {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab') {
        const items = focusables();
        if (!items.length) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    node.addEventListener('keydown', onKey);
    return () => {
      node.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open, dismissible, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && dismissible) onClose?.();
      }}
    >
      <div
        ref={ref}
        className={`modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy || titleId}
      >
        {title ? (
          <h2 id={titleId} className="modal-title">
            {title}
          </h2>
        ) : null}
        {children}
      </div>
    </div>,
    document.body,
  );
}
