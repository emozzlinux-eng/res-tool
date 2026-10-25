/**
 * Anti-theft lockout helpers: failed-PIN counter and time-based lockout, both
 * persisted in localStorage so they survive page reloads. Only touches keys
 * owned by this app — never anything else stored on the origin.
 */

const FAILED_KEY = 'inventoryPro_failed';
const LOCK_KEY = 'inventoryPro_lockUntil';

/** All localStorage keys owned by this app's state & security counters. */
export const APP_STORAGE_KEYS = ['inventoryPro_state', FAILED_KEY, LOCK_KEY, 'inventoryPro_panicWipe'] as const;

export const getFailedAttempts = (): number => {
  try {
    return Number(localStorage.getItem(FAILED_KEY)) || 0;
  } catch {
    return 0;
  }
};

export const setFailedAttempts = (n: number): void => {
  try {
    if (n <= 0) localStorage.removeItem(FAILED_KEY);
    else localStorage.setItem(FAILED_KEY, String(n));
  } catch {
    /* ignore */
  }
};

/** Remaining lockout seconds (0 when not locked). Survives reloads. */
export const getLockRemainingSec = (): number => {
  try {
    const until = Number(localStorage.getItem(LOCK_KEY)) || 0;
    return Math.max(0, Math.ceil((until - Date.now()) / 1000));
  } catch {
    return 0;
  }
};

export const saveLockUntil = (t: number): void => {
  try {
    if (t > 0) localStorage.setItem(LOCK_KEY, String(t));
    else localStorage.removeItem(LOCK_KEY);
  } catch {
    /* ignore */
  }
};

/**
 * Wipe every piece of app data this browser knows about (state + counters).
 * Used as the panic response after too many wrong PIN attempts. Only removes
 * our own keys — other sites' data on the device is left alone.
 */
export const wipeAllData = (): void => {
  try {
    for (const key of APP_STORAGE_KEYS) localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
};
