import React, { useState, useEffect, useCallback, useRef, createContext, useContext, useMemo } from 'react';
import { Home, ClipboardList, Package, User, Lock, Unlock, Search, X, Plus, Minus, Trash2, ChevronRight, Moon, Sun, Download, Upload, AlertTriangle, Check, RotateCcw, Send, Eye, EyeOff } from 'lucide-react';
import { AppState, Food, RawItem, Recipe, Supplier, DailyLogEntry, ActivityEntry, Page, DEFAULT_STATE, RecipeIngredient } from './types';

// ============ UTILITIES ============
const sanitize = (str: string): string => {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

const generateId = (): string => {
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
};

const hashPin = (pin: string): string => {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `h_${Math.abs(hash).toString(36)}_${pin.length}`;
};

const verifyPin = (pin: string, storedHash: string): boolean => {
  if (!storedHash.startsWith('h_')) return false;
  return hashPin(pin) === storedHash;
};

const formatTimeAgo = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const getFormattedDate = (): string => {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

const getCurrentTime = (): string => {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

// ============ STORAGE ============
const STORAGE_KEY = 'inventoryPro_state';

const loadState = (): AppState => {
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

const saveState = (state: AppState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state:', e);
  }
};

// ============ CONTEXT ============
interface AppContextType {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  updateState: (updates: Partial<AppState>) => void;
  showToast: (msg: string) => void;
  isOnline: boolean;
}

const AppContext = createContext<AppContextType>({} as AppContextType);
const useApp = () => useContext(AppContext);

// ============ SPARKLINE COMPONENT ============
const Sparkline: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
  if (data.length < 2) return <svg className="sparkline" />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 58 + 1;
    const y = 22 - ((v - min) / range) * 20;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg className="sparkline" viewBox="0 0 60 24">
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
};

// ============ PIN SCREEN ============
const PinScreen: React.FC<{ mode: 'setup' | 'confirm' | 'verify' | 'change-old' | 'change-new' | 'change-confirm'; onComplete: (pin: string) => void; onError?: () => void; existingHash?: string }> = ({ mode, onComplete, onError, existingHash }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lockout, setLockout] = useState(0);

  const titles: Record<string, string> = {
    'setup': 'Create Your PIN',
    'confirm': 'Confirm Your PIN',
    'verify': 'Enter Your PIN',
    'change-old': 'Enter Current PIN',
    'change-new': 'Create New PIN',
    'change-confirm': 'Confirm New PIN',
  };

  const subtitles: Record<string, string> = {
    'setup': 'Choose a 6-digit PIN to secure your app',
    'confirm': 'Enter the same PIN again to confirm',
    'verify': 'Unlock Inventory Pro',
    'change-old': 'Verify your identity',
    'change-new': 'Choose a new 6-digit PIN',
    'change-confirm': 'Enter the new PIN again',
  };

  useEffect(() => {
    if (lockout > 0) {
      const timer = setTimeout(() => setLockout(lockout - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [lockout]);

  const handleKey = (key: string) => {
    if (lockout > 0) return;
    if (key === 'backspace') {
      setPin(p => p.slice(0, -1));
      setError('');
      return;
    }
    if (pin.length >= 6) return;
    const newPin = pin + key;
    setPin(newPin);
    setError('');

    if (newPin.length === 6) {
      setTimeout(() => {
        if (mode === 'verify' || mode === 'change-old') {
          if (existingHash && verifyPin(newPin, existingHash)) {
            onComplete(newPin);
          } else {
            const newAttempts = attempts + 1;
            setAttempts(newAttempts);
            if (newAttempts >= 5) {
              setLockout(30);
              setAttempts(0);
              setError('Too many attempts. Locked for 30s.');
            } else {
              setError(`Wrong PIN. ${5 - newAttempts} attempts left.`);
            }
            setPin('');
            onError?.();
          }
        } else {
          onComplete(newPin);
        }
      }, 200);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-6" style={{ background: 'var(--bg)' }}>
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ background: 'var(--primary)' }}>
        <Lock size={28} color="white" />
      </div>
      <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-main)' }}>{titles[mode]}</h1>
      <p className="text-sm mb-8 text-center" style={{ color: 'var(--text-sub)' }}>{subtitles[mode]}</p>
      
      <div className="pin-dots mb-4">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`} />
        ))}
      </div>
      
      {error && <p className="text-xs mb-4" style={{ color: 'var(--danger)' }}>{error}</p>}
      {lockout > 0 && <p className="text-xs mb-4" style={{ color: 'var(--warning)' }}>Locked: {lockout}s</p>}
      
      <div className="pin-pad mt-6">
        {['1','2','3','4','5','6','7','8','9'].map(k => (
          <button key={k} className="pin-key" onClick={() => handleKey(k)} aria-label={`Key ${k}`}>{k}</button>
        ))}
        <button className="pin-key" onClick={() => {}} aria-label="Biometric" style={{ fontSize: '18px' }}>🔓</button>
        <button className="pin-key" onClick={() => handleKey('0')} aria-label="Key 0">0</button>
        <button className="pin-key" onClick={() => handleKey('backspace')} aria-label="Backspace" style={{ fontSize: '18px' }}>⌫</button>
      </div>
    </div>
  );
};

// ============ ONBOARDING ============
const Onboarding: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [slide, setSlide] = useState(0);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);

  const slides = [
    { icon: '🎉', title: 'Welcome to Inventory Pro', features: ['Works 100% offline', '6-digit PIN security', 'Cloud sync ready'] },
    { icon: '🧮', title: 'Smart Recipe Tracking', features: ['Log 20 Croissants', 'Auto-deducts 4kg flour', 'Auto-deducts 1kg butter'] },
    { icon: '📝', title: 'Daily Workflow', features: ['🟢 Output finished goods', '🔴 Log waste & losses', '🔵 Restock ingredients'] },
    { icon: '📲', title: 'Smart Ordering', features: ['Low-stock alerts', 'Auto shopping list', 'WhatsApp integration'] },
    { icon: '🔐', title: "Let's Get Started", features: ['Set up your PIN', 'Secure your data', 'Start managing inventory'] },
  ];

  const current = slides[slide];

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>
      <div className="flex justify-between items-center p-4">
        <button onClick={() => setShowSkipConfirm(true)} className="text-sm font-medium" style={{ color: 'var(--text-sub)' }}>Skip</button>
        <div className="flex gap-2">
          {slides.map((_, i) => (
            <div key={i} className="w-2 h-2 rounded-full transition-all" style={{ background: i === slide ? 'var(--primary)' : 'var(--border)' }} />
          ))}
        </div>
        <div className="w-10" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="text-6xl mb-8">{current.icon}</div>
        <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: 'var(--text-main)' }}>{current.title}</h2>
        <div className="space-y-3 w-full">
          {current.features.map((f, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <Check size={16} style={{ color: 'var(--success)' }} />
              <span className="text-sm" style={{ color: 'var(--text-main)' }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 flex gap-3">
        {slide > 0 && (
          <button onClick={() => setSlide(s => s - 1)} className="btn btn-outline flex-1">Back</button>
        )}
        <button onClick={() => {
          if (slide < slides.length - 1) setSlide(s => s + 1);
          else onComplete();
        }} className="btn btn-primary flex-1">
          {slide === slides.length - 1 ? 'Get Started' : 'Next'}
        </button>
      </div>

      {showSkipConfirm && (
        <div className="modal-overlay" onClick={() => setShowSkipConfirm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-main)' }}>Skip Onboarding?</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-sub)' }}>You can replay the tutorial later from Profile.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowSkipConfirm(false)} className="btn btn-outline flex-1">Cancel</button>
              <button onClick={onComplete} className="btn btn-primary flex-1">Skip</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ TOAST ============
const Toast: React.FC<{ message: string; visible: boolean }> = ({ message, visible }) => {
  if (!visible) return null;
  return <div className="toast">{message}</div>;
};

// ============ HOME PAGE ============
const HomePage: React.FC = () => {
  const { state } = useApp();
  const [showReminder, setShowReminder] = useState(true);

  const lowStockItems = state.rawItems.filter(item => item.currentStock < item.parLevel);
  
  const todayOutputs = state.dailyLog.filter(e => e.type === 'output');
  const todayWaste = state.dailyLog.filter(e => e.type === 'waste');
  const todayRestocks = state.dailyLog.filter(e => e.type === 'restock');

  const stats = [
    { icon: '📦', label: 'Outputs Today', value: todayOutputs.length.toString(), color: '#10B981', trend: '+12%', data: [3, 5, 2, 7, 4, 6, todayOutputs.length] },
    { icon: '🗑️', label: 'Waste Today', value: todayWaste.length.toString(), color: '#EF4444', trend: '-5%', data: [1, 2, 0, 3, 1, 2, todayWaste.length] },
    { icon: '📥', label: 'Restocks', value: todayRestocks.length.toString(), color: '#3B82F6', trend: '+8%', data: [2, 1, 3, 2, 4, 1, todayRestocks.length] },
    { icon: '📊', label: 'Items Tracked', value: state.rawItems.length.toString(), color: '#8B5CF6', trend: '0%', data: [5, 5, 5, 5, 5, 5, state.rawItems.length] },
  ];

  const ingredientUsage = state.rawItems.slice(0, 4).map(item => {
    const pct = item.parLevel > 0 ? Math.min(100, (item.currentStock / item.parLevel) * 100) : 0;
    return { ...item, pct };
  });

  return (
    <div className="page-content">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>{getGreeting()}, {state.userName}</h1>
          <p className="text-xs" style={{ color: 'var(--text-sub)' }}>{getFormattedDate()}</p>
        </div>
        <button className="btn btn-ghost" style={{ padding: '8px' }} aria-label="Export">
          <Download size={20} />
        </button>
      </div>

      {/* Reminder Banner */}
      {showReminder && lowStockItems.length > 0 && (
        <div className="card mb-4 flex items-start gap-3" style={{ borderLeft: '4px solid var(--warning)', background: 'var(--surface)' }}>
          <AlertTriangle size={18} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 2 }} />
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>{lowStockItems.length} items below par level</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-sub)' }}>Check Restock tab to generate orders</p>
          </div>
          <button onClick={() => setShowReminder(false)} aria-label="Dismiss" style={{ color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {stats.map((stat, i) => (
          <div key={i} className="card">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: `${stat.color}15` }}>
                {stat.icon}
              </div>
              <span className="text-xs font-medium" style={{ color: stat.trend.startsWith('+') ? 'var(--success)' : stat.trend.startsWith('-') ? 'var(--danger)' : 'var(--text-muted)' }}>
                {stat.trend}
              </span>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>{stat.value}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-sub)' }}>{stat.label}</p>
            <div className="mt-2">
              <Sparkline data={stat.data} color={stat.color} />
            </div>
          </div>
        ))}
      </div>

      {/* Low Stock Alerts */}
      {lowStockItems.length > 0 && (
        <div className="card mb-4" style={{ borderLeft: '4px solid var(--warning)' }}>
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-main)' }}>
            <AlertTriangle size={14} style={{ color: 'var(--warning)' }} /> Low Stock Alerts
          </h3>
          <div className="space-y-2">
            {lowStockItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-1">
                <span className="text-sm flex items-center gap-2" style={{ color: 'var(--text-main)' }}>
                  <span>{item.icon}</span> {item.name}
                </span>
                <span className="text-xs font-medium" style={{ color: 'var(--danger)' }}>
                  Need {(item.parLevel - item.currentStock).toFixed(1)} {item.unit}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ingredient Usage */}
      <div className="card mb-4">
        <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-main)' }}>Ingredient Usage</h3>
        <div className="space-y-3">
          {ingredientUsage.map((item, i) => {
            const barColor = item.pct > 70 ? 'var(--success)' : item.pct > 30 ? 'var(--warning)' : 'var(--danger)';
            return (
              <div key={i}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs" style={{ color: 'var(--text-sub)' }}>{item.icon} {item.name}</span>
                  <span className="text-xs font-medium" style={{ color: 'var(--text-main)' }}>{item.currentStock}/{item.parLevel} {item.unit}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${item.pct}%`, background: barColor }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-main)' }}>Recent Activity</h3>
        {state.activityLog.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>No activity yet</p>
        ) : (
          <div className="space-y-2">
            {state.activityLog.slice(-5).reverse().map((entry, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                <span className="text-sm" style={{ color: 'var(--text-main)' }}>{entry.action}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatTimeAgo(entry.time)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ============ MANAGE PAGE ============
const ManagePage: React.FC = () => {
  const { state, updateState, showToast } = useApp();
  const [segment, setSegment] = useState<'output' | 'waste' | 'restock'>('output');
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [qty, setQty] = useState(1);
  const [scale, setScale] = useState(1);
  const [reason, setReason] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  const pickerItems = useMemo(() => {
    if (segment === 'output') return state.foods;
    return state.rawItems;
  }, [segment, state.foods, state.rawItems]);

  const filteredPickerItems = useMemo(() => {
    if (!pickerSearch) return pickerItems;
    return pickerItems.filter(item => item.name.toLowerCase().includes(pickerSearch.toLowerCase()));
  }, [pickerItems, pickerSearch]);

  const recipe = useMemo(() => {
    if (segment !== 'output' || !selectedItem) return null;
    return state.recipes.find(r => r.foodName === selectedItem);
  }, [segment, selectedItem, state.recipes]);

  const deductionPreview = useMemo(() => {
    if (!recipe) return [];
    return recipe.ingredients.map(ing => ({
      name: ing.itemName,
      amount: ing.qty * qty * scale,
      unit: state.rawItems.find(r => r.name === ing.itemName)?.unit || ''
    }));
  }, [recipe, qty, scale, state.rawItems]);

  const todayLog = state.dailyLog.filter(e => {
    const today = new Date().toDateString();
    return new Date(e.timestamp).toDateString() === today;
  });

  const handleSave = () => {
    if (!selectedItem || qty <= 0) return;
    if (qty >= 50 && segment === 'output' && !showConfirm) {
      setShowConfirm(true);
      return;
    }

    setSaving(true);
    setTimeout(() => {
      const snapshot = JSON.parse(JSON.stringify(state.rawItems));
      const icon = segment === 'output' 
        ? state.foods.find(f => f.name === selectedItem)?.icon || '📦'
        : state.rawItems.find(r => r.name === selectedItem)?.icon || '📦';

      const logEntry: DailyLogEntry = {
        id: generateId(),
        type: segment,
        icon,
        name: selectedItem,
        qty: segment === 'output' ? `+ ${qty}` : segment === 'waste' ? `- ${qty}` : `+ ${qty}`,
        time: getCurrentTime(),
        timestamp: Date.now(),
        reason: segment === 'waste' ? reason : undefined,
      };

      const newRawItems = [...state.rawItems];

      if (segment === 'output' && recipe) {
        recipe.ingredients.forEach(ing => {
          const idx = newRawItems.findIndex(r => r.name === ing.itemName);
          if (idx >= 0) {
            newRawItems[idx] = { ...newRawItems[idx], currentStock: Math.max(0, newRawItems[idx].currentStock - (ing.qty * qty * scale)) };
          }
        });
      } else if (segment === 'waste') {
        const idx = newRawItems.findIndex(r => r.name === selectedItem);
        if (idx >= 0) {
          newRawItems[idx] = { ...newRawItems[idx], currentStock: Math.max(0, newRawItems[idx].currentStock - qty) };
        }
      } else if (segment === 'restock') {
        const idx = newRawItems.findIndex(r => r.name === selectedItem);
        if (idx >= 0) {
          newRawItems[idx] = { ...newRawItems[idx], currentStock: newRawItems[idx].currentStock + qty };
        }
      }

      const activityEntry: ActivityEntry = {
        action: `${segment === 'output' ? 'Output' : segment === 'waste' ? 'Waste' : 'Restock'}: ${qty} ${selectedItem}`,
        time: Date.now(),
      };

      updateState({
        rawItems: newRawItems,
        dailyLog: [...state.dailyLog, logEntry],
        activityLog: [...state.activityLog, activityEntry],
      });

      setSaving(false);
      setSelectedItem('');
      setQty(1);
      setReason('');
      showToast(`${segment === 'output' ? 'Output' : segment === 'waste' ? 'Waste' : 'Restock'} logged!`);
    }, 300);
  };

  const handleDelete = (id: string) => {
    updateState({ dailyLog: state.dailyLog.filter(e => e.id !== id) });
    showToast('Entry deleted');
  };

  const segmentTitles = { output: 'Log Output', waste: 'Log Waste', restock: 'Restock Item' };
  const segmentGuide = {
    output: 'Select a food item. Ingredients will be auto-deducted based on the recipe.',
    waste: 'Select a raw item to log waste. Deducted directly from stock.',
    restock: 'Select a raw item to add stock. Added directly to inventory.',
  };

  return (
    <div className="page-content">
      <h1 className="text-xl font-bold mb-4" style={{ color: 'var(--text-main)' }}>Manage</h1>

      {/* Segment Control */}
      <div className="segment-control mb-4">
        {(['output', 'waste', 'restock'] as const).map(s => (
          <button key={s} className={`segment-btn ${segment === s ? 'active' : ''}`} onClick={() => { setSegment(s); setSelectedItem(''); setQty(1); setReason(''); }}>
            {s === 'output' ? '🟢 Output' : s === 'waste' ? '🔴 Waste' : '🔵 Restock'}
          </button>
        ))}
      </div>

      {/* Entry Card */}
      <div className="card mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>{segmentTitles[segment]}</h3>
          <button className="chip text-xs" onClick={() => setBulkMode(!bulkMode)} style={bulkMode ? { background: 'var(--primary-light)', borderColor: 'var(--primary)', color: 'var(--primary)' } : {}}>
            + Bulk
          </button>
        </div>

        {/* Item Selector */}
        <button className="input flex items-center justify-between mb-3 text-left" onClick={() => setShowPicker(true)} style={{ cursor: 'pointer' }}>
          <span style={{ color: selectedItem ? 'var(--text-main)' : 'var(--text-muted)' }}>
            {selectedItem || 'Select item...'}
          </span>
          <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
        </button>

        {/* Logic Guide */}
        <div className="p-3 rounded-lg mb-3" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
          <p className="text-xs" style={{ color: '#1E40AF' }}>💡 {segmentGuide[segment]}</p>
        </div>

        {/* Recipe Scale - Output only */}
        {segment === 'output' && (
          <div className="mb-3">
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-sub)' }}>Recipe Scale</p>
            <div className="flex gap-2">
              {[0.5, 1, 2].map(s => (
                <button key={s} className={`chip ${scale === s ? 'active' : ''}`} onClick={() => setScale(s)}>{s}x</button>
              ))}
            </div>
          </div>
        )}

        {/* Quick Add - Output only */}
        {segment === 'output' && (
          <div className="mb-3">
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-sub)' }}>Quick Add</p>
            <div className="flex gap-2">
              {[{ label: 'Dozen', val: 12 }, { label: 'Tray', val: 24 }, { label: 'Batch', val: 50 }].map(q => (
                <button key={q.label} className="chip" onClick={() => setQty(q.val)}>{q.label} ({q.val})</button>
              ))}
            </div>
          </div>
        )}

        {/* Waste Reason - Waste only */}
        {segment === 'waste' && (
          <div className="mb-3">
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-sub)' }}>Reason</p>
            <div className="flex gap-2 flex-wrap">
              {['Burned', 'Spoiled', 'Spilled', 'Expired'].map(r => (
                <button key={r} className={`chip ${reason === r ? 'active' : ''}`} onClick={() => setReason(r)}>{r}</button>
              ))}
            </div>
          </div>
        )}

        {/* Auto-Deduction Preview - Output only */}
        {segment === 'output' && deductionPreview.length > 0 && (
          <div className="p-3 rounded-lg mb-3" style={{ background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
            <p className="text-xs font-medium mb-2" style={{ color: '#065F46' }}>📊 Auto-Deduction Preview</p>
            {deductionPreview.map((d, i) => (
              <p key={i} className="text-xs" style={{ color: '#065F46' }}>• {d.name}: -{d.amount.toFixed(2)} {d.unit}</p>
            ))}
          </div>
        )}

        {/* Quantity Stepper */}
        <div className="qty-stepper mb-4">
          <button className="qty-btn" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Decrease">−</button>
          <span className="qty-value">{qty}</span>
          <button className="qty-btn" onClick={() => setQty(qty + 1)} aria-label="Increase">+</button>
        </div>

        {/* Save Button */}
        <button className="btn btn-primary w-full" onClick={handleSave} disabled={!selectedItem || saving || qty <= 0}>
          {saving ? 'Saving...' : `Save ${segment === 'output' ? 'Output' : segment === 'waste' ? 'Waste' : 'Restock'}`}
        </button>
      </div>

      {/* Today's Log */}
      <div className="card">
        <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-main)' }}>Today's Log ({todayLog.length})</h3>
        {todayLog.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>No entries today</p>
        ) : (
          <div className="space-y-2">
            {todayLog.slice().reverse().map(entry => (
              <div key={entry.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <span className="text-lg">{entry.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-main)' }}>
                    {entry.name} {entry.reason && <span style={{ color: 'var(--text-sub)' }}>({entry.reason})</span>}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{entry.time} · {entry.type}</p>
                </div>
                <span className="text-sm font-bold" style={{ color: entry.type === 'waste' ? 'var(--danger)' : 'var(--success)' }}>{entry.qty}</span>
                <button onClick={() => handleDelete(entry.id)} className="p-2 rounded-lg" style={{ color: 'var(--text-muted)' }} aria-label="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Item Picker Bottom Sheet */}
      {showPicker && (
        <>
          <div className="bottom-sheet-overlay" onClick={() => setShowPicker(false)} />
          <div className="bottom-sheet p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Select {segment === 'output' ? 'Food' : 'Raw Item'}</h3>
              <button onClick={() => setShowPicker(false)} aria-label="Close"><X size={20} style={{ color: 'var(--text-muted)' }} /></button>
            </div>
            <div className="relative mb-3">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input className="input pl-9" placeholder="Search..." value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} />
            </div>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {filteredPickerItems.map((item, i) => (
                <button key={i} className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all" style={{ background: selectedItem === item.name ? 'var(--primary-light)' : 'transparent' }} onClick={() => { setSelectedItem(item.name); setShowPicker(false); setPickerSearch(''); }}>
                  <span className="text-xl">{item.icon}</span>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>{item.name}</p>
                    {segment !== 'output' && <p className="text-xs" style={{ color: 'var(--text-sub)' }}>Stock: {(item as RawItem).currentStock} {(item as RawItem).unit}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Large Output Confirmation */}
      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <AlertTriangle size={32} className="mx-auto mb-3" style={{ color: 'var(--warning)' }} />
            <h3 className="text-lg font-bold mb-2 text-center" style={{ color: 'var(--text-main)' }}>Large Output</h3>
            <p className="text-sm mb-4 text-center" style={{ color: 'var(--text-sub)' }}>You're about to output {qty} units. This will deduct significant ingredients. Continue?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="btn btn-outline flex-1">Cancel</button>
              <button onClick={() => { setShowConfirm(false); handleSave(); }} className="btn btn-primary flex-1">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ RESTOCK PAGE ============
const RestockPage: React.FC = () => {
  const { state } = useApp();
  const [search, setSearch] = useState('');
  const [showOrders, setShowOrders] = useState(false);
  const [showPreview, setShowPreview] = useState<string | null>(null);

  const filteredItems = state.rawItems.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const getStockBadge = (item: RawItem) => {
    if (item.currentStock <= 0) return { label: 'Out', class: 'badge-danger' };
    if (item.currentStock < item.parLevel) return { label: 'Low', class: 'badge-warning' };
    return { label: 'Good', class: 'badge-success' };
  };

  const generateOrders = () => {
    const lowItems = state.rawItems.filter(item => item.currentStock < item.parLevel);
    const orders: Record<string, { supplier: Supplier; items: { name: string; needed: number; unit: string }[] }> = {};
    
    lowItems.forEach(item => {
      const supplier = state.suppliers.find(s => s.items.includes(item.name));
      if (supplier) {
        if (!orders[supplier.name]) {
          orders[supplier.name] = { supplier, items: [] };
        }
        orders[supplier.name].items.push({
          name: item.name,
          needed: item.parLevel - item.currentStock,
          unit: item.unit,
        });
      }
    });
    
    return orders;
  };

  const orders = generateOrders();

  const sendWhatsApp = (supplier: Supplier, items: { name: string; needed: number; unit: string }[]) => {
    const msg = `Hi ${supplier.name}, I'd like to order:\n\n${items.map(i => `• ${i.name}: ${i.needed.toFixed(1)} ${i.unit}`).join('\n')}\n\nThank you!`;
    const url = `https://wa.me/${supplier.phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="page-content">
      <div className="card mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Inventory</h2>
          <button className="btn btn-primary text-xs" style={{ padding: '8px 12px', minHeight: '36px' }} onClick={() => setShowOrders(!showOrders)}>
            {showOrders ? 'Hide' : 'Generate'} Orders
          </button>
        </div>

        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input className="input pl-9" placeholder="Search inventory..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="space-y-2">
          {filteredItems.map((item, i) => {
            const badge = getStockBadge(item);
            return (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <span className="text-xl">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>{item.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-sub)' }}>Par: {item.parLevel} {item.unit}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>{item.currentStock.toFixed(1)}</p>
                  <span className={`badge ${badge.class}`}>{badge.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Supplier Orders */}
      {showOrders && (
        <div className="card">
          <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-main)' }}>Supplier Orders</h3>
          {Object.keys(orders).length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>All items are well stocked! 🎉</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(orders).map(([name, order]) => (
                <div key={name} className="p-3 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>{order.supplier.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-sub)' }}>{order.supplier.phone}</p>
                    </div>
                  </div>
                  <div className="space-y-1 mb-3">
                    {order.items.map((item, i) => (
                      <p key={i} className="text-xs" style={{ color: 'var(--text-main)' }}>• {item.name}: {item.needed.toFixed(1)} {item.unit}</p>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-outline text-xs flex-1" style={{ padding: '6px', minHeight: '32px' }} onClick={() => setShowPreview(name)}>
                      <Eye size={12} /> Preview
                    </button>
                    <button className="btn btn-primary text-xs flex-1" style={{ padding: '6px', minHeight: '32px' }} onClick={() => sendWhatsApp(order.supplier, order.items)}>
                      <Send size={12} /> Send Order
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Order Preview Modal */}
      {showPreview && orders[showPreview] && (
        <div className="modal-overlay" onClick={() => setShowPreview(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-3" style={{ color: 'var(--text-main)' }}>Order Preview</h3>
            <div className="p-3 rounded-lg mb-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <p className="text-xs whitespace-pre-wrap" style={{ color: 'var(--text-main)' }}>
                {`Hi ${orders[showPreview].supplier.name}, I'd like to order:\n\n${orders[showPreview].items.map(i => `• ${i.name}: ${i.needed.toFixed(1)} ${i.unit}`).join('\n')}\n\nThank you!`}
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowPreview(null)} className="btn btn-outline flex-1">Close</button>
              <button onClick={() => { sendWhatsApp(orders[showPreview].supplier, orders[showPreview].items); setShowPreview(null); }} className="btn btn-primary flex-1">
                <Send size={14} /> Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ PROFILE PAGE ============
const ProfilePage: React.FC<{ onLock: () => void; onReplayOnboarding: () => void }> = ({ onLock, onReplayOnboarding }) => {
  const { state, updateState, showToast } = useApp();
  const [showSection, setShowSection] = useState<string | null>(null);
  const [showChangePin, setShowChangePin] = useState(false);
  const [pinStep, setPinStep] = useState<'old' | 'new' | 'confirm'>('old');
  const [tempPin, setTempPin] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showMasterData, setShowMasterData] = useState<string | null>(null);

  const handleBackup = () => {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-pro-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup exported!');
  };

  const handleRestore = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (data.foods && data.rawItems && data.recipes) {
            updateState(data);
            showToast('Backup restored!');
          } else {
            showToast('Invalid backup file');
          }
        } catch {
          showToast('Failed to parse backup');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleReset = () => {
    localStorage.clear();
    updateState({ ...DEFAULT_STATE });
    setShowResetConfirm(false);
    showToast('All data reset');
  };

  const toggleDarkMode = () => {
    updateState({ darkMode: !state.darkMode });
    document.documentElement.classList.toggle('dark');
  };

  const menuSections = {
    security: [
      { label: 'Change PIN', icon: '🔐', action: () => { setShowChangePin(true); setPinStep('old'); } },
      { label: 'Auto-Lock Timer', icon: '⏱️', action: () => setShowSection('autoLock') },
      { label: 'App Tutorial', icon: '🎓', action: onReplayOnboarding },
    ],
    masterData: [
      { label: 'Manage Foods', icon: '🍞', count: state.foods.length, action: () => setShowMasterData('foods') },
      { label: 'Manage Recipes', icon: '📋', count: state.recipes.length, action: () => setShowMasterData('recipes') },
      { label: 'Manage Raw Items', icon: '📦', count: state.rawItems.length, action: () => setShowMasterData('rawItems') },
      { label: 'Manage Suppliers', icon: '🏪', count: state.suppliers.length, action: () => setShowMasterData('suppliers') },
    ],
    data: [
      { label: 'Dark Mode', icon: state.darkMode ? '☀️' : '🌙', toggle: true, action: toggleDarkMode },
      { label: 'Backup Data', icon: '💾', action: handleBackup },
      { label: 'Restore Backup', icon: '📂', action: handleRestore },
      { label: 'Reset All Data', icon: '🗑️', danger: true, action: () => setShowResetConfirm(true) },
    ],
  };

  return (
    <div className="page-content">
      {/* Profile Header */}
      <div className="rounded-2xl p-6 mb-4 text-center" style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}>
        <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl" style={{ background: 'rgba(255,255,255,0.2)' }}>
          👤
        </div>
        <h2 className="text-lg font-bold text-white">{state.userName}</h2>
        <p className="text-sm text-white/70">Store Manager</p>
      </div>

      {/* Security Section */}
      <div className="card mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Security</h3>
        {menuSections.security.map((item, i) => (
          <button key={i} className="w-full flex items-center gap-3 py-3 border-b last:border-0 text-left" style={{ borderColor: 'var(--border)' }} onClick={item.action}>
            <span className="text-lg">{item.icon}</span>
            <span className="flex-1 text-sm" style={{ color: 'var(--text-main)' }}>{item.label}</span>
            <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
          </button>
        ))}
      </div>

      {/* Master Data Section */}
      <div className="card mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Master Data</h3>
        {menuSections.masterData.map((item, i) => (
          <button key={i} className="w-full flex items-center gap-3 py-3 border-b last:border-0 text-left" style={{ borderColor: 'var(--border)' }} onClick={item.action}>
            <span className="text-lg">{item.icon}</span>
            <span className="flex-1 text-sm" style={{ color: 'var(--text-main)' }}>{item.label}</span>
            <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>{item.count}</span>
            <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
          </button>
        ))}
      </div>

      {/* Data & Preferences */}
      <div className="card mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Data & Preferences</h3>
        {menuSections.data.map((item, i) => (
          <button key={i} className="w-full flex items-center gap-3 py-3 border-b last:border-0 text-left" style={{ borderColor: 'var(--border)' }} onClick={item.action}>
            <span className="text-lg">{item.icon}</span>
            <span className="flex-1 text-sm" style={{ color: (item as any).danger ? 'var(--danger)' : 'var(--text-main)' }}>{item.label}</span>
            {!(item as any).danger && <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />}
          </button>
        ))}
      </div>

      {/* About */}
      <div className="card mb-3">
        <div className="flex items-center justify-between py-2">
          <span className="text-sm" style={{ color: 'var(--text-sub)' }}>Version</span>
          <span className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>4.0.0</span>
        </div>
        <button className="w-full flex items-center gap-3 py-3 text-left" onClick={onLock}>
          <span className="text-lg">🔒</span>
          <span className="flex-1 text-sm" style={{ color: 'var(--danger)' }}>Lock App</span>
        </button>
      </div>

      {/* Change PIN Modal */}
      {showChangePin && (
        <div className="modal-overlay">
          <div className="modal-content">
            <PinScreen
              mode={pinStep === 'old' ? 'change-old' : pinStep === 'new' ? 'change-new' : 'change-confirm'}
              existingHash={state.pin}
              onComplete={(pin) => {
                if (pinStep === 'old') {
                  setTempPin(pin);
                  setPinStep('new');
                } else if (pinStep === 'new') {
                  setTempPin(pin);
                  setPinStep('confirm');
                } else {
                  if (pin === tempPin) {
                    updateState({ pin: hashPin(pin) });
                    setShowChangePin(false);
                    showToast('PIN changed!');
                  } else {
                    showToast('PINs do not match');
                    setPinStep('new');
                  }
                }
              }}
              onError={() => {}}
            />
            <button className="btn btn-ghost w-full mt-4" onClick={() => setShowChangePin(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Auto Lock Modal */}
      {showSection === 'autoLock' && (
        <div className="modal-overlay" onClick={() => setShowSection(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-main)' }}>Auto-Lock Timer</h3>
            <div className="space-y-2">
              {[1, 2, 5, 10, 15, 30].map(min => (
                <button key={min} className={`w-full p-3 rounded-lg text-left text-sm font-medium transition-all ${state.autoLockMinutes === min ? '' : ''}`}
                  style={{ background: state.autoLockMinutes === min ? 'var(--primary-light)' : 'var(--surface-2)', color: state.autoLockMinutes === min ? 'var(--primary)' : 'var(--text-main)', border: `1.5px solid ${state.autoLockMinutes === min ? 'var(--primary)' : 'var(--border)'}` }}
                  onClick={() => { updateState({ autoLockMinutes: min }); setShowSection(null); }}>
                  {min} minute{min > 1 ? 's' : ''}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Master Data Management */}
      {showMasterData && (
        <MasterDataManager type={showMasterData} onClose={() => setShowMasterData(null)} />
      )}

      {/* Reset Confirmation */}
      {showResetConfirm && (
        <div className="modal-overlay" onClick={() => setShowResetConfirm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <AlertTriangle size={32} className="mx-auto mb-3" style={{ color: 'var(--danger)' }} />
            <h3 className="text-lg font-bold mb-2 text-center" style={{ color: 'var(--text-main)' }}>Reset All Data?</h3>
            <p className="text-sm mb-4 text-center" style={{ color: 'var(--text-sub)' }}>This will delete all your data including foods, recipes, inventory, and settings. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowResetConfirm(false)} className="btn btn-outline flex-1">Cancel</button>
              <button onClick={handleReset} className="btn btn-danger flex-1">Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ MASTER DATA MANAGER ============
const MasterDataManager: React.FC<{ type: string; onClose: () => void }> = ({ type, onClose }) => {
  const { state, updateState, showToast } = useApp();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [showAdd, setShowAdd] = useState(false);

  const titles: Record<string, string> = { foods: 'Foods', recipes: 'Recipes', rawItems: 'Raw Items', suppliers: 'Suppliers' };

  const getItems = () => {
    switch (type) {
      case 'foods': return state.foods.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));
      case 'rawItems': return state.rawItems.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));
      case 'recipes': return state.recipes.filter(r => r.foodName.toLowerCase().includes(search.toLowerCase()));
      case 'suppliers': return state.suppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
      default: return [];
    }
  };

  const handleDelete = (index: number) => {
    const key = type as keyof AppState;
    const items = [...(state[key] as any[])];
    items.splice(index, 1);
    updateState({ [key]: items } as any);
    showToast('Deleted');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px', maxHeight: '80vh', overflow: 'auto' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>{titles[type]}</h3>
          <div className="flex gap-2">
            <button className="btn btn-primary text-xs" style={{ padding: '6px 10px', minHeight: '32px' }} onClick={() => setShowAdd(true)}>
              <Plus size={14} /> Add
            </button>
            <button onClick={onClose} aria-label="Close"><X size={20} style={{ color: 'var(--text-muted)' }} /></button>
          </div>
        </div>

        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input className="input pl-9" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="space-y-2">
          {getItems().map((item: any, i: number) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <span className="text-lg">{item.icon || '📋'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-main)' }}>
                  {item.name || item.foodName}
                </p>
                {type === 'rawItems' && <p className="text-xs" style={{ color: 'var(--text-sub)' }}>{item.currentStock} {item.unit} (par: {item.parLevel})</p>}
                {type === 'recipes' && <p className="text-xs" style={{ color: 'var(--text-sub)' }}>{item.ingredients.length} ingredients</p>}
                {type === 'suppliers' && <p className="text-xs" style={{ color: 'var(--text-sub)' }}>{item.items.length} items</p>}
              </div>
              <button onClick={() => handleDelete((state[type as keyof AppState] as any[]).indexOf(item))} className="p-2" style={{ color: 'var(--danger)' }} aria-label="Delete">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Add Form */}
        {showAdd && (
          <AddItemForm type={type} onClose={() => setShowAdd(false)} />
        )}
      </div>
    </div>
  );
};

// ============ ADD ITEM FORM ============
const AddItemForm: React.FC<{ type: string; onClose: () => void }> = ({ type, onClose }) => {
  const { state, updateState, showToast } = useApp();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📦');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('kg');
  const [parLevel, setParLevel] = useState(10);
  const [phone, setPhone] = useState('');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [selectedFoods, setSelectedFoods] = useState<string[]>([]);

  const handleSave = () => {
    if (!name.trim()) { showToast('Name is required'); return; }

    // Check for duplicates
    const existing = state[type as keyof AppState] as any[];
    const nameField = type === 'recipes' ? 'foodName' : 'name';
    if (existing.some((item: any) => (item[nameField] || item.name).toLowerCase() === name.toLowerCase())) {
      showToast('Name already exists');
      return;
    }

    switch (type) {
      case 'foods':
        updateState({ foods: [...state.foods, { name: name.trim(), icon, category: category.trim() }] });
        break;
      case 'rawItems':
        updateState({ rawItems: [...state.rawItems, { name: name.trim(), icon, unit, parLevel, currentStock: 0 }] });
        break;
      case 'recipes':
        if (ingredients.length === 0) { showToast('Add at least one ingredient'); return; }
        updateState({ recipes: [...state.recipes, { foodName: name.trim(), ingredients }] });
        break;
      case 'suppliers':
        if (!phone.trim() || phone.replace(/\D/g, '').length < 7) { showToast('Valid phone required'); return; }
        updateState({ suppliers: [...state.suppliers, { name: name.trim(), phone: phone.replace(/\D/g, ''), items: selectedFoods }] });
        break;
    }
    showToast('Added!');
    onClose();
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { itemName: '', qty: 0 }]);
  };

  const updateIngredient = (idx: number, field: string, value: any) => {
    const newIng = [...ingredients];
    newIng[idx] = { ...newIng[idx], [field]: value };
    setIngredients(newIng);
  };

  return (
    <div className="mt-4 p-4 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      <h4 className="text-sm font-bold mb-3" style={{ color: 'var(--text-main)' }}>
        Add {type === 'foods' ? 'Food' : type === 'rawItems' ? 'Raw Item' : type === 'recipes' ? 'Recipe' : 'Supplier'}
      </h4>

      <div className="space-y-3">
        <input className="input" placeholder={type === 'recipes' ? 'Food name' : 'Name'} value={name} onChange={e => setName(e.target.value)} />
        
        {type !== 'recipes' && (
          <div className="flex gap-2">
            <input className="input" placeholder="Icon (emoji)" value={icon} onChange={e => setIcon(e.target.value)} style={{ width: '80px' }} />
            {type === 'rawItems' && (
              <select className="input" value={unit} onChange={e => setUnit(e.target.value)} style={{ width: '100px' }}>
                <option value="kg">kg</option>
                <option value="btl">btl</option>
                <option value="pcs">pcs</option>
                <option value="pkg">pkg</option>
                <option value="L">L</option>
              </select>
            )}
            {type === 'foods' && (
              <input className="input" placeholder="Category" value={category} onChange={e => setCategory(e.target.value)} />
            )}
          </div>
        )}

        {type === 'rawItems' && (
          <input className="input" type="number" placeholder="Par Level" value={parLevel} onChange={e => setParLevel(Number(e.target.value))} />
        )}

        {type === 'suppliers' && (
          <input className="input" placeholder="Phone number" value={phone} onChange={e => setPhone(e.target.value)} />
        )}

        {type === 'recipes' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: 'var(--text-sub)' }}>Ingredients</span>
              <button className="text-xs font-medium" style={{ color: 'var(--primary)' }} onClick={addIngredient}>+ Add</button>
            </div>
            {ingredients.map((ing, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <select className="input text-xs" value={ing.itemName} onChange={e => updateIngredient(i, 'itemName', e.target.value)} style={{ flex: 2 }}>
                  <option value="">Select item</option>
                  {state.rawItems.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                </select>
                <input className="input text-xs" type="number" step="0.01" placeholder="Qty" value={ing.qty || ''} onChange={e => updateIngredient(i, 'qty', Number(e.target.value))} style={{ flex: 1 }} />
              </div>
            ))}
          </div>
        )}

        {type === 'suppliers' && (
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-sub)' }}>Items supplied</p>
            <div className="flex flex-wrap gap-1">
              {state.rawItems.map(r => (
                <button key={r.name} className={`chip text-xs ${selectedFoods.includes(r.name) ? 'active' : ''}`} onClick={() => {
                  setSelectedFoods(prev => prev.includes(r.name) ? prev.filter(x => x !== r.name) : [...prev, r.name]);
                }}>{r.name}</button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button className="btn btn-outline flex-1" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary flex-1" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
};

// ============ MAIN APP ============
const App: React.FC = () => {
  const [state, setState] = useState<AppState>(loadState);
  const [page, setPage] = useState<Page>('home');
  const [isLocked, setIsLocked] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [pinSetupStep, setPinSetupStep] = useState<'setup' | 'confirm'>('setup');
  const [tempPin, setTempPin] = useState('');
  const [toast, setToast] = useState({ msg: '', visible: false });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const lastActivity = useRef(Date.now());
  const toastTimer = useRef<any>(null);

  // Save state on change
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Dark mode
  useEffect(() => {
    if (state.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.darkMode]);

  // Online/Offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-lock
  useEffect(() => {
    const checkInactivity = () => {
      if (Date.now() - lastActivity.current > state.autoLockMinutes * 60 * 1000) {
        if (state.pin && !showOnboarding) {
          setIsLocked(true);
        }
      }
    };
    const interval = setInterval(checkInactivity, 10000);
    return () => clearInterval(interval);
  }, [state.autoLockMinutes, state.pin, showOnboarding]);

  // Reset activity timer on interaction
  useEffect(() => {
    const resetTimer = () => { lastActivity.current = Date.now(); };
    window.addEventListener('click', resetTimer);
    window.addEventListener('touchstart', resetTimer);
    window.addEventListener('keydown', resetTimer);
    return () => {
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
      window.removeEventListener('keydown', resetTimer);
    };
  }, []);

  // Check if first launch
  useEffect(() => {
    if (!state.onboardingSeen) {
      setShowOnboarding(true);
      setIsLocked(false);
    } else if (!state.pin) {
      // Existing user without PIN (shouldn't happen, but handle it)
      setShowOnboarding(false);
      setIsLocked(false);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (isLocked || showOnboarding) return;
      if (e.key === 'o') setPage('manage');
      if (e.key === 'w') setPage('manage');
      if (e.key === 'r') setPage('restock');
      if (e.key === 'Escape') setPage('home');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isLocked, showOnboarding]);

  const showToast = useCallback((msg: string) => {
    setToast({ msg, visible: true });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast({ msg: '', visible: false }), 2500);
  }, []);

  const updateState = useCallback((updates: Partial<AppState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setPinSetupStep('setup');
    setIsLocked(true);
  };

  const handlePinSetupComplete = (pin: string) => {
    if (pinSetupStep === 'setup') {
      setTempPin(pin);
      setPinSetupStep('confirm');
    } else {
      if (pin === tempPin) {
        updateState({ pin: hashPin(pin), onboardingSeen: true });
        setIsLocked(false);
        showToast('PIN set! Welcome to Inventory Pro');
      } else {
        showToast('PINs do not match. Try again.');
        setPinSetupStep('setup');
      }
    }
  };

  const handlePinVerify = () => {
    setIsLocked(false);
  };

  const contextValue = useMemo(() => ({
    state,
    setState,
    updateState,
    showToast,
    isOnline,
  }), [state, updateState, showToast, isOnline]);

  // Render onboarding
  if (showOnboarding) {
    return (
      <AppContext.Provider value={contextValue}>
        <div className="app-container">
          <Onboarding onComplete={handleOnboardingComplete} />
          <Toast message={toast.msg} visible={toast.visible} />
        </div>
      </AppContext.Provider>
    );
  }

  // Render PIN setup (after onboarding, first time)
  if (!state.pin && state.onboardingSeen) {
    return (
      <AppContext.Provider value={contextValue}>
        <div className="app-container">
          <PinScreen
            mode={pinSetupStep === 'setup' ? 'setup' : 'confirm'}
            onComplete={handlePinSetupComplete}
          />
          <Toast message={toast.msg} visible={toast.visible} />
        </div>
      </AppContext.Provider>
    );
  }

  // Render lock screen
  if (isLocked && state.pin) {
    return (
      <AppContext.Provider value={contextValue}>
        <div className="app-container">
          <PinScreen
            mode="verify"
            existingHash={state.pin}
            onComplete={handlePinVerify}
          />
          <Toast message={toast.msg} visible={toast.visible} />
        </div>
      </AppContext.Provider>
    );
  }

  return (
    <AppContext.Provider value={contextValue}>
      <div className="app-container">
        {/* Sync Status */}
        {!isOnline && (
          <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-center py-1" style={{ background: 'var(--warning)', color: '#000' }}>
            <span className="text-xs font-medium">⚠️ Offline Mode</span>
          </div>
        )}

        {/* Pages */}
        {page === 'home' && <HomePage />}
        {page === 'manage' && <ManagePage />}
        {page === 'restock' && <RestockPage />}
        {page === 'profile' && (
          <ProfilePage
            onLock={() => setIsLocked(true)}
            onReplayOnboarding={() => setShowOnboarding(true)}
          />
        )}

        {/* Bottom Navigation */}
        <nav className="bottom-nav" role="navigation" aria-label="Main navigation">
          <button className={`nav-item ${page === 'home' ? 'active' : ''}`} onClick={() => setPage('home')} aria-label="Home">
            <Home size={22} />
            <span>Home</span>
          </button>
          <button className={`nav-item ${page === 'manage' ? 'active' : ''}`} onClick={() => setPage('manage')} aria-label="Manage">
            <ClipboardList size={22} />
            <span>Manage</span>
          </button>
          <button className={`nav-item ${page === 'restock' ? 'active' : ''}`} onClick={() => setPage('restock')} aria-label="Restock">
            <Package size={22} />
            <span>Restock</span>
          </button>
          <button className={`nav-item ${page === 'profile' ? 'active' : ''}`} onClick={() => setPage('profile')} aria-label="Profile">
            <User size={22} />
            <span>Profile</span>
          </button>
        </nav>

        <Toast message={toast.msg} visible={toast.visible} />
      </div>
    </AppContext.Provider>
  );
};

export default App;
