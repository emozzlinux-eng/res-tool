import { describe, it, expect } from 'vitest';

/**
 * Regression test for the floating-point false shortage (Phase 1.3):
 * 0.1 * 3 === 0.30000000000000004 in IEEE-754, so a raw `<` compare of
 * stock vs needed flagged a shortage when stock was exactly enough.
 * The Manage page must compare using the same 3 dp rounding that
 * applyStockChanges uses. This helper mirrors the fixed comparison.
 */
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const isShortage = (stock: number, need: number) => r3(stock) < r3(need);

describe('shortage comparison with 3 dp rounding', () => {
  it('stock 0.3 vs need 0.1*3 is NOT a shortage', () => {
    // sanity: the raw floats really do differ
    expect(0.1 * 3 > 0.3).toBe(true);
    // with rounding, no false shortage
    expect(isShortage(0.3, 0.1 * 3)).toBe(false);
  });

  it('still detects real shortages', () => {
    expect(isShortage(0.299, 0.3)).toBe(true);
    expect(isShortage(0, 1)).toBe(true);
  });

  it('treats equal rounded values as enough', () => {
    expect(isShortage(1 - 0.9, 0.1)).toBe(false); // 0.09999... → 0.1
  });
});
