import { AppState, DEFAULT_STATE } from '../types';

const STORAGE_KEY = 'inventoryPro_state';

/**
 * Load app state from localStorage
 */
export const loadState = (): AppState => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_STATE, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load state:', e);
  }
  return { ...DEFAULT_STATE };
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
    localStorage.clear();
  } catch (e) {
    console.error('Failed to clear state:', e);
  }
};
