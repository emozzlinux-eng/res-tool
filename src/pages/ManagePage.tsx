import React, { useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useApp } from '../hooks/useAppState';
import { DailyLogEntry } from '../types';
import {
  applyStockChanges,
  changesForEntry,
  reverseChanges,
  todaysEntries,
  StockChange,
} from '../utils/inventory';
import { generateId, getCurrentTime } from '../utils/helpers';

type LogType = DailyLogEntry['type'];

const typeMeta: Record<LogType, { label: string; icon: string; verb: string }> = {
  output: { label: 'Produced', icon: '🟢', verb: 'baked / produced' },
  waste: { label: 'Waste', icon: '🔴', verb: 'threw away' },
  restock: { label: 'Restock', icon: '🔵', verb: 'added to shelf' },
};

export const ManagePage: React.FC = () => {
  const { state, setState, showToast } = useApp();
  const [logType, setLogType] = useState<LogType>('output');
  const [selectedName, setSelectedName] = useState('');
  const [qty, setQty] = useState(1);

  // Candidate items depend on the log type
  const candidates = useMemo(() => {
    if (logType === 'restock') {
      return state.rawItems.map((i) => ({ name: i.name, icon: i.icon, unit: i.unit }));
    }
    // output & waste operate on finished foods; also allow wasting raw items
    const foods = state.foods.map((f) => ({ name: f.name, icon: f.icon, unit: 'pcs' }));
    const raws = state.rawItems.map((i) => ({ name: i.name, icon: i.icon, unit: i.unit }));
    return [...foods, ...raws];
  }, [state.foods, state.rawItems, logType]);

  // Reset selection when switching type
  const switchType = (t: LogType) => {
    setLogType(t);
    setSelectedName('');
    setQty(1);
  };

  const selectedItem = candidates.find((c) => c.name === selectedName);

  // Preview stock impact + shortage warnings
  const preview: StockChange[] = useMemo(() => {
    if (!selectedItem || qty <= 0) return [];
    return changesForEntry(state, logType, selectedItem.name, qty);
  }, [state, logType, selectedItem, qty]);

  const shortages = useMemo(
    () =>
      preview.filter((c) => {
        if (c.delta >= 0) return false;
        const item = state.rawItems.find((i) => i.name === c.itemName);
        return !item || item.currentStock < Math.abs(c.delta);
      }),
    [preview, state.rawItems]
  );

  const todayLog = useMemo(() => todaysEntries(state.dailyLog), [state.dailyLog]);

  const handleSave = () => {
    if (!selectedItem) {
      showToast('Pick an item first');
      return;
    }
    if (qty <= 0) {
      showToast('Quantity must be more than zero');
      return;
    }
    const entry: DailyLogEntry = {
      id: generateId(),
      type: logType,
      icon: selectedItem.icon,
      name: selectedItem.name,
      qty: String(qty),
      time: getCurrentTime(),
      timestamp: Date.now(),
      stockChanges: preview,
    };
    setState((prev) => ({
      ...prev,
      dailyLog: [entry, ...prev.dailyLog],
      rawItems: applyStockChanges(prev.rawItems, preview),
      activityLog: [
        { action: `${typeMeta[logType].icon} ${logType}: ${qty} ${selectedItem.name}`, time: Date.now() },
        ...prev.activityLog.slice(0, 49),
      ],
    }));
    showToast(`Logged ${qty} ${selectedItem.name} (${typeMeta[logType].label})`);
    setSelectedName('');
    setQty(1);
  };

  const handleUndo = (entry: DailyLogEntry) => {
    setState((prev) => ({
      ...prev,
      dailyLog: prev.dailyLog.filter((e) => e.id !== entry.id),
      rawItems: applyStockChanges(prev.rawItems, reverseChanges(entry.stockChanges ?? [])),
      activityLog: [
        { action: `↩️ Undid ${entry.type}: ${entry.qty} ${entry.name}`, time: Date.now() },
        ...prev.activityLog.slice(0, 49),
      ],
    }));
    showToast('Entry undone — stock restored');
  };

  return (
    <div className="page-content">
      {/* Segment control */}
      <div
        className="flex gap-2 mb-4 p-1 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border)]"
        role="tablist"
        aria-label="Log type"
      >
        {(Object.keys(typeMeta) as LogType[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={logType === t}
            onClick={() => switchType(t)}
            className={`flex-1 h-10 rounded-[6px] text-sm font-medium transition-colors ${
              logType === t
                ? 'bg-[var(--primary)] text-white shadow'
                : 'text-[var(--text-sub)] active:bg-[var(--surface)]'
            }`}
          >
            {typeMeta[t].icon} {typeMeta[t].label}
          </button>
        ))}
      </div>

      {/* Input form */}
      <Card className="mb-4">
        <h3 className="card__title">{typeMeta[logType].label}</h3>

        {/* Item selector */}
        <select
          value={selectedName}
          onChange={(e) => setSelectedName(e.target.value)}
          aria-label="Choose item"
          className="w-full h-[52px] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] px-3 text-[var(--text-main)] mb-3"
        >
          <option value="">Choose a {logType === 'restock' ? 'raw item…' : 'food or item…'}</option>
          {candidates.map((c) => (
            <option key={`${logType}-${c.name}`} value={c.name}>
              {c.icon} {c.name} ({c.unit})
            </option>
          ))}
        </select>

        {/* Logic guide */}
        <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text-sub)] mb-3">
          {logType === 'output' &&
            (selectedItem && state.recipes.some((r) => r.foodName === selectedItem.name)
              ? `Recipe will auto-deduct ingredients for ${qty} × ${selectedItem.name}.`
              : selectedItem
                ? 'No recipe found — this will deduct the raw item directly.'
                : 'Producing a food deducts its recipe ingredients from stock.')}
          {logType === 'waste' &&
            (selectedItem && state.recipes.some((r) => r.foodName === selectedItem.name)
              ? 'Wasting a food deducts its ingredient cost from stock.'
              : 'Wasting a raw item reduces its stock directly.')}
          {logType === 'restock' && 'Restocking adds quantity to the item’s current stock.'}
        </div>

        {/* Quantity stepper */}
        <div className="flex items-center justify-center gap-4 my-6">
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="Decrease quantity"
            className="w-12 h-12 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-xl font-semibold text-[var(--text-main)] active:scale-95 transition-transform"
          >
            −
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step="any"
            value={qty}
            onChange={(e) => setQty(Math.max(0, parseFloat(e.target.value) || 0))}
            aria-label="Quantity"
            className="w-24 h-12 text-center text-2xl font-bold rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-main)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            onClick={() => setQty((q) => q + 1)}
            aria-label="Increase quantity"
            className="w-12 h-12 rounded-full bg-[var(--primary-light)] border border-[var(--border)] text-xl font-semibold text-[var(--primary)] active:scale-95 transition-transform"
          >
            +
          </button>
        </div>

        {/* Shortage warning */}
        {shortages.length > 0 && (
          <div className="mb-3 p-3 rounded-[var(--radius-sm)] bg-[var(--danger-bg)] border border-[var(--danger)] text-xs text-[var(--danger)]">
            <strong>Not enough stock:</strong>
            {shortages.map((s) => {
              const item = state.rawItems.find((i) => i.name === s.itemName);
              return (
                <div key={s.itemName}>
                  • {s.itemName}: need {Math.abs(s.delta).toFixed(2)}, have{' '}
                  {item ? item.currentStock.toFixed(2) : '0'}
                </div>
              );
            })}
            <div className="mt-1 text-[var(--text-sub)]">
              You can still log it — stock will be clamped at zero.
            </div>
          </div>
        )}

        {/* Deduction preview */}
        {preview.length > 0 && logType !== 'restock' && shortages.length === 0 && (
          <div className="mb-3 p-3 rounded-[var(--radius-sm)] bg-[var(--surface-2)] text-xs text-[var(--text-sub)]">
            Will deduct:{' '}
            {preview.map((p) => `${Math.abs(p.delta).toFixed(2)} ${p.itemName}`).join(', ')}
          </div>
        )}

        <Button fullWidth onClick={handleSave} disabled={!selectedItem || qty <= 0}>
          Save {typeMeta[logType].label.toLowerCase()} entry
        </Button>
      </Card>

      {/* Today's log */}
      <Card>
        <h3 className="card__title">Today’s Entries ({todayLog.length})</h3>
        {todayLog.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] py-4 text-center">
            Nothing logged yet today.
          </p>
        ) : (
          <div className="space-y-2">
            {todayLog.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 p-3 rounded-[var(--radius)] bg-[var(--surface-2)] border border-[var(--border)]"
              >
                <div className="text-xl">{entry.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[var(--text-main)] truncate">
                    {entry.name}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {typeMeta[entry.type].label} · {entry.time}
                  </div>
                </div>
                <div className="text-sm font-semibold text-[var(--text-main)]">
                  ×{entry.qty}
                </div>
                <button
                  onClick={() => handleUndo(entry)}
                  aria-label={`Undo ${entry.name}`}
                  className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--surface)] border border-[var(--border)] text-[var(--text-sub)] active:scale-95 transition-transform"
                  title="Undo — restores stock"
                >
                  ↩
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
