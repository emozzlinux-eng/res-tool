import { RawItem, Recipe, StockChange, Supplier } from '../types';

const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Apply stock changes, never letting stock drop below zero.
 * Returns the updated items and the deltas that were actually applied (for exact undo).
 */
export const applyStockChanges = (
  rawItems: RawItem[],
  changes: StockChange[],
): { rawItems: RawItem[]; applied: StockChange[] } => {
  const applied: StockChange[] = [];
  const next = rawItems.map(item => {
    const delta = changes.filter(c => c.itemName === item.name).reduce((sum, c) => sum + c.delta, 0);
    if (delta === 0) return item;
    const newStock = round(Math.max(0, item.currentStock + delta));
    const actual = round(newStock - item.currentStock);
    if (actual !== 0) applied.push({ itemName: item.name, delta: actual });
    return { ...item, currentStock: newStock };
  });
  return { rawItems: next, applied };
};

/**
 * Ingredient deductions for producing `qty` units of a recipe
 */
export const recipeDeductions = (recipe: Recipe | undefined, qty: number): StockChange[] =>
  (recipe?.ingredients ?? []).map(ing => ({ itemName: ing.itemName, delta: round(-ing.qty * qty) }));

/**
 * Ingredients that don't have enough stock for the given deductions
 */
export const findShortages = (rawItems: RawItem[], changes: StockChange[]) =>
  changes
    .map(c => {
      const item = rawItems.find(i => i.name === c.itemName);
      const needed = -c.delta;
      return item && needed > item.currentStock ? { item, needed } : null;
    })
    .filter((x): x is { item: RawItem; needed: number } => x !== null);

/** Suggested orders top stock back up to this multiple of par level */
export const ORDER_TARGET_MULTIPLIER = 2;

export interface OrderLine {
  item: RawItem;
  qty: number;
}

export interface SupplierOrder {
  supplier: Supplier | null;
  lines: OrderLine[];
}

/**
 * Build suggested orders for all items below par, grouped by supplier
 */
export const buildOrders = (rawItems: RawItem[], suppliers: Supplier[]): SupplierOrder[] => {
  const low = rawItems.filter(i => i.currentStock < i.parLevel);
  const orders: SupplierOrder[] = [];
  const assigned = new Set<string>();

  suppliers.forEach(supplier => {
    const lines = low
      .filter(i => supplier.items.includes(i.name) && !assigned.has(i.name))
      .map(item => ({ item, qty: Math.ceil(item.parLevel * ORDER_TARGET_MULTIPLIER - item.currentStock) }));
    lines.forEach(l => assigned.add(l.item.name));
    if (lines.length) orders.push({ supplier, lines });
  });

  const unassigned = low
    .filter(i => !assigned.has(i.name))
    .map(item => ({ item, qty: Math.ceil(item.parLevel * ORDER_TARGET_MULTIPLIER - item.currentStock) }));
  if (unassigned.length) orders.push({ supplier: null, lines: unassigned });

  return orders;
};

/**
 * Plain-text order message for sharing (WhatsApp, clipboard)
 */
export const orderMessage = (order: SupplierOrder, from: string): string => {
  const lines = order.lines.map(l => `• ${l.item.name}: ${l.qty} ${l.item.unit}`).join('\n');
  const greeting = order.supplier ? `Hello ${order.supplier.name},` : 'Order list:';
  return `${greeting}\n\nPlease supply the following:\n${lines}\n\nThank you,\n${from}`;
};

/**
 * WhatsApp click-to-chat link
 */
export const whatsappLink = (phone: string, message: string): string =>
  `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
