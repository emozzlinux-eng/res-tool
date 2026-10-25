import {
  AppState,
  DailyLogEntry,
  RawItem,
  Recipe,
  StockChangeRecord,
  Supplier,
} from '../types';
import { generateId, getCurrentTime } from './helpers';

export type StockChange = StockChangeRecord;

/**
 * Given a recipe and a production quantity, compute how much of each raw
 * item is consumed. Returns negative deltas (deductions).
 */
export const recipeDeductions = (
  recipe: Recipe | undefined,
  qty: number
): StockChange[] => {
  if (!recipe) return [];
  return recipe.ingredients.map((ing) => ({
    itemName: ing.itemName,
    delta: -(ing.qty * qty),
  }));
};

/**
 * Apply a list of stock changes to the raw items array, returning a new
 * array. Stocks are clamped at 0 so logging never produces negatives.
 */
export const applyStockChanges = (
  items: RawItem[],
  changes: StockChange[]
): RawItem[] => {
  if (changes.length === 0) return items;
  return items.map((item) => {
    const relevant = changes.filter((c) => c.itemName === item.name);
    if (relevant.length === 0) return item;
    const total = relevant.reduce((sum, c) => sum + c.delta, 0);
    const next = Math.round((item.currentStock + total) * 1000) / 1000;
    return { ...item, currentStock: Math.max(0, next) };
  });
};

/**
 * Build the stock changes for a single log entry, based on its type:
 * - output: deduct recipe ingredients (production of a FOOD)
 * - waste: reduce a RAW ITEM's stock directly (waste is logged on raw items only)
 * - restock: add stock to a raw item
 */
export const changesForEntry = (
  state: AppState,
  type: DailyLogEntry['type'],
  name: string,
  qty: number
): StockChange[] => {
  if (qty <= 0) return [];
  if (type === 'restock') {
    return [{ itemName: name, delta: qty }];
  }
  if (type === 'output') {
    const recipe = state.recipes.find((r) => r.foodName === name);
    return recipeDeductions(recipe, qty);
  }
  // waste — raw items only: reduces that item's stock directly
  return [{ itemName: name, delta: -qty }];
};

/**
 * Undo a log entry by reversing its recorded stock changes.
 */
export const reverseChanges = (changes: StockChange[]): StockChange[] =>
  changes.map((c) => ({ ...c, delta: -c.delta }));

/**
 * Build a daily-log entry together with the stock changes it applies.
 * Shared by ManagePage and RestockPage so both stay consistent.
 */
export const buildLogEntry = (
  state: AppState,
  type: DailyLogEntry['type'],
  name: string,
  qty: number,
  icon: string,
  reason?: string
): { entry: DailyLogEntry; changes: StockChange[] } | null => {
  if (!(qty > 0)) return null;
  const changes = changesForEntry(state, type, name, qty);
  const entry: DailyLogEntry = {
    id: generateId(),
    type,
    icon,
    name,
    qty: String(qty),
    time: getCurrentTime(),
    timestamp: Date.now(),
    reason,
    stockChanges: changes,
  };
  return { entry, changes };
};

/**
 * Append an entry + apply its stock changes + record activity, immutably.
 * Keeps the activity log capped at 50 entries.
 */
export const commitLogEntry = (
  prev: AppState,
  entry: DailyLogEntry,
  changes: StockChange[],
  actionLabel: string
): AppState => ({
  ...prev,
  dailyLog: [entry, ...prev.dailyLog],
  rawItems: applyStockChanges(prev.rawItems, changes),
  activityLog: [{ action: actionLabel, time: Date.now() }, ...prev.activityLog.slice(0, 49)],
});

/**
 * Find raw items that are at or below their par level (low) or at zero
 * (out of stock).
 */
export interface Shortage {
  item: RawItem;
  outOfStock: boolean;
  suggestedQty: number; // amount needed to reach 2x par level
}

export const findShortages = (items: RawItem[]): Shortage[] =>
  items
    .filter((i) => i.parLevel > 0 && i.currentStock <= i.parLevel)
    .map((i) => ({
      item: i,
      outOfStock: i.currentStock <= 0,
      suggestedQty: Math.max(1, Math.ceil(i.parLevel * 2 - i.currentStock)),
    }))
    .sort((a, b) => Number(b.outOfStock) - Number(a.outOfStock));

/**
 * Group shortages into per-supplier purchase orders. Items not covered by
 * any supplier go under a "Other" pseudo-supplier with no phone.
 */
export interface PurchaseOrder {
  supplier: Supplier | null;
  lines: { item: RawItem; qty: number }[];
}

export const buildOrders = (
  suppliers: Supplier[],
  shortages: Shortage[]
): PurchaseOrder[] => {
  const orders: PurchaseOrder[] = [];
  const claimed = new Set<string>();

  for (const supplier of suppliers) {
    const lines = shortages
      .filter((s) => supplier.items.includes(s.item.name))
      .map((s) => ({ item: s.item, qty: s.suggestedQty }));
    if (lines.length > 0) {
      orders.push({ supplier, lines });
      lines.forEach((l) => claimed.add(l.item.name));
    }
  }

  const unassigned = shortages.filter((s) => !claimed.has(s.item.name));
  if (unassigned.length > 0) {
    orders.push({
      supplier: null,
      lines: unassigned.map((s) => ({ item: s.item, qty: s.suggestedQty })),
    });
  }

  return orders;
};

const fmtQty = (n: number): string =>
  Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');

/**
 * Human-readable order message for WhatsApp / clipboard.
 */
export const orderMessage = (order: PurchaseOrder): string => {
  const supplierName = order.supplier?.name ?? 'Unassigned items';
  const header = `Order for ${supplierName}:`;
  const body = order.lines
    .map((l) => `• ${l.item.name} – ${fmtQty(l.qty)} ${l.item.unit}`)
    .join('\n');
  return `${header}\n${body}`;
};

/**
 * wa.me deep link pre-filled with the order message. Returns null when the
 * supplier has no phone number.
 */
export const whatsappLink = (order: PurchaseOrder): string | null => {
  if (!order.supplier?.phone) return null;
  const digits = order.supplier.phone.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(orderMessage(order))}`;
};

/**
 * Entries logged today (same calendar day as now).
 */
export const todaysEntries = (log: DailyLogEntry[]): DailyLogEntry[] => {
  const today = new Date().toDateString();
  return log.filter(
    (e) => new Date(e.timestamp).toDateString() === today
  );
};

/**
 * Sum of quantities produced (output entries) today.
 */
export const producedToday = (log: DailyLogEntry[]): number =>
  todaysEntries(log)
    .filter((e) => e.type === 'output')
    .reduce((sum, e) => sum + (parseFloat(e.qty) || 0), 0);

/**
 * Count of waste entries today.
 */
export const wasteToday = (log: DailyLogEntry[]): number =>
  todaysEntries(log).filter((e) => e.type === 'waste').length;

/* ------------------------------------------------------------------ */
/* Cost helpers                                                        */
/* ------------------------------------------------------------------ */

/**
 * Estimated ingredient cost to produce one unit of a food, based on the
 * recipe and each raw item's costPerUnit. Returns null when the food has
 * no recipe or no ingredient costs are set.
 */
export const recipeCost = (
  state: AppState,
  foodName: string
): { total: number; lines: { itemName: string; qty: number; cost: number }[] } | null => {
  const recipe = state.recipes.find((r) => r.foodName === foodName);
  if (!recipe) return null;
  let total = 0;
  let anyCost = false;
  const lines = recipe.ingredients.map((ing) => {
    const item = state.rawItems.find((i) => i.name === ing.itemName);
    const unitCost = item?.costPerUnit ?? 0;
    const cost = unitCost * ing.qty;
    if (unitCost > 0) anyCost = true;
    total += cost;
    return { itemName: ing.itemName, qty: ing.qty, cost };
  });
  if (!anyCost) return null;
  return { total: Math.round(total * 100) / 100, lines };
};

/**
 * Total monetary value of the stock currently on the shelves.
 */
export const inventoryValue = (items: RawItem[]): number =>
  Math.round(
    items.reduce((sum, i) => sum + i.currentStock * (i.costPerUnit ?? 0), 0) * 100
  ) / 100;

/**
 * Value of everything wasted today (waste entries priced via recipes or the
 * raw item's own cost).
 */
export const wasteValueToday = (state: AppState): number => {
  const entries = todaysEntries(state.dailyLog).filter((e) => e.type === 'waste');
  let total = 0;
  for (const e of entries) {
    const qty = parseFloat(e.qty) || 0;
    const rc = recipeCost(state, e.name);
    if (rc) {
      total += rc.total * qty;
      continue;
    }
    const raw = state.rawItems.find((i) => i.name === e.name);
    if (raw?.costPerUnit) total += raw.costPerUnit * qty;
  }
  return Math.round(total * 100) / 100;
};

/* ------------------------------------------------------------------ */
/* Analytics                                                           */
/* ------------------------------------------------------------------ */

/** Entries whose timestamp falls within the last `days` calendar days. */
export const entriesWithinDays = (log: DailyLogEntry[], days: number): DailyLogEntry[] => {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return log.filter((e) => e.timestamp >= cutoff);
};

/**
 * Auto-par suggestion: average daily consumption of a raw item over the last
 * `days` days (from output recipes + waste + negative adjustments), multiplied
 * by a lead-time factor. Returns null when there is not enough history yet.
 */
export const suggestParLevel = (
  state: AppState,
  itemName: string,
  days = 14
): { suggestedPar: number; avgDailyUse: number; sampleDays: number } | null => {
  const window = entriesWithinDays(state.dailyLog, days);
  if (window.length === 0) return null;

  // Track which calendar days actually had any activity, so averages are honest
  const activeDays = new Set(window.map((e) => new Date(e.timestamp).toDateString()));

  let used = 0;
  for (const e of window) {
    const qty = parseFloat(e.qty) || 0;
    if (e.type === 'waste' && e.name === itemName) used += qty;
    if (e.type === 'output') {
      for (const c of e.stockChanges ?? []) {
        if (c.itemName === itemName && c.delta < 0) used += -c.delta;
      }
    }
  }
  if (used <= 0) return null;

  const sampleDays = Math.max(1, activeDays.size);
  const avgDailyUse = used / sampleDays;
  // Par = ~2 days of usage rounded up — simple, explainable heuristic
  const suggestedPar = Math.max(1, Math.ceil(avgDailyUse * 2 * 100) / 100);
  return { suggestedPar, avgDailyUse: Math.round(avgDailyUse * 100) / 100, sampleDays };
};

/**
 * Depletion warning during service: given today's consumption pace, estimate
 * how many hours of stock remain for an item. Returns null when no usable
 * rate exists (no consumption today).
 */
export const hoursRemaining = (
  state: AppState,
  item: RawItem
): { hours: number; perHour: number } | null => {
  if (item.currentStock <= 0) return { hours: 0, perHour: 0 };
  const today = todaysEntries(state.dailyLog);
  let used = 0;
  let firstTs = Infinity;
  for (const e of today) {
    if (e.type === 'restock') continue;
    for (const c of e.stockChanges ?? []) {
      if (c.itemName === item.name && c.delta < 0) {
        used += -c.delta;
        firstTs = Math.min(firstTs, e.timestamp);
      }
    }
    if (e.type === 'waste' && e.name === item.name) {
      used += parseFloat(e.qty) || 0;
      firstTs = Math.min(firstTs, e.timestamp);
    }
  }
  if (used <= 0 || !Number.isFinite(firstTs)) return null;
  const elapsedHours = Math.max(0.5, (Date.now() - firstTs) / 3600_000);
  const perHour = used / elapsedHours;
  if (perHour <= 0) return null;
  return { hours: Math.round((item.currentStock / perHour) * 10) / 10, perHour: Math.round(perHour * 100) / 100 };
};

/**
 * Waste pattern analysis: totals by reason and by item over a lookback window.
 */
export interface WastePatterns {
  byReason: { reason: string; count: number; qty: number; value: number }[];
  byItem: { name: string; count: number; qty: number; value: number }[];
  byWeekday: { day: string; qty: number }[];
}

export const wastePatterns = (state: AppState, days = 30): WastePatterns => {
  const window = entriesWithinDays(state.dailyLog, days).filter((e) => e.type === 'waste');
  const reasonMap = new Map<string, { count: number; qty: number; value: number }>();
  const itemMap = new Map<string, { count: number; qty: number; value: number }>();
  const weekdayTotals = new Array<number>(7).fill(0);

  for (const e of window) {
    const qty = parseFloat(e.qty) || 0;
    const value = entryValueCached(state, e);
    const reason = e.reason ?? 'unspecified';
    const r = reasonMap.get(reason) ?? { count: 0, qty: 0, value: 0 };
    r.count += 1; r.qty += qty; r.value += value;
    reasonMap.set(reason, r);

    const it = itemMap.get(e.name) ?? { count: 0, qty: 0, value: 0 };
    it.count += 1; it.qty += qty; it.value += value;
    itemMap.set(e.name, it);

    weekdayTotals[new Date(e.timestamp).getDay()] += qty;
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    byReason: [...reasonMap.entries()]
      .map(([reason, v]) => ({ reason, count: v.count, qty: round(v.qty), value: round(v.value) }))
      .sort((a, b) => b.value - a.value || b.qty - a.qty),
    byItem: [...itemMap.entries()]
      .map(([name, v]) => ({ name, count: v.count, qty: round(v.qty), value: round(v.value) }))
      .sort((a, b) => b.value - a.value || b.qty - a.qty),
    byWeekday: dayNames.map((day, i) => ({ day, qty: round(weekdayTotals[i]) })),
  };
};

/** Price one entry (recipe cost or raw cost). Shared with report.ts semantics. */
const entryValueCached = (state: AppState, e: DailyLogEntry): number => {
  const qty = parseFloat(e.qty) || 0;
  const rc = recipeCost(state, e.name);
  if (rc) return rc.total * qty;
  const raw = state.rawItems.find((i) => i.name === e.name);
  if (raw?.costPerUnit) return raw.costPerUnit * qty;
  return 0;
};

/**
 * Daily trend series for the last `days` days: produced units, wasted units,
 * restocked units and waste value per calendar day (oldest → newest).
 */
export interface DayPoint {
  key: string; // YYYY-MM-DD
  label: string; // e.g. "Mon 20"
  produced: number;
  wasted: number;
  restocked: number;
  wasteValue: number;
}

export const dailyTrend = (state: AppState, days = 7): DayPoint[] => {
  const out: DayPoint[] = [];
  const now = new Date();
  const window = entriesWithinDays(state.dailyLog, days);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = d.toLocaleDateString('en-CA');
    const point: DayPoint = {
      key,
      label: d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }),
      produced: 0,
      wasted: 0,
      restocked: 0,
      wasteValue: 0,
    };
    for (const e of window) {
      if (new Date(e.timestamp).toLocaleDateString('en-CA') !== key) continue;
      const qty = parseFloat(e.qty) || 0;
      if (e.type === 'output') point.produced += qty;
      else if (e.type === 'waste') {
        point.wasted += qty;
        point.wasteValue += entryValueCached(state, e);
      } else point.restocked += qty;
    }
    point.wasted = Math.round(point.wasted * 100) / 100;
    point.produced = Math.round(point.produced * 100) / 100;
    point.restocked = Math.round(point.restocked * 100) / 100;
    point.wasteValue = Math.round(point.wasteValue * 100) / 100;
    out.push(point);
  }
  return out;
};
