import { describe, it, expect } from 'vitest';
import {
  applyStockChanges,
  buildLogEntry,
  buildOrders,
  changesForEntry,
  commitLogEntry,
  hasMeaningfulRecipe,
  hoursRemaining,
  reverseChanges,
  Shortage,
} from './inventory';
import { AppState, DEFAULT_STATE, RawItem, Supplier } from '../types';

const mkState = (overrides: Partial<AppState> = {}): AppState => ({
  ...DEFAULT_STATE,
  ...overrides,
});

describe('commitLogEntry — undo restores exactly what was deducted', () => {
  it('stores the actually-applied (clamped) delta in stockChanges', () => {
    // Repro from the bug report: stock 1, recipe needs 5 per unit, produce 1.
    const state = mkState({
      rawItems: [{ name: 'Flour', icon: '🌾', unit: 'kg', parLevel: 0, currentStock: 1 }],
      recipes: [{ foodName: 'Bread', ingredients: [{ itemName: 'Flour', qty: 5 }] }],
    });
    const built = buildLogEntry(state, 'output', 'Bread', 1, '🍞');
    expect(built).not.toBeNull();
    const next = commitLogEntry(state, built!.entry, built!.changes, 'produce 1 Bread');

    // Stock clamps at 0…
    expect(next.rawItems[0].currentStock).toBe(0);
    // …and the entry records the APPLIED delta (-1), not the requested -5.
    expect(next.dailyLog[0].stockChanges).toEqual([{ itemName: 'Flour', delta: -1 }]);

    // Undo: reverse the recorded changes → back to exactly 1 (was 5 before fix).
    const undone = applyStockChanges(next.rawItems, reverseChanges(next.dailyLog[0].stockChanges ?? []));
    expect(undone[0].currentStock).toBe(1);
  });

  it('keeps the full delta when nothing is clamped', () => {
    const state = mkState({
      rawItems: [{ name: 'Flour', icon: '🌾', unit: 'kg', parLevel: 0, currentStock: 10 }],
      recipes: [{ foodName: 'Bread', ingredients: [{ itemName: 'Flour', qty: 5 }] }],
    });
    const built = buildLogEntry(state, 'output', 'Bread', 1, '🍞');
    const next = commitLogEntry(state, built!.entry, built!.changes, 'x');
    expect(next.dailyLog[0].stockChanges).toEqual([{ itemName: 'Flour', delta: -5 }]);
    expect(next.rawItems[0].currentStock).toBe(5);
  });

  it('rounds applied deltas to 3 dp', () => {
    const state = mkState({
      rawItems: [{ name: 'Butter', icon: '🧈', unit: 'kg', parLevel: 0, currentStock: 0.3 }],
      recipes: [{ foodName: 'Cake', ingredients: [{ itemName: 'Butter', qty: 0.1 }] }],
    });
    const built = buildLogEntry(state, 'output', 'Cake', 2, '🎂');
    const next = commitLogEntry(state, built!.entry, built!.changes, 'x');
    // 0.3 - 0.2 = 0.1 exactly after rounding
    expect(next.dailyLog[0].stockChanges).toEqual([{ itemName: 'Butter', delta: -0.2 }]);
    expect(next.rawItems[0].currentStock).toBe(0.1);
  });

  it('copies the waste reason into the activity entry', () => {
    const state = mkState({
      rawItems: [{ name: 'Milk', icon: '🥛', unit: 'l', parLevel: 0, currentStock: 5 }],
    });
    const built = buildLogEntry(state, 'waste', 'Milk', 1, '🥛', 'expired');
    const next = commitLogEntry(state, built!.entry, built!.changes, 'waste 1 Milk');
    expect(next.activityLog[0].reason).toBe('expired');
  });
});

describe('buildOrders — dedupe across suppliers (first supplier wins)', () => {
  const eggs: RawItem = { name: 'Eggs', icon: '🥚', unit: 'pcs', parLevel: 60, currentStock: 10 };
  const flour: RawItem = { name: 'Flour', icon: '🌾', unit: 'kg', parLevel: 20, currentStock: 1 };
  const shortages: Shortage[] = [
    { item: eggs, outOfStock: false, suggestedQty: 110 },
    { item: flour, outOfStock: false, suggestedQty: 39 },
  ];

  it('lists an item under only the first matching supplier', () => {
    const suppliers: Supplier[] = [
      { name: 'A', phone: '', items: ['Eggs'] },
      { name: 'B', phone: '', items: ['Eggs', 'Flour'] },
    ];
    const orders = buildOrders(suppliers, shortages);
    const eggLines = orders.flatMap((o) => o.lines.filter((l) => l.item.name === 'Eggs'));
    expect(eggLines).toHaveLength(1);
    expect(orders[0].supplier?.name).toBe('A');
    // B still gets its own line for Flour
    const bOrder = orders.find((o) => o.supplier?.name === 'B');
    expect(bOrder?.lines.map((l) => l.item.name)).toEqual(['Flour']);
  });

  it('does not repeat items in the unassigned bucket', () => {
    const suppliers: Supplier[] = [{ name: 'A', phone: '', items: ['Eggs'] }];
    const orders = buildOrders(suppliers, shortages);
    const other = orders.find((o) => o.supplier === null);
    expect(other?.lines.map((l) => l.item.name)).toEqual(['Flour']);
  });
});

describe('shortage comparison (epsilon-safe)', () => {
  // The ManagePage shortage check uses this predicate; regression test for the
  // floating-point false shortage: stock 0.3 vs need 0.1*3 (= 0.30000000000000004).
  const insufficient = (currentStock: number, needed: number): boolean =>
    Math.round(currentStock * 1000) < Math.round(needed * 1000);

  it('0.3 stock covers a 0.1*3 requirement', () => {
    const state = mkState({
      rawItems: [{ name: 'Butter', icon: '🧈', unit: 'kg', parLevel: 0, currentStock: 0.3 }],
      recipes: [{ foodName: 'Cake', ingredients: [{ itemName: 'Butter', qty: 0.1 }] }],
    });
    const changes = changesForEntry(state, 'output', 'Cake', 3, );
    const flags = changes.filter((c) => c.delta < 0 && insufficient(0.3, Math.abs(c.delta)));
    expect(changes[0].delta).toBeCloseTo(-0.30000000000000004, 10);
    expect(flags).toHaveLength(0);
  });

  it('still flags a genuine shortage', () => {
    expect(insufficient(0.2, 0.3)).toBe(true);
  });
});

describe('hoursRemaining — counts each entry once', () => {
  it('a waste entry of 2 l over ~1 h with 10 l left gives about 5 h', () => {
    const now = Date.now();
    const state = mkState({
      rawItems: [{ name: 'Milk', icon: '🥛', unit: 'l', parLevel: 0, currentStock: 10 }],
      dailyLog: [
        {
          id: 'e1',
          type: 'waste',
          icon: '🥛',
          name: 'Milk',
          qty: '2',
          time: 'now',
          timestamp: now - 60 * 60 * 1000, // one hour ago
          stockChanges: [{ itemName: 'Milk', delta: -2 }],
        },
      ],
    });
    const res = hoursRemaining(state, state.rawItems[0]);
    expect(res).not.toBeNull();
    // Before the fix the waste counted twice (used=4 → ~2.5 h).
    expect(res!.hours).toBeCloseTo(5, 0);
  });

  it('counts output deductions and restocks sensibly', () => {
    const now = Date.now();
    const state = mkState({
      rawItems: [{ name: 'Flour', icon: '🌾', unit: 'kg', parLevel: 0, currentStock: 8 }],
      dailyLog: [
        {
          id: 'e1',
          type: 'output',
          icon: '🍞',
          name: 'Bread',
          qty: '2',
          time: 'now',
          timestamp: now - 60 * 60 * 1000,
          stockChanges: [{ itemName: 'Flour', delta: -2 }],
        },
        {
          id: 'e2',
          type: 'restock',
          icon: '📦',
          name: 'Flour',
          qty: '10',
          time: 'now',
          timestamp: now - 30 * 60 * 1000,
          stockChanges: [{ itemName: 'Flour', delta: 10 }],
        },
      ],
    });
    const res = hoursRemaining(state, state.rawItems[0]);
    expect(res).not.toBeNull();
    expect(res!.perHour).toBeCloseTo(2, 1); // 2 kg used in ≥0.5h window clamp
  });
});

describe('hasMeaningfulRecipe', () => {
  it('is false for missing or empty recipes', () => {
    const state = mkState({
      recipes: [{ foodName: 'Empty', ingredients: [] }],
    });
    expect(hasMeaningfulRecipe(state, 'Bread')).toBe(false);
    expect(hasMeaningfulRecipe(state, 'Empty')).toBe(false);
    expect(hasMeaningfulRecipe(state, 'Croissant')).toBe(false);
  });

  it('is true when the recipe has ingredient lines', () => {
    const state = mkState({
      recipes: [{ foodName: 'Bread', ingredients: [{ itemName: 'Flour', qty: 1 }] }],
    });
    expect(hasMeaningfulRecipe(state, 'Bread')).toBe(true);
  });
});
