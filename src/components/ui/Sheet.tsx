import React from 'react';
import { X } from 'lucide-react';

interface SheetProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/* Bottom sheet with a title bar and optional sticky footer */
export const Sheet: React.FC<SheetProps> = ({ title, onClose, children, footer }) => (
  <>
    <div className="bottom-sheet-overlay" onClick={onClose} />
    <div className="bottom-sheet" role="dialog" aria-modal="true" aria-label={title}>
      <div className="bottom-sheet__handle" />
      <div className="flex items-center justify-between px-4 pb-3">
        <h3 className="text-base font-semibold text-[var(--text-main)]">{title}</h3>
        <button className="modal-close" style={{ position: 'static' }} onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>
      <div className="px-4 pb-4">{children}</div>
      {footer && (
        <div className="sticky bottom-0 px-4 py-3 bg-[var(--surface)] border-t border-[var(--border)]">{footer}</div>
      )}
    </div>
  </>
);
