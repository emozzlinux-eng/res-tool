import { AppState, SCHEMA_VERSION } from '../types';

/**
 * Migrate a normalized (v1-shape) state object up to the current schema.
 * Pure function so it can be unit-tested and reused by restore flows.
 * Each step upgrades exactly one version; add new steps as SCHEMA_VERSION grows.
 */
export const migrateState = (state: AppState): AppState => {
  let s: AppState = state;
  const from = typeof s.schemaVersion === 'number' && s.schemaVersion > 0 ? s.schemaVersion : 1;

  if (from < 2) {
    // v2 added themeMode + recentSearches; both have safe defaults already
    // applied by normalizeState, so this step is just a version stamp.
    s = { ...s };
  }

  if (from < 3) {
    // v3 adds setupDismissed (Home checklist dismissal flag). The boolean has
    // a safe default applied by normalizeState, so this step is a version
    // stamp; Phase 2 will extend v3 with the 'adjustment' entry type.
    s = { ...s };
  }

  return { ...s, schemaVersion: SCHEMA_VERSION };
};
