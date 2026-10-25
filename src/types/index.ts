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
  pin: string;
  onboardingSeen: boolean;
  darkMode: boolean;
  autoLockMinutes: number;
  userName: string;
}

export type Page = 'home' | 'manage' | 'restock' | 'profile';

export const DEFAULT_STATE: AppState = {
  foods: [
    { name: 'Croissant', icon: '🥐', category: 'Pastries' },
    { name: 'Baguette', icon: '🥖', category: 'Breads' },
    { name: 'Chocolate Cake', icon: '🍰', category: 'Cakes' },
    { name: 'Muffin', icon: '🧁', category: 'Pastries' },
  ],
  rawItems: [
    { name: 'All-Purpose Flour', icon: '🌾', unit: 'kg', parLevel: 20, currentStock: 45 },
    { name: 'Unsalted Butter', icon: '🧈', unit: 'kg', parLevel: 10, currentStock: 5 },
    { name: 'Sugar', icon: '🍬', unit: 'kg', parLevel: 15, currentStock: 18 },
    { name: 'Vanilla Extract', icon: '🧪', unit: 'btl', parLevel: 3, currentStock: 0 },
    { name: 'Active Dry Yeast', icon: '🫧', unit: 'pkg', parLevel: 10, currentStock: 12 },
  ],
  recipes: [
    { foodName: 'Croissant', ingredients: [{ itemName: 'All-Purpose Flour', qty: 0.2 }, { itemName: 'Unsalted Butter', qty: 0.05 }, { itemName: 'Sugar', qty: 0.02 }] },
    { foodName: 'Baguette', ingredients: [{ itemName: 'All-Purpose Flour', qty: 0.3 }, { itemName: 'Active Dry Yeast', qty: 0.01 }] },
    { foodName: 'Chocolate Cake', ingredients: [{ itemName: 'All-Purpose Flour', qty: 0.25 }, { itemName: 'Unsalted Butter', qty: 0.15 }, { itemName: 'Sugar', qty: 0.2 }] },
    { foodName: 'Muffin', ingredients: [{ itemName: 'All-Purpose Flour', qty: 0.08 }, { itemName: 'Sugar', qty: 0.05 }, { itemName: 'Unsalted Butter', qty: 0.03 }] },
  ],
  suppliers: [
    { name: 'Bakery Supplies Co.', phone: '15551234567', items: ['All-Purpose Flour', 'Unsalted Butter', 'Sugar'] },
    { name: 'Spice World', phone: '15559876543', items: ['Vanilla Extract', 'Active Dry Yeast'] },
  ],
  dailyLog: [],
  activityLog: [],
  pin: '',
  onboardingSeen: false,
  darkMode: false,
  autoLockMinutes: 5,
  userName: 'Manager',
};
