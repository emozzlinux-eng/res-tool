import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { AppState, Page } from '../types';
import { loadState, saveState } from '../utils/storage';
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

/**
 * Correct mobile viewport height. On iOS Safari `100%`/`100vh` ignore the
 * dynamic URL bar, which hides the bottom nav and FAB when the bar is showing.
 */
const useMobileViewportHeight = (): void => {
  useEffect(() => {
    const setVh = () => {
      document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    };
    setVh();
    window.addEventListener('resize', setVh);
    window.addEventListener('orientationchange', setVh);
    return () => {
      window.removeEventListener('resize', setVh);
      window.removeEventListener('orientationchange', setVh);
    };
  }, []);
};

export const useAppState = () => {
  const [state, setState] = useState<AppState>(loadState);
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [toast, setToast] = useState({ msg: '', visible: false });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedOnce = useRef(false);
  // Timestamp of the last successful write to localStorage (for "Saved locally · …")
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  useMobileViewportHeight();

  // Save state on change — surface quota errors instead of losing data silently
  useEffect(() => {
    // Skip the initial "save what we just loaded" write
    if (!savedOnce.current) {
      savedOnce.current = true;
      return;
    }
    const ok = saveState(state);
    if (ok) {
      setLastSavedAt(Date.now());
    } else {
      setToast({ msg: '⚠️ Storage full — recent changes may not be saved. Export a backup!', visible: true });
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 5000);
    }
  }, [state]);

  // Clear pending toast timer on unmount
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

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
