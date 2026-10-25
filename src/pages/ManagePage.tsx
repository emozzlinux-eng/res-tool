import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Sheet } from '../components/ui/Sheet';
import { useApp } from '../hooks/useAppState';
import { DailyLogEntry } from '../types';
import {
  applyStockChanges,
  buildLogEntry,
  changesForEntry,
  commitLogEntry,
  hasMeaningfulRecipe,
  reverseChanges,
  todaysEntries,
  StockChange,
} from '../utils/inventory';
import { vibrate } from '../utils/device';
import { downloadFile, logToCsv } from '../utils/export';
import { exportMonthReport, monthsWithData } from '../utils/report';
import { dayKey } from '../utils/format';

type LogType = DailyLogEntry['type'];

const typeMeta: Record<LogType, { label: string; icon: string; hint: string }> = {
  output: { label: 'Produced', icon: '✅', hint: 'Finished foods — recipe ingredients are deducted automatically' },
  waste: { label: 'Waste', icon: '🗑️', hint: 'Raw items thrown away — choose why it was wasted' },
  restock: { label: 'Restock', icon: '📦', hint: 'Raw items received — added straight to stock' },
};

/** Waste reason options for the remark selector. */
const WASTE_REASONS: { value: string; label: string }[] = [
  { value: 'expired', label: '⏰ Expired' },
  { value: 'burnt', label: '🔥 Burnt' },
  { value: 'spoiled', label: '🦠 Spoiled' },
  { value: 'overproduced', label: '📈 Overproduced' },
  { value: 'damaged', label: '💥 Damaged' },
  { value: 'other', label: '✏️ Other (type below)' },
];

export const ManagePage: React.FC = () => {
  const { state, setState, showToast, setCurrentPage } = useApp();
  const [logType, setLogType] = useState<LogType>('output');
  const [selectedName, setSelectedName] = useState('');
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState('');
  const [reasonNote, setReasonNote] = useState('');

  // Month-end Excel report picker (bottom sheet)
  const monthOptions = useMemo(() => {
    const opts = monthsWithData(state.dailyLog);
    if (opts.length === 0) {
      const now = new Date();
      return [{ year: now.getFullYear(), month: now.getMonth() + 1, label: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }];
    }
    return opts;
  }, [state.dailyLog]);
  const [reportMonthKey, setReportMonthKey] = useState(`${monthOptions[0].year}-${monthOptions[0].month}`);
  const [reportPickerOpen, setReportPickerOpen] = useState(false);
  // Keep the highlighted month valid as data arrives
  useEffect(() => {
    if (!monthOptions.some((m) => `${m.year}-${m.month}` === reportMonthKey)) {
      setReportMonthKey(`${monthOptions[0].year}-${monthOptions[0].month}`);
    }
  }, [monthOptions, reportMonthKey]);

  // Candidate items depend on the log type:
  // Produced → FOODS only; Waste & Restock → RAW ITEMS only.
  const candidates = useMemo(() => {
    if (logType === 'output') {
      return state.foods.map((f) => ({ name: f.name, icon: f.icon, unit: 'pcs' }));
    }
    return state.rawItems.map((i) => ({ name: i.name, icon: i.icon, unit: i.unit }));
  }, [state.foods, state.rawItems, logType]);

  // Reset selection when switching type
  const switchType = (t: LogType) => {
    setLogType(t);
    setSelectedName('');
    setQty(1);
    setReason('');
    setReasonNote('');
  };

  const selectedItem = candidates.find((c) => c.name === selectedName);

  /** Phase 1.5: producing a food with no (or empty) recipe deducts nothing — warn. */
  const missingRecipeNotice =
    logType === 'output' && !!selectedItem && !hasMeaningfulRecipe(state, selectedItem.name);

  /** Final reason text stored on the entry (waste only). */
  const resolvedReason = reason === 'other' ? (reasonNote.trim() || 'Other') : reason || undefined;

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
        // Round to the same 3 dp precision applyStockChanges uses, so
        // float noise (e.g. 0.1*3 > 0.3) never shows a false shortage.
        const r3 = (n: number) => Math.round(n * 1000) / 1000;
        return !item || r3(item.currentStock) < r3(Math.abs(c.delta));
      }),
    [preview, state.rawItems]
  );

  const todayLog = useMemo(() => todaysEntries(state.dailyLog), [state.dailyLog]);

  // Favorites: one-tap quick-log chips above the form
  const favorites = useMemo(
    () => candidates.filter((c) => (state.favorites ?? []).includes(c.name)).slice(0, 8),
    [candidates, state.favorites]
  );
  const isFavorite = selectedName ? (state.favorites ?? []).includes(selectedName) : false;
  const toggleFavorite = () => {
    if (!selectedName) return;
    setState((prev) => {
      const favs = prev.favorites ?? [];
      return {
        ...prev,
        favorites: favs.includes(selectedName) ? favs.filter((n) => n !== selectedName) : [...favs, selectedName],
      };
    });
    showToast(isFavorite ? 'Removed from quick log' : 'Added to quick log ⭐');
  };
  const quickLog = (name: string) => {
    // Waste must carry a reason: open the form with the item pre-selected so
    // the existing reason chips show first. Output and restock stay one-tap.
    if (logType === 'waste') {
      setSelectedName(name);
      setQty(1);
      showToast('Choose a waste reason to log it');
      return;
    }
    const item = candidates.find((c) => c.name === name);
    if (!item) return;
    const built = buildLogEntry(state, logType, name, 1, item.icon);
    if (!built) return;
    vibrate(12);
    setState((prev) =>
      commitLogEntry(prev, built.entry, built.changes, `${typeMeta[logType].icon} ${logType} (quick): 1 ${name}`)
    );
    showToast(`+1 ${name}`);
  };

  const handleSave = () => {
    if (!selectedItem) {
      showToast('Pick an item first');
      return;
    }
    if (qty <= 0) {
      showToast('Quantity must be more than zero');
      return;
    }
    if (logType === 'waste' && !resolvedReason) {
      showToast('Please choose a waste reason');
      return;
    }
    const built = buildLogEntry(state, logType, selectedItem.name, qty, selectedItem.icon, resolvedReason);
    if (!built) return;
    vibrate([10, 30, 10]);
    setState((prev) =>
      commitLogEntry(
        prev,
        built.entry,
        built.changes,
        `${typeMeta[logType].icon} ${logType}: ${qty} ${selectedItem.name}`
      )
    );
    showToast(`Logged ${qty} ${selectedItem.name} (${typeMeta[logType].label})`);
    setSelectedName('');
    setQty(1);
    setReason('');
    setReasonNote('');
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
    vibrate(20);
    showToast('Entry undone — stock restored');
  };

  return (
    <div className="page-content">
      {/* Segment control */}
      <div
        className="flex gap-2 mb-4"
        role="tablist"
        aria-label="Log type"
      >
        {(Object.keys(typeMeta) as LogType[]).map((t) => {
          const activeTab = logType === t;
          const tone =
            t === 'output'
              ? { bg: 'var(--success)', soft: 'var(--success-bg)' }
              : t === 'waste'
                ? { bg: 'var(--danger)', soft: 'var(--danger-bg)' }
                : { bg: 'var(--primary)', soft: 'var(--primary-light)' };
          return (
            <button
              key={t}
              role="tab"
              aria-selected={activeTab}
              onClick={() => switchType(t)}
              className={`flex-1 h-[72px] rounded-[var(--radius)] border-2 flex flex-col items-center justify-center gap-1 text-sm font-semibold transition-all active:scale-[0.97] ${
                activeTab ? 'shadow text-white' : 'text-[var(--text-sub)] bg-[var(--surface)]'
              }`}
              style={{
                borderColor: activeTab ? tone.bg : 'var(--border)',
                background: activeTab ? tone.bg : undefined,
              }}
            >
              <span className="text-xl leading-none">{typeMeta[t].icon}</span>
              {typeMeta[t].label}
            </button>
          );
        })}
      </div>

      {/* Quick-log favorites */}
      {favorites.length > 0 && (
        <div className="mb-4">
          <p className="settings-group__title mb-2">Quick log · {typeMeta[logType].label}</p>
          <div className="flex gap-2 overflow-x-auto pb-1 ql-row">
            {favorites.map((f) => (
              <button
                key={`fav-${f.name}`}
                onClick={() => quickLog(f.name)}
                className="chip flex-shrink-0"
                aria-label={`Quick log 1 ${f.name}`}
              >
                {f.icon} {f.name} <span className="chip__plus">+1</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input form */}
      <Card className="mb-4">
        <h3 className="card__title">{typeMeta[logType].icon} {typeMeta[logType].label}</h3>
        <p className="text-xs text-[var(--text-muted)] -mt-1 mb-3">{typeMeta[logType].hint}</p>

        {candidates.length === 0 ? (
          <div className="py-6 text-center">
            <div className="text-3xl mb-3">🗂️</div>
            <p className="text-sm font-medium text-[var(--text-main)] mb-1">Nothing to log yet</p>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              Add your foods and ingredients first — then you can log production, waste and restocks here.
            </p>
            <button onClick={() => setCurrentPage('profile')} className="btn btn--primary btn--sm">
              + Set up items in Profile
            </button>
          </div>
        ) : (
          <>
        {/* Item selector */}
        <select
          value={selectedName}
          onChange={(e) => setSelectedName(e.target.value)}
          aria-label="Choose item"
          className="w-full h-[52px] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] px-3 text-[var(--text-main)] mb-3"
        >
          <option value="">
            Choose a {logType === 'output' ? 'food…' : 'raw item…'}
          </option>
          {candidates.map((c) => (
            <option key={`${logType}-${c.name}`} value={c.name}>
              {c.icon} {c.name} ({c.unit})
            </option>
          ))}
        </select>

        {selectedItem && (
          <button
            onClick={toggleFavorite}
            className={`text-xs font-medium px-2 py-1 rounded-full border mb-3 transition-colors ${
              isFavorite
                ? 'bg-[var(--warning-bg)] text-[var(--warning)] border-[var(--warning)]'
                : 'bg-[var(--surface-2)] text-[var(--text-sub)] border-[var(--border)]'
            }`}
            aria-pressed={isFavorite}
          >
            {isFavorite ? '★ In quick log' : '☆ Add to quick log'}
          </button>
        )}

        {/* No-recipe notice: producing this food won't deduct any stock */}
        {missingRecipeNotice && (
          <div
            role="status"
            className="mb-3 p-3 rounded-[var(--radius-sm)] bg-[var(--warning-bg)] border border-[var(--warning)] text-xs text-[var(--text-main)]"
          >
            <strong>No recipe set.</strong> Stock won’t be deducted for this entry.{' '}
            <button
              onClick={() => setCurrentPage('profile')}
              className="font-semibold text-[var(--primary)] underline"
            >
              Add a recipe in Profile →
            </button>
          </div>
        )}

        {/* Waste reason selector */}
        {logType === 'waste' && (
          <div className="mb-3">
            <p className="text-xs font-semibold text-[var(--text-sub)] mb-2">Why was it wasted? (required)</p>
            <div className="flex flex-wrap gap-2">
              {WASTE_REASONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setReason(reason === r.value ? '' : r.value)}
                  aria-pressed={reason === r.value}
                  className={`px-3 py-2 rounded-full border text-xs font-medium transition-colors active:scale-95 ${
                    reason === r.value
                      ? 'bg-[var(--danger)] text-white border-[var(--danger)]'
                      : 'bg-[var(--surface-2)] text-[var(--text-sub)] border-[var(--border)]'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {reason === 'other' && (
              <input
                autoFocus
                value={reasonNote}
                onChange={(e) => setReasonNote(e.target.value)}
                maxLength={60}
                placeholder="Describe the reason…"
                aria-label="Waste reason details"
                className="mt-2 w-full h-11 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-[var(--text-main)]"
              />
            )}
          </div>
        )}

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

        <Button
          fullWidth
          onClick={handleSave}
          disabled={!selectedItem || qty <= 0 || (logType === 'waste' && !resolvedReason)}
        >
          {logType === 'output' && '✅ Save production'}
          {logType === 'waste' && '🗑️ Save waste entry'}
          {logType === 'restock' && '📦 Save restock'}
        </Button>
          </>
        )}
      </Card>

      {/* Today's log */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <h3 className="card__title mb-0">Today’s Entries ({todayLog.length})</h3>
          <button
            onClick={() => {
              if (state.dailyLog.length === 0) {
                showToast('Nothing to export yet');
                return;
              }
              downloadFile(`production-log-${dayKey(Date.now())}.csv`, logToCsv(state.dailyLog));
              showToast('Log exported as CSV');
            }}
            aria-label="Export full log as CSV"
            title="Export full log as CSV"
            className="text-xs font-medium text-[var(--primary)] underline px-2 py-1"
          >
            Export CSV
          </button>
        </div>
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
                  <div className="text-xs text-[var(--text-muted)] truncate">
                    {typeMeta[entry.type].label} · {entry.time}
                    {entry.reason && (
                      <span className="ml-1 px-1.5 py-0.5 rounded bg-[var(--danger-bg)] text-[var(--danger)] font-medium capitalize">
                        {entry.reason}
                      </span>
                    )}
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

      {/* Month-end report */}
      <Card>
        <h3 className="card__title">📊 Month-End Report (Excel)</h3>
        <p className="text-xs text-[var(--text-muted)] mb-3">
          Downloads an .xlsx workbook with summary, production, waste, restocks and an inventory snapshot.
        </p>
        <Button
          fullWidth
          variant="outline"
          onClick={() => {
            const opts = monthsWithData(state.dailyLog);
            if (opts.length === 0) {
              showToast('No entries logged yet');
              return;
            }
            setReportPickerOpen(true);
          }}
        >
          Export Excel
        </Button>
      </Card>

      {/* Month picker — bottom sheet (thumb-friendly on phones) */}
      {reportPickerOpen && (
        <Sheet title="Choose month to export" onClose={() => setReportPickerOpen(false)}>
          <div className="space-y-2 pb-2">
            {monthOptions.map((m) => (
              <button
                key={`${m.year}-${m.month}`}
                onClick={async () => {
                  const hasEntries = state.dailyLog.some((e) => {
                    const d = new Date(e.timestamp);
                    return d.getFullYear() === m.year && d.getMonth() + 1 === m.month;
                  });
                  if (!hasEntries) {
                    showToast('No entries logged in that month');
                    return;
                  }
                  try {
                    await exportMonthReport(state, m.year, m.month);
                    showToast('Excel report downloaded');
                    setReportPickerOpen(false);
                  } catch {
                    showToast('Could not generate the report');
                  }
                }}
                className={`w-full min-h-[52px] px-4 rounded-[var(--radius)] border text-sm font-medium text-left active:scale-[0.98] transition-transform ${
                  reportMonthKey === `${m.year}-${m.month}`
                    ? 'border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]'
                    : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-main)]'
                }`}
              >
                📅 {m.label}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
};
