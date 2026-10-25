import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { AppState, Page } from '../types';
import { loadState, saveState, peekStoredRev, STORAGE_KEY } from '../utils/storage';
import { formatTimeAgo } from '../utils/format';

interface AppContextType {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  updateState: (updates: Partial<AppState>) => void;
  showToast: (msg: string) => void;
  isOnline: boolean;
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  lock: () => void;
  replayTutorial: () => void;
}

export const AppContext = createContext<AppContextType>({} as AppContextType);

export const useApp = () => useContext(AppContext);

/** Debounce window for persisting the workspace blob to localStorage (ms). */
const SAVE_DEBOUNCE_MS = 400;

/**
 * Correct mobile viewport height. On iOS Safari `100%`/`100vh` ignore the
 * dynamic URL bar, which hides the bottom nav and FAB when the bar is showing.
 */
const useMobileViewportHeight = (): void => {
  useEffect(() => {
    const setVh = () => {
      // Prefer visualViewport: it also shrinks when the on-screen keyboard
      // opens (window.resize does not fire reliably in PWA standalone mode),
      // keeping the PIN keypad / bottom nav above the fold.
      const h = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty('--app-height', `${h}px`);
    };
    setVh();
    window.addEventListener('resize', setVh);
    window.addEventListener('orientationchange', setVh);
    window.visualViewport?.addEventListener('resize', setVh);
    return () => {
      window.removeEventListener('resize', setVh);
      window.removeEventListener('orientationchange', setVh);
      window.visualViewport?.removeEventListener('resize', setVh);
    };
  }, []);
};

export const useAppState = () => {
  const [state, setState] = useState<AppState>(loadState);
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [toast, setToast] = useState({ msg: '', visible: false });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedOnce = useRef(false);
  // Latest state, readable from stable event handlers (flush-on-hide)
  const stateRef = useRef(state);
  stateRef.current = state;
  // Timestamp of the last successful write to localStorage (for "Saved locally · …")
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  useMobileViewportHeight();

  // Save state on change — debounced so rapid typing in editors doesn't
  // re-serialize the whole workspace blob on every keystroke. Surface quota
  // errors instead of losing data silently, and flush on tab close.
  useEffect(() => {
    // Skip the initial "save what we just loaded" write
    if (!savedOnce.current) {
      savedOnce.current = true;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const ok = saveState(state);
      if (ok) {
        setLastSavedAt(Date.now());
      } else {
        setToast({ msg: '⚠️ Storage full — recent changes may not be saved. Export a backup!', visible: true });
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 5000);
      }
    }, SAVE_DEBOUNCE_MS);
  }, [state]);

  // Flush any pending save before the page is hidden/closed so no edit is lost
  useEffect(() => {
    const flush = () => {
      if (!saveTimer.current) return;
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      saveState(stateRef.current);
    };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', flush);
    };
  }, []);

  // Clear pending timers on unmount
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    []
  );

  // Cross-tab awareness: `rev` is bumped by saveState() on every write, so a
  // 'storage' event with a *different* rev means another tab edited the same
  // workspace. We don't auto-merge (risk of clobbering unsaved edits), but we
  // warn instead of silently overwriting the other tab on the next debounce.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const stored = peekStoredRev();
      if (stored !== null && stored !== stateRef.current.rev) {
        setToast({ msg: '⚠️ Another tab modified this data. Export/import to merge safely.', visible: true });
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 5000);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Dark mode
  useEffect(() => {
    if (state.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.darkMode]);

  // Online/Offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast({ msg, visible: true });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast({ msg: '', visible: false }), 2500);
  }, []);

  const updateState = useCallback((updates: Partial<AppState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  return {
    state,
    setState,
    updateState,
    showToast,
    toast,
    isOnline,
    currentPage,
    setCurrentPage,
    lastSavedLabel: lastSavedAt ? formatTimeAgo(lastSavedAt) : undefined,
  };
};
