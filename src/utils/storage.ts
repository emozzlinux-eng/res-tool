import { AppState, DEFAULT_STATE } from '../types';

const STORAGE_KEY = 'inventoryPro_state';

/**
 * Validate/repair a parsed (or restored) state object so a corrupt or foreign
 * JSON file can never crash the app or poison downstream code. Arrays are
 * filtered to well-formed entries; numbers are coerced to safe values.
 */
export const normalizeState = (raw: unknown): AppState => {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_STATE };
  const p = raw as Record<string, unknown>;

  const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
  const num = (v: unknown, fallback = 0): number => {
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  const bool = (v: unknown, fallback = false): boolean => (typeof v === 'boolean' ? v : fallback);
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

  return {
    foods: arr<AppState['foods'][number]>(p.foods)
      .filter((f) => f && typeof f.name === 'string' && f.name.trim())
      .map((f) => ({ name: f.name, icon: str(f.icon, '🍞'), category: str(f.category, 'General') })),
    rawItems: arr<AppState['rawItems'][number]>(p.rawItems)
      .filter((i) => i && typeof i.name === 'string' && i.name.trim())
      .map((i) => ({
        name: i.name,
        icon: str(i.icon, '📦'),
        unit: str(i.unit, 'pcs'),
        parLevel: num(i.parLevel),
        currentStock: Math.max(0, num(i.currentStock)),
        costPerUnit: num(i.costPerUnit),
      })),
    recipes: arr<AppState['recipes'][number]>(p.recipes)
      .filter((r) => r && typeof r.foodName === 'string' && Array.isArray(r.ingredients))
      .map((r) => ({
        foodName: r.foodName,
        ingredients: r.ingredients
          .filter((ing) => ing && typeof ing.itemName === 'string' && Number.isFinite(Number(ing.qty)))
          .map((ing) => ({ itemName: ing.itemName, qty: Math.max(0, Number(ing.qty)) })),
      })),
    suppliers: arr<AppState['suppliers'][number]>(p.suppliers)
      .filter((s) => s && typeof s.name === 'string' && s.name.trim())
      .map((s) => ({
        name: s.name,
        phone: str(s.phone),
        items: arr<string>(s.items).filter((n) => typeof n === 'string'),
      })),
    dailyLog: arr<AppState['dailyLog'][number]>(p.dailyLog)
      .filter((e) => e && typeof e.id === 'string' && typeof e.name === 'string')
      .map((e) => ({
        ...e,
        type: e.type === 'waste' || e.type === 'restock' ? e.type : 'output',
        qty: String(e.qty ?? '1'),
        timestamp: num(e.timestamp),
      })),
    activityLog: arr<AppState['activityLog'][number]>(p.activityLog).filter(
      (a) => a && typeof a.action === 'string'
    ),
    pin: str(p.pin),
    onboardingSeen: bool(p.onboardingSeen),
    darkMode: bool(p.darkMode),
    autoLockMinutes: num(p.autoLockMinutes, 5) || 5,
    userName: str(p.userName, 'Manager'),
    scrambleKeypad: bool(p.scrambleKeypad),
    privacyBlur: bool(p.privacyBlur),
    panicWipeEnabled: bool(p.panicWipeEnabled),
    currency: str(p.currency, '$') || '$',
    favorites: arr<string>(p.favorites).filter((n) => typeof n === 'string'),
  };
};

/**
 * Load app state from localStorage
 */
export const loadState = (): AppState => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_STATE, ...normalizeState(JSON.parse(saved)) };
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.error('Failed to save state:', e);
    return false;
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
  } catch (e) {
    console.error('Failed to clear state:', e);
  }
};
