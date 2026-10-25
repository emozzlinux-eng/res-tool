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

export interface AppState {
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
};
