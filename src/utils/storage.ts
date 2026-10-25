import { AppState, DEFAULT_STATE, SCHEMA_VERSION } from '../types';
import { migrateState } from './migrate';

const STORAGE_KEY = 'inventoryPro_state';

/** Backup file envelope — identifies our exports and carries the schema version. */
export const BACKUP_APP_ID = 'inventory-pro';
export interface BackupEnvelope {
  app: typeof BACKUP_APP_ID;
  schemaVersion: number;
  exportedAt: string;
  state: unknown;
}

export const wrapBackup = (state: AppState): BackupEnvelope => ({
  app: BACKUP_APP_ID,
  schemaVersion: SCHEMA_VERSION,
  exportedAt: new Date().toISOString(),
  state,
});

/**
 * Unwrap a backup file. Accepts both the new envelope format and legacy bare
 * state objects. Throws on files that clearly aren't ours.
 */
export const unwrapBackup = (parsed: unknown): unknown => {
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid file');
  const p = parsed as Record<string, unknown>;
  if (p.app === BACKUP_APP_ID) {
    if (typeof p.schemaVersion !== 'number' || !p.state) throw new Error('Corrupt backup');
    return p.state;
  }
  // Legacy: bare state object (no envelope). Accept if it looks like our shape.
  if ('foods' in p || 'rawItems' in p || 'pin' in p) return p;
  throw new Error('Not an Inventory Pro backup');
};

/**
 * Normalize & validate the `panicWipeEnabled` flag.
 *
 * SECURITY: this flag is intentionally NOT taken from the persisted/backup
 * blob. A malicious backup file could set it to true and then weaponize the
 * legacy weak-PIN upgrade path: after an unlock with a legacy hash, App
 * verifies only the *attacker-chosen* hash stored in the file, so the attacker
 * would know the "correct" PIN up front and their 5 failed guesses on the
 * victim's device would trigger a data wipe (denial of service). The setting
 * therefore lives under its own localStorage key, toggleable only from within
 * the app UI while unlocked.
 */
const PANIC_KEY = 'inventoryPro_panicWipe';

export const loadPanicWipeEnabled = (): boolean => {
  try {
    return localStorage.getItem(PANIC_KEY) === '1';
  } catch {
    return false;
  }
};

export const persistPanicWipeEnabled = (enabled: boolean): void => {
  try {
    if (enabled) localStorage.setItem(PANIC_KEY, '1');
    else localStorage.removeItem(PANIC_KEY);
  } catch {
    /* ignore */
  }
};

/**
 * Validate/repair a parsed (or restored) state object so a corrupt or foreign
 * JSON file can never crash the app or poison downstream code. Arrays are
 * filtered to well-formed entries; numbers are coerced to safe values.
 */
export const normalizeState = (raw: unknown): AppState => {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_STATE };
  const p = raw as Record<string, unknown>;

  const text = (v: unknown, maxLen: number, fallback = ''): string =>
    typeof v === 'string' ? v.slice(0, maxLen) : fallback;
  const num = (v: unknown, fallback = 0): number => {
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  /** Numbers used in money/quantity math — bounded to keep totals sane. */
  const boundedNum = (v: unknown, fallback = 0, max = 1_000_000_000): number =>
    Math.min(num(v, fallback), max);
  const bool = (v: unknown, fallback = false): boolean => (typeof v === 'boolean' ? v : fallback);
  const arr = <T>(v: unknown, maxLen = 5000): T[] =>
    Array.isArray(v) ? (v.slice(0, maxLen) as T[]) : [];

  return {
    rev: num(p.rev),
    schemaVersion: num(p.schemaVersion, SCHEMA_VERSION) || SCHEMA_VERSION,
    foods: arr<AppState['foods'][number]>(p.foods)
      .filter((f) => f && typeof f.name === 'string' && f.name.trim())
      .map((f) => ({
        name: text(f.name, 80),
        icon: text(f.icon, 8, '🍞'),
        category: text(f.category, 40, 'General'),
      })),
    rawItems: arr<AppState['rawItems'][number]>(p.rawItems)
      .filter((i) => i && typeof i.name === 'string' && i.name.trim())
      .map((i) => ({
        name: text(i.name, 80),
        icon: text(i.icon, 8, '📦'),
        unit: text(i.unit, 12, 'pcs'),
        parLevel: boundedNum(i.parLevel),
        currentStock: Math.max(0, boundedNum(i.currentStock)),
        costPerUnit: boundedNum(i.costPerUnit),
      })),
    recipes: arr<AppState['recipes'][number]>(p.recipes)
      .filter((r) => r && typeof r.foodName === 'string' && Array.isArray(r.ingredients))
      .map((r) => ({
        foodName: text(r.foodName, 80),
        ingredients: arr<{ itemName: unknown; qty: unknown }>(r.ingredients, 200)
          .filter((ing) => ing && typeof ing.itemName === 'string' && Number.isFinite(Number(ing.qty)))
          .map((ing) => ({ itemName: text(ing.itemName, 80), qty: Math.max(0, boundedNum(Number(ing.qty))) })),
      })),
    suppliers: arr<AppState['suppliers'][number]>(p.suppliers)
      .filter((s) => s && typeof s.name === 'string' && s.name.trim())
      .map((s) => ({
        name: text(s.name, 80),
        // Keep only dial characters — blocks javascript:/data: style payloads
        // from ever reaching the wa.me deep link built from this field.
        phone: text(s.phone, 30).replace(/[^\d+ -]/g, ''),
        items: arr<string>(s.items, 500).filter((n) => typeof n === 'string').map((n) => n.slice(0, 80)),
      })),
    dailyLog: arr<AppState['dailyLog'][number]>(p.dailyLog)
      .filter((e) => e && typeof e.id === 'string' && typeof e.name === 'string')
      .map((e) => ({
        ...e,
        id: text(e.id, 64),
        name: text(e.name, 80),
        icon: text(e.icon, 8),
        time: text(e.time, 16),
        type: e.type === 'waste' || e.type === 'restock' ? e.type : 'output',
        qty: text(String(e.qty ?? '1'), 16),
        reason: typeof e.reason === 'string' ? text(e.reason, 80) : undefined,
        timestamp: num(e.timestamp),
        stockChanges: Array.isArray(e.stockChanges)
          ? arr<{ itemName: unknown; delta: unknown }>(e.stockChanges, 200)
              .filter(
                (c) => c && typeof c.itemName === 'string' && Number.isFinite(Number(c.delta))
              )
              .map((c) => ({
                itemName: text(c.itemName, 80),
                delta: Math.max(-1_000_000_000, Math.min(1_000_000_000, Number(c.delta))),
              }))
          : undefined,
      })),
    activityLog: arr<AppState['activityLog'][number]>(p.activityLog, 200).filter(
      (a) => a && typeof a.action === 'string'
    ),
    pin: text(p.pin, 200),
    onboardingSeen: bool(p.onboardingSeen),
    darkMode: bool(p.darkMode),
    autoLockMinutes: Math.min(num(p.autoLockMinutes, 5) || 5, 1440),
    userName: text(p.userName, 30, 'Manager'),
    scrambleKeypad: bool(p.scrambleKeypad),
    privacyBlur: bool(p.privacyBlur),
    // SECURITY: never read the flag from the blob — see loadPanicWipeEnabled.
    panicWipeEnabled: loadPanicWipeEnabled(),
    currency: text(p.currency, 6, '$') || '$',
    favorites: arr<string>(p.favorites, 500).filter((n) => typeof n === 'string').map((n) => n.slice(0, 80)),
    themeMode: p.themeMode === 'light' || p.themeMode === 'dark' ? p.themeMode : 'system',
    recentSearches: arr<string>(p.recentSearches, 500).filter((n) => typeof n === 'string').map((n) => n.slice(0, 40)).slice(0, 8),
    setupDismissed: bool(p.setupDismissed),
  };
};

/**
 * Load app state from localStorage (running schema migrations when needed).
 */
export const loadState = (): AppState => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return migrateState({ ...DEFAULT_STATE, ...normalizeState(JSON.parse(saved)) });
    }
  } catch (e) {
    console.error('Failed to load state:', e);
  }
  return { ...DEFAULT_STATE };
};

/**
 * Save app state to localStorage. Returns false on failure (e.g. quota
 * exceeded) so callers can surface the problem instead of losing data silently.
 */
export const saveState = (state: AppState): boolean => {
  try {
    // Bump `rev` in the persisted copy only (not in memory), so other open
    // tabs can detect writes via the `storage` event without every keystroke
    // cascading through React state.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, rev: state.rev + 1 }));
    return true;
  } catch (e) {
    console.error('Failed to save state:', e);
    return false;
  }
};

/** Read the persisted state without adopting it (cross-tab sync checks). */
export const peekStoredRev = (): number | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as { rev?: number };
    return typeof parsed.rev === 'number' ? parsed.rev : null;
  } catch {
    return null;
  }
};

/**
 * Clear only this app's stored data (never localStorage.clear(), which would
 * wipe other sites' data sharing the origin).
 */
export const clearState = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('inventoryPro_failed');
    localStorage.removeItem('inventoryPro_lockUntil');
    localStorage.removeItem(PANIC_KEY);
  } catch (e) {
    console.error('Failed to clear state:', e);
  }
};
