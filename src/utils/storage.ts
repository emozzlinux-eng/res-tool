import { AppState, DEFAULT_STATE } from '../types';
import { generateSyncKey } from './helpers';

const STORAGE_KEY = 'inventoryPro_state';

/**
 * Load app state from localStorage
 */
export const loadState = (): AppState => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      delete parsed.syncQueue;
      const state: AppState = { ...DEFAULT_STATE, ...parsed };
      if (!state.syncKey) state.syncKey = generateSyncKey();
      return state;
    }
  } catch (e) {
    console.error('Failed to load state:', e);
  }
  return { ...DEFAULT_STATE, syncKey: generateSyncKey() };
};

/**
 * Save app state to localStorage
 */
export const saveState = (state: AppState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state:', e);
  }
};

/**
 * Clear all stored data
 */
export const clearState = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear state:', e);
  }
};
