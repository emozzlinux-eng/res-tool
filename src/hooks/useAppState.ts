import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { AppState, LogType, Page, SyncStatus, SyncedData, SYNCED_KEYS } from '../types';
import { loadState, saveState } from '../utils/storage';

interface AppContextType {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  updateState: (updates: Partial<AppState>) => void;
  /** Update synced business data; marks it for cloud sync and optionally logs activity */
  commit: (updater: (prev: AppState) => Partial<AppState>, activity?: string) => void;
  showToast: (msg: string) => void;
  isOnline: boolean;
  syncStatus: SyncStatus;
  syncNow: () => Promise<void>;
  linkWorkspace: (key: string) => Promise<boolean>;
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  manageMode: LogType;
  setManageMode: (mode: LogType) => void;
  lock: () => void;
  replayTutorial: () => void;
}

export const AppContext = createContext<AppContextType>({} as AppContextType);

export const useApp = () => useContext(AppContext);

const MAX_ACTIVITY = 100;
const PUSH_DEBOUNCE_MS = 1500;
const PULL_INTERVAL_MS = 60000;

const pickSynced = (state: AppState): SyncedData => {
  const data = {} as Record<string, unknown>;
  SYNCED_KEYS.forEach(k => { data[k] = state[k]; });
  return data as unknown as SyncedData;
};

const isValidRemote = (data: unknown): data is SyncedData => {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return ['foods', 'rawItems', 'recipes', 'suppliers', 'dailyLog', 'activityLog'].every(k => Array.isArray(d[k]));
};

const syncUrl = (key: string) => `/api/sync?key=${encodeURIComponent(key)}`;

export const useAppState = () => {
  const [state, setState] = useState<AppState>(loadState);
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [manageMode, setManageMode] = useState<LogType>('output');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [toast, setToast] = useState({ msg: '', visible: false });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const inFlight = useRef(false);

  // Save state on change
  useEffect(() => {
    saveState(state);
  }, [state]);

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

  const commit = useCallback((updater: (prev: AppState) => Partial<AppState>, activity?: string) => {
    setState(prev => {
      const updates = updater(prev);
      const next = { ...prev, ...updates, dataUpdatedAt: Math.max(Date.now(), prev.lastSyncedAt + 1) };
      if (activity) {
        next.activityLog = [{ action: activity, time: Date.now() }, ...next.activityLog].slice(0, MAX_ACTIVITY);
      }
      return next;
    });
  }, []);

  const applyRemote = useCallback((data: SyncedData, updatedAt: number) => {
    setState(prev => ({ ...prev, ...pickSynced({ ...prev, ...data }), dataUpdatedAt: updatedAt, lastSyncedAt: updatedAt }));
  }, []);

  const push = useCallback(async (): Promise<boolean> => {
    const s = stateRef.current;
    const res = await fetch(syncUrl(s.syncKey), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: pickSynced(s), updatedAt: s.dataUpdatedAt }),
    });
    if (res.status === 409) return false;
    if (!res.ok) throw new Error(`Sync failed (${res.status})`);
    const sentAt = s.dataUpdatedAt;
    setState(prev => ({ ...prev, lastSyncedAt: Math.max(prev.lastSyncedAt, sentAt) }));
    return true;
  }, []);

  /** Pull remote data, keep whichever side is newer, then push local changes if needed */
  const syncNow = useCallback(async () => {
    if (inFlight.current || !navigator.onLine) return;
    inFlight.current = true;
    setSyncing(true);
    try {
      const s = stateRef.current;
      const res = await fetch(syncUrl(s.syncKey));
      if (res.ok) {
        const remote = await res.json();
        if (isValidRemote(remote.data) && remote.updatedAt > s.dataUpdatedAt) {
          applyRemote(remote.data, remote.updatedAt);
          setSyncError(false);
          return;
        }
      } else if (res.status !== 404) {
        throw new Error(`Sync failed (${res.status})`);
      }
      if (s.dataUpdatedAt > s.lastSyncedAt || res.status === 404) {
        const pushed = await push();
        if (!pushed) {
          // Another device saved newer data in the meantime; take it
          const retry = await fetch(syncUrl(s.syncKey));
          const remote = retry.ok ? await retry.json() : null;
          if (remote && isValidRemote(remote.data)) applyRemote(remote.data, remote.updatedAt);
        }
      }
      setSyncError(false);
    } catch (e) {
      console.error(e);
      setSyncError(true);
    } finally {
      inFlight.current = false;
      setSyncing(false);
    }
  }, [applyRemote, push]);

  const linkWorkspace = useCallback(async (key: string): Promise<boolean> => {
    try {
      const res = await fetch(syncUrl(key));
      if (!res.ok) return false;
      const remote = await res.json();
      if (!isValidRemote(remote.data)) return false;
      setState(prev => ({
        ...prev,
        ...pickSynced({ ...prev, ...remote.data }),
        syncKey: key,
        dataUpdatedAt: remote.updatedAt,
        lastSyncedAt: remote.updatedAt,
      }));
      setSyncError(false);
      return true;
    } catch {
      return false;
    }
  }, []);

  // Sync on start, when coming online, when the app regains focus, and periodically
  useEffect(() => {
    if (!isOnline) return;
    syncNow();
    const onVisible = () => { if (document.visibilityState === 'visible') syncNow(); };
    document.addEventListener('visibilitychange', onVisible);
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') syncNow();
    }, PULL_INTERVAL_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
  }, [isOnline, syncNow, state.syncKey]);

  // Push local changes shortly after they happen
  const isDirty = state.dataUpdatedAt > state.lastSyncedAt;
  useEffect(() => {
    if (!isOnline || !isDirty) return;
    const t = setTimeout(syncNow, PUSH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [isOnline, isDirty, state.dataUpdatedAt, syncNow]);

  const syncStatus: SyncStatus = !isOnline
    ? 'offline'
    : syncing
      ? 'syncing'
      : syncError
        ? 'error'
        : isDirty
          ? 'pending'
          : 'synced';

  return {
    state,
    setState,
    updateState,
    commit,
    showToast,
    toast,
    isOnline,
    syncStatus,
    syncNow,
    linkWorkspace,
    currentPage,
    setCurrentPage,
    manageMode,
    setManageMode,
  };
};
