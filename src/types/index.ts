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

/** A shopping / to-buy list item, independent from inventory logging. */
export interface ShoppingItem {
  id: string;
  text: string;
  qty?: string;
  done: boolean;
  addedAt: number;
}

export interface RecipeIngredient {
  itemName: string;
  qty: number;
}

export interface Recipe {
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
}

export interface AppState {
  foods: Food[];
  rawItems: RawItem[];
  recipes: Recipe[];
  suppliers: Supplier[];
  dailyLog: DailyLogEntry[];
  activityLog: ActivityEntry[];
  shoppingList: ShoppingItem[];
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

export type Page = 'home' | 'manage' | 'restock' | 'shopping' | 'profile';

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
  shoppingList: [],
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
