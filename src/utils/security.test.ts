import { describe, it, expect, beforeEach } from 'vitest';
import { defuseFormula } from './export';
import { normalizeState, loadPanicWipeEnabled, persistPanicWipeEnabled } from './storage';

describe('CSV/Excel formula injection defense', () => {
  it('defuses dangerous leading characters', () => {
    for (const ch of ['=', '+', '-', '@', '\t', '\r']) {
      const out = defuseFormula(ch + 'cmd|calc');
      expect(out.startsWith("'")).toBe(true);
    }
  });
  it('leaves benign text untouched', () => {
    expect(defuseFormula('Paneer 500g')).toBe('Paneer 500g');
    expect(defuseFormula('12345')).toBe('12345');
  });
});

describe('normalizeState hardening against hostile backups', () => {
  it('rejects non-objects and returns defaults', () => {
    expect(() => normalizeState(null as never)).not.toThrow();
    const s = normalizeState(null as never);
    expect(Array.isArray(s.foods)).toBe(true);
  });

  it('caps oversized strings, numbers, and arrays', () => {
    const huge = 'A'.repeat(100_000);
    const raw = {
      rawItems: Array.from({ length: 50_000 }, (_, i) => ({
        name: `i${i}`.padEnd(100_000, huge.slice(0, 10)),
        unit: huge,
        parLevel: Number.MAX_VALUE,
        currentStock: Infinity,
        costPerUnit: -9999,
      })),
      pin: huge,
      autoLockMinutes: 10 ** 12,
    };
    const s = normalizeState(raw);
    expect(s.rawItems.length).toBeLessThanOrEqual(5000);
    for (const f of s.rawItems) {
      expect(f.name.length).toBeLessThanOrEqual(80);
      expect(Number.isFinite(f.parLevel)).toBe(true);
      expect(f.parLevel).toBeLessThanOrEqual(1_000_000_000);
      expect(f.currentStock).toBeGreaterThanOrEqual(0);
      expect(f.costPerUnit).toBeGreaterThanOrEqual(0);
    }
    expect(s.pin.length).toBeLessThanOrEqual(200);
    expect(s.autoLockMinutes).toBeLessThanOrEqual(1440);
  });

  it('drops malformed entries and coerces wrong types', () => {
    const s = normalizeState({ foods: [null, 1, 'x', { name: 'ok' }], rawItems: {}, suppliers: [{ name: 'S', phone: 'javascript:alert(1)' }] });
    expect(s.foods.length).toBe(1);
    expect(Array.isArray(s.rawItems)).toBe(true);
    // Phone is stripped to dial characters only — no scheme payloads survive.
    expect(/^[0-9+ -]*$/.test(s.suppliers[0].phone)).toBe(true);
  });
});

describe('panic-wipe flag isolation from backup blob', () => {
  beforeEach(() => localStorage.clear());

  it('is not enabled by a malicious state blob', () => {
    persistPanicWipeEnabled(false);
    normalizeState({ panicWipeEnabled: true, foods: [], rawItems: [] });
    // The source of truth lives in its own key; the blob cannot flip it.
    expect(loadPanicWipeEnabled()).toBe(false);
  });

  it('round-trips through its own storage key', () => {
    persistPanicWipeEnabled(true);
    expect(loadPanicWipeEnabled()).toBe(true);
    expect(localStorage.getItem('inventoryPro_panicWipe')).toBe('1');
    persistPanicWipeEnabled(false);
    expect(loadPanicWipeEnabled()).toBe(false);
  });
});
