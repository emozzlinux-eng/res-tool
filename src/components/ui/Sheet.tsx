import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface SheetProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Bottom sheet — the app's standard modal. Slides up on phones (thumb reach),
 * centers on larger screens. Closes on backdrop tap or Escape.
 */
export const Sheet: React.FC<SheetProps> = ({ title, onClose, children }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div
        className="sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <div className="flex items-center justify-between mb-3">
          <h3 className="card__title mb-0">{title}</h3>
          <button
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--surface-2)] text-[var(--text-muted)] active:scale-95 transition-transform"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};
