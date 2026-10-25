import {
  AppState,
  DailyLogEntry,
  RawItem,
  Recipe,
  StockChangeRecord,
  Supplier,
} from '../types';

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
 * - output: deduct recipe ingredients (food production)
 * - waste: deduct one unit's worth of the recipe, or the raw item itself
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
  // waste
  const recipe = state.recipes.find((r) => r.foodName === name);
  if (recipe) {
    // Waste of a finished food deducts one unit of the food's ingredients per wasted unit
    return recipeDeductions(recipe, qty);
  }
  return [{ itemName: name, delta: -qty }];
};

/**
 * Undo a log entry by reversing its recorded stock changes.
 */
export const reverseChanges = (changes: StockChange[]): StockChange[] =>
  changes.map((c) => ({ ...c, delta: -c.delta }));

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
