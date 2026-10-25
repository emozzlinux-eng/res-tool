import React, { useMemo } from 'react';
import { Card } from '../components/ui/Card';
import { useApp } from '../hooks/useAppState';
import {
  findShortages,
  producedToday,
  todaysEntries,
  wasteToday,
} from '../utils/inventory';
import { formatTimeAgo, getFormattedDate, getGreeting } from '../utils/helpers';

export const HomePage: React.FC = () => {
  const { state, setCurrentPage } = useApp();

  const produced = producedToday(state.dailyLog);
  const wasteCount = wasteToday(state.dailyLog);
  const restockCount = todaysEntries(state.dailyLog).filter((e) => e.type === 'restock').length;
  const shortages = useMemo(() => findShortages(state.rawItems), [state.rawItems]);
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
                  <div className="text-xs text-[var(--text-muted)]">{formatTimeAgo(a.time)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
