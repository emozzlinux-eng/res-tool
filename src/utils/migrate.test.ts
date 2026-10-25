import { describe, it, expect } from 'vitest';
import { migrateState } from './migrate';
import { normalizeState } from './storage';
import { AppState, DEFAULT_STATE, SCHEMA_VERSION } from '../types';

describe('migrateState v2 → v3', () => {
  const v2Fixture: AppState = {
    ...DEFAULT_STATE,
    schemaVersion: 2,
    foods: [{ name: 'Bread', icon: '🍞', category: 'Bakery' }],
    rawItems: [{ name: 'Flour', icon: '🌾', unit: 'kg', parLevel: 5, currentStock: 2 }],
    recipes: [{ foodName: 'Bread', ingredients: [{ itemName: 'Flour', qty: 0.5 }] }],
    suppliers: [{ name: 'Ako', phone: '0244000000', items: ['Flour'] }],
    dailyLog: [
      {
        id: 'e1', type: 'output', icon: '🍞', name: 'Bread', qty: '2',
        time: '10:00', timestamp: 1, stockChanges: [{ itemName: 'Flour', delta: -1 }],
      },
    ],
    activityLog: [{ action: 'produce 2 Bread', time: 1 }],
    favorites: ['Bread'],
    recentSearches: ['fl'],
    pin: 'HASH',
    userName: 'Ama',
    currency: '₵',
  };

  it('upgrades a v2 payload to v3 with setupDismissed=false and no data loss', () => {
    const out = migrateState(v2Fixture);
    expect(out.schemaVersion).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe(3);
    expect(out.setupDismissed).toBe(false);
    // nothing lost
    expect(out.foods).toEqual(v2Fixture.foods);
    expect(out.rawItems).toEqual(v2Fixture.rawItems);
    expect(out.recipes).toEqual(v2Fixture.recipes);
    expect(out.suppliers).toEqual(v2Fixture.suppliers);
    expect(out.dailyLog).toEqual(v2Fixture.dailyLog);
    expect(out.activityLog).toEqual(v2Fixture.activityLog);
    expect(out.favorites).toEqual(v2Fixture.favorites);
    expect(out.pin).toBe('HASH');
    expect(out.userName).toBe('Ama');
    expect(out.currency).toBe('₵');
  });

  it('normalizeState defaults missing setupDismissed to false', () => {
    const { setupDismissed: _drop, ...rest } = v2Fixture as AppState & { setupDismissed?: boolean };
    const out = normalizeState(rest);
    expect(out.setupDismissed).toBe(false);
    const kept = normalizeState({ ...v2Fixture, setupDismissed: true });
    expect(kept.setupDismissed).toBe(true);
  });

  it('a v1-shaped payload through normalize+migrate lands on v3', () => {
    const v1 = { ...v2Fixture, schemaVersion: 1 };
    const out = migrateState(normalizeState(v1));
    expect(out.schemaVersion).toBe(3);
    expect(out.setupDismissed).toBe(false);
    expect(out.foods).toHaveLength(1);
  });
});
