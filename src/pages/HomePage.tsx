import React, { useMemo } from 'react';
import { Card } from '../components/ui/Card';
import { useApp } from '../hooks/useAppState';
import {
  findShortages,
  producedToday,
  todaysEntries,
  wasteToday,
  wasteValueToday,
} from '../utils/inventory';
import { formatTimeAgo, getFormattedDate, getGreeting } from '../utils/helpers';

/** Friendly labels for waste reasons recorded on the Manage page. */
const reasonLabels: Record<string, string> = {
  expired: 'Expired',
  burnt: 'Burnt',
  spoiled: 'Spoiled',
  overproduced: 'Overproduced',
  damaged: 'Damaged',
  other: 'Other',
};

export const HomePage: React.FC = () => {
  const { state, setCurrentPage } = useApp();

  const produced = producedToday(state.dailyLog);
  const wasteCount = wasteToday(state.dailyLog);
  const restockCount = todaysEntries(state.dailyLog).filter((e) => e.type === 'restock').length;
  const shortages = useMemo(() => findShortages(state.rawItems), [state.rawItems]);
  const wasteValue = wasteValueToday(state);
  const recent = state.activityLog.slice(0, 6);

  const stats = [
    { label: 'Produced today', value: produced, color: 'var(--success)' },
    { label: 'Waste entries', value: wasteCount, color: 'var(--danger)' },
    { label: 'Restocks today', value: restockCount, color: 'var(--primary)' },
    { label: 'Low / out items', value: shortages.length, color: 'var(--warning)' },
  ];

  return (
    <div className="page-content">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-[var(--text-main)] mb-1">
          {getGreeting()}, {state.userName || 'Manager'}
        </h2>
        <p className="text-sm text-[var(--text-sub)]">{getFormattedDate()}</p>
      </div>

      {/* First-run setup checklist — shown until the workspace has data */}
      {(state.rawItems.length === 0 || state.foods.length === 0) && (
        <Card className="mb-4" style={{ borderColor: 'var(--primary)' }}>
          <h3 className="card__title">Get started — set up your workspace</h3>
          <div className="space-y-2 mb-3">
            {[
              { done: state.rawItems.length > 0, label: 'Add raw ingredients', hint: 'Flour, butter… with units, par levels & costs' },
              { done: state.foods.length > 0, label: 'Add foods you produce', hint: 'The finished items you bake or make' },
              { done: state.recipes.some((r) => r.ingredients.length > 0), label: 'Create recipes', hint: 'Link ingredients so stock deducts automatically' },
              { done: state.suppliers.length > 0, label: 'Add suppliers', hint: 'For one-tap WhatsApp restock orders' },
            ].map((step) => (
              <div key={step.label} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                    step.done
                      ? 'bg-[var(--success)] text-white'
                      : 'border-2 border-[var(--border-strong)] text-transparent'
                  }`}
                >
                  ✓
                </span>
                <div className="min-w-0">
                  <div className={`text-sm font-medium ${step.done ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-main)]'}`}>
                    {step.label}
                  </div>
                  {!step.done && <div className="text-xs text-[var(--text-muted)]">{step.hint}</div>}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setCurrentPage('profile')}
            className="btn btn--primary btn--sm btn--full"
          >
            Set up in Profile →
          </button>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {stats.map((s) => (
          <Card key={s.label} className="text-center py-5" padding="sm">
            <div className="text-2xl font-bold" style={{ color: s.color }}>
              {s.value}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-1">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Quick action — single primary CTA */}
      <button
        onClick={() => setCurrentPage('manage')}
        className="w-full flex items-center justify-center gap-2 h-12 mb-4 rounded-[var(--radius)] bg-[var(--primary)] border border-[var(--primary)] text-sm font-semibold text-white active:scale-[0.98] transition-transform shadow"
      >
        ➕ Quick log an entry
      </button>

      {/* Waste value banner */}
      {wasteValue > 0 && (
        <div className="mb-4 p-3 rounded-[var(--radius)] bg-[var(--danger-bg)] border border-[var(--danger)] text-xs text-[var(--danger)]">
          💸 Wasted about <strong>{state.currency}{wasteValue.toFixed(2)}</strong> worth of stock today.
        </div>
      )}

      {/* Action Required */}
      <Card className="mb-4">
        <h3 className="card__title">Action Required</h3>
        {shortages.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] py-3">
            All stock is above par levels 🎉
          </p>
        ) : (
          <div className="space-y-2">
            {shortages.slice(0, 5).map((s) => (
              <button
                key={s.item.name}
                onClick={() => setCurrentPage('restock')}
                className="w-full flex items-center gap-3 p-2 rounded-[var(--radius-sm)] hover:bg-[var(--surface-2)] text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-[var(--surface-2)] flex items-center justify-center text-base">
                  {s.item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[var(--text-main)] truncate">
                    {s.item.name}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {s.outOfStock ? 'Out of stock' : `Low: ${s.item.currentStock}/${s.item.parLevel} ${s.item.unit}`}
                  </div>
                </div>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded ${
                    s.outOfStock
                      ? 'bg-[var(--danger-bg)] text-[var(--danger)]'
                      : 'bg-[var(--warning-bg)] text-[var(--warning)]'
                  }`}
                >
                  {s.outOfStock ? 'ORDER' : 'LOW'}
                </span>
              </button>
            ))}
            {shortages.length > 5 && (
              <button
                onClick={() => setCurrentPage('restock')}
                className="text-xs text-[var(--primary)] underline"
              >
                +{shortages.length - 5} more — see Restock page
              </button>
            )}
          </div>
        )}
      </Card>

      {/* Recent Activity */}
      <Card>
        <h3 className="card__title">Recent Activity</h3>
        {recent.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] py-3">
            No activity yet. Log your first entry from the Manage page.
          </p>
        ) : (
          <div className="space-y-3">
            {recent.map((a, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[var(--primary)] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[var(--text-main)] truncate">{a.action}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {formatTimeAgo(a.time)}
                    {a.reason && (
                      <span className="ml-2 px-1.5 py-0.5 rounded bg-[var(--danger-bg)] text-[var(--danger)] font-medium">
                        {reasonLabels[a.reason] ?? a.reason}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
