import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface SheetProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** 'center' renders a compact centered dialog instead of the bottom sheet. */
  variant?: 'sheet' | 'center';
}

/** Elements that can receive focus inside the panel. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The app's single modal primitive. Slides up on phones (thumb reach), centers
 * on larger screens (`variant="center"` for small dialogs). Traps focus,
 * restores focus to the opener on close, closes on Escape or backdrop tap and
 * locks body scroll while open.
 */
export const Sheet = ({ title, onClose, children, variant = 'sheet' }: SheetProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<Element | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement;
    const panel = panelRef.current;
    // Start each sheet at the top so it never opens mid-scroll.
    panel?.scrollTo(0, 0);
    // Move focus into the dialog immediately (keyboard/screen-reader users).
    // focus({ preventScroll }) avoids yanking the freshly-reset scroll position
    // down to the first focusable element.
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus({ preventScroll: true });

    // Note: the app shell already locks native scrolling (html/body/#root have
    // overflow:hidden), and each Sheet renders in its own fixed overlay, so an
    // imperative body lock here would be redundant — and restoring a captured
    // style string could permanently "leak" overflow:hidden across overlapping
    // sheets. Nothing to restore on close.

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault(); // claim the event so global Escape handlers stay quiet
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      } else if (!panel.contains(document.activeElement)) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    // Capture phase so we see the key before any window-level handlers do.
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      const prev = previouslyFocused.current as HTMLElement | null;
      prev?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="sheet-overlay" onMouseDown={onClose}>
      <div
        ref={panelRef}
        // overscroll-behavior: contain stops scroll-chaining; touch-action:
        // pan-y guarantees native touch scrolling inside the panel even when
        // Tailwind preflight or a global rule sets touch-action: manipulation.
        style={{ overscrollBehavior: 'contain', touchAction: 'pan-y' }}
        className={variant === 'center' ? 'sheet-panel sheet-panel--center' : 'sheet-panel'}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {variant !== 'center' && <div className="sheet-handle" aria-hidden="true" />}
        <div className="flex items-center justify-between mb-3">
          <h3 className="card__title mb-0">{title}</h3>
          <button
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="w-11 h-11 -mr-2 rounded-full flex items-center justify-center bg-[var(--surface-2)] text-[var(--text-muted)] active:scale-95 transition-transform"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};
