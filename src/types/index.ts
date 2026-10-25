export interface Food {
  name: string;
  icon: string;
  category: string;
}

export interface RawItem {
  name: string;
  icon: string;
  unit: string;
  parLevel: number;
  currentStock: number;
  /** Purchase cost per unit, in the shop's currency. Optional (0 assumed). */
  costPerUnit?: number;
}

export interface RecipeIngredient {
  itemName: string;
  qty: number;
}

export interface Recipe {
  /** Free-text food name — may be typed manually or picked from existing foods. */
  foodName: string;
  ingredients: RecipeIngredient[];
}

export interface Supplier {
  name: string;
  phone: string;
  items: string[];
}

export interface StockChangeRecord {
  itemName: string;
  delta: number;
}

export interface DailyLogEntry {
  id: string;
  type: 'output' | 'waste' | 'restock';
  icon: string;
  name: string;
  qty: string;
  time: string;
  timestamp: number;
  reason?: string;
  /** Stock changes applied when this entry was logged, so it can be undone. */
  stockChanges?: StockChangeRecord[];
}

export interface ActivityEntry {
  action: string;
  time: number;
  /** Waste reason badge (optional). */
  reason?: string;
}

/** Current on-disk schema version — bump when AppState changes shape. */
export const SCHEMA_VERSION = 3;

export interface AppState {
  /** Bumped on every persisted save so other open tabs can detect changes. */
  rev: number;
  /** Schema version of the stored payload (used for backup migration). */
  schemaVersion: number;
  foods: Food[];
  rawItems: RawItem[];
  recipes: Recipe[];
  suppliers: Supplier[];
  dailyLog: DailyLogEntry[];
  activityLog: ActivityEntry[];
  /** Default sign-in PIN (also used after Reset All Data). Can be changed via Change PIN. */
  pin: string;
  onboardingSeen: boolean;
  darkMode: boolean;
  autoLockMinutes: number;
  userName: string;
  /** Security options (all default off/standard). */
  scrambleKeypad: boolean;
  privacyBlur: boolean;
  panicWipeEnabled: boolean;
  /** Shop currency symbol used across the app (e.g. ₦, $, ₹, £). */
  currency: string;
  /** Items marked as favorites get quick-log chips on the Manage page. */
  favorites: string[];
  /** 'system' follows the OS preference; 'light'/'dark' force a theme. */
  themeMode: 'system' | 'light' | 'dark';
  /** Recent search terms on the Inventory page (fuzzy search history). */
  recentSearches: string[];
  /** True once the user dismisses the Home setup checklist. */
  setupDismissed: boolean;
}

export type Page = 'home' | 'manage' | 'restock' | 'profile';

/** Default sign-in PIN used on first use and after Reset All Data. Changeable via Change PIN. */
export const DEFAULT_PIN = '000000';

/**
 * Fresh-start state — intentionally contains NO demo/sample data.
 * A new install begins with empty lists; the user adds their own
 * foods, ingredients, recipes and suppliers from the Profile page.
 */
export const DEFAULT_STATE: AppState = {
  rev: 0,
  schemaVersion: SCHEMA_VERSION,
  foods: [],
  rawItems: [],
  recipes: [],
  suppliers: [],
  dailyLog: [],
  activityLog: [],
  pin: '',
  onboardingSeen: false,
  darkMode: false,
  autoLockMinutes: 5,
  userName: 'Manager',
  scrambleKeypad: false,
  privacyBlur: false,
  panicWipeEnabled: false,
  currency: '$',
  favorites: [],
  themeMode: 'system',
  recentSearches: [],
  setupDismissed: false,
};

/**
 * Demo/sample dataset for the "Try a demo" onboarding path. Contains no real
 * business data — everything is generic and clearly labelled as sample data.
 */
export const DEMO_STATE: Omit<AppState, 'pin' | 'onboardingSeen' | 'rev' | 'schemaVersion'> = {
  foods: [
    { name: 'Croissant', icon: '🥐', category: 'Pastry' },
    { name: 'Chocolate Muffin', icon: '🧁', category: 'Pastry' },
    { name: 'Sourdough Loaf', icon: '🍞', category: 'Bread' },
  ],
  rawItems: [
    { name: 'Flour', icon: '🌾', unit: 'kg', parLevel: 20, currentStock: 6.5, costPerUnit: 1.2 },
    { name: 'Butter', icon: '🧈', unit: 'kg', parLevel: 8, currentStock: 1.2, costPerUnit: 6.5 },
    { name: 'Sugar', icon: '🍬', unit: 'kg', parLevel: 10, currentStock: 12, costPerUnit: 0.9 },
    { name: 'Eggs', icon: '🥚', unit: 'pcs', parLevel: 60, currentStock: 42, costPerUnit: 0.25 },
    { name: 'Cocoa', icon: '🍫', unit: 'kg', parLevel: 3, currentStock: 0, costPerUnit: 8 },
    { name: 'Yeast', icon: '🫧', unit: 'pcs', parLevel: 10, currentStock: 14, costPerUnit: 0.8 },
  ],
  recipes: [
    {
      foodName: 'Croissant',
      ingredients: [
        { itemName: 'Flour', qty: 0.08 },
        { itemName: 'Butter', qty: 0.05 },
        { itemName: 'Yeast', qty: 0.2 },
      ],
    },
    {
      foodName: 'Chocolate Muffin',
      ingredients: [
        { itemName: 'Flour', qty: 0.06 },
        { itemName: 'Sugar', qty: 0.04 },
        { itemName: 'Eggs', qty: 1 },
        { itemName: 'Cocoa', qty: 0.02 },
      ],
    },
    {
      foodName: 'Sourdough Loaf',
      ingredients: [
        { itemName: 'Flour', qty: 0.5 },
        { itemName: 'Yeast', qty: 0.5 },
      ],
    },
  ],
  suppliers: [
    { name: 'Mill Co.', phone: '15550001111', items: ['Flour', 'Sugar'] },
    { name: 'Dairy Direct', phone: '15550002222', items: ['Butter', 'Eggs'] },
  ],
  dailyLog: [],
  activityLog: [],
  darkMode: false,
  autoLockMinutes: 5,
  userName: 'Manager',
  scrambleKeypad: false,
  privacyBlur: false,
  panicWipeEnabled: false,
  currency: '$',
  favorites: ['Croissant', 'Sourdough Loaf'],
  themeMode: 'system',
  recentSearches: [],
  setupDismissed: false,
};
