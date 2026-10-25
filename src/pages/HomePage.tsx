import React, { useMemo } from 'react';
import { ChevronRight, CheckCircle2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { useApp } from '../hooks/useAppState';
import { formatQty, formatTimeAgo, getGreeting, getStockStatus, isToday } from '../utils/helpers';

export const HomePage: React.FC = () => {
  const { state, setCurrentPage, setManageMode } = useApp();

  const stats = useMemo(() => {
    const today = state.dailyLog.filter(e => isToday(e.timestamp));
    const sumQty = (type: string) =>
      today.filter(e => e.type === type).reduce((sum, e) => sum + (parseFloat(e.qty) || 0), 0);
    return {
      produced: sumQty('output'),
      wasteCount: today.filter(e => e.type === 'waste').length,
      low: state.rawItems.filter(i => getStockStatus(i.currentStock, i.parLevel) === 'low').length,
      out: state.rawItems.filter(i => getStockStatus(i.currentStock, i.parLevel) === 'out').length,
    };
  }, [state.dailyLog, state.rawItems]);

  const alerts = useMemo(
    () =>
      state.rawItems
        .filter(i => i.currentStock < i.parLevel)
        .sort((a, b) => a.currentStock / (a.parLevel || 1) - b.currentStock / (b.parLevel || 1)),
    [state.rawItems],
  );

  const statCards = [
    { icon: '🧁', value: formatQty(stats.produced), label: 'Produced today', color: 'var(--success)', onClick: () => { setManageMode('output'); setCurrentPage('manage'); } },
    { icon: '🗑️', value: stats.wasteCount, label: 'Waste entries today', color: 'var(--danger)', onClick: () => { setManageMode('waste'); setCurrentPage('manage'); } },
    { icon: '⚠️', value: stats.low, label: 'Low stock', color: 'var(--warning)', onClick: () => setCurrentPage('restock') },
    { icon: '⛔', value: stats.out, label: 'Out of stock', color: 'var(--danger)', onClick: () => setCurrentPage('restock') },
  ];

  return (
    <div className="page-content">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-[var(--text-main)] mb-1">
          {getGreeting()}, {state.userName || 'Manager'}
        </h2>
        <p className="text-sm text-[var(--text-sub)]">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {statCards.map(card => (
          <Card key={card.label} className="text-center py-5" onClick={card.onClick}>
            <div className="text-2xl mb-1">{card.icon}</div>
            <div className="text-2xl font-semibold" style={{ color: card.color }}>{card.value}</div>
            <div className="text-xs text-[var(--text-sub)]">{card.label}</div>
          </Card>
        ))}
      </div>

      {/* Action Required */}
      <Card className="mb-4" title="Action Required">
        {alerts.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-[var(--success)]">
            <CheckCircle2 size={18} /> All ingredients are above par level
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.slice(0, 5).map(item => {
              const status = getStockStatus(item.currentStock, item.parLevel);
              return (
                <button key={item.name} className="list-row" onClick={() => setCurrentPage('restock')}>
                  <div className="row-icon">{item.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--text-main)] truncate">{item.name}</div>
                    <div className="text-xs text-[var(--text-sub)]">
                      {formatQty(item.currentStock)} / {formatQty(item.parLevel)} {item.unit}
                    </div>
                  </div>
                  <span className={`badge ${status === 'out' ? 'badge--danger' : 'badge--warning'}`}>
                    {status === 'out' ? 'Out' : 'Low'}
                  </span>
                </button>
              );
            })}
            {alerts.length > 5 && (
              <p className="text-xs text-[var(--text-muted)] text-center pt-1">+{alerts.length - 5} more</p>
            )}
            <button
              className="w-full flex items-center justify-center gap-1 text-sm font-medium text-[var(--primary)] pt-2"
              onClick={() => setCurrentPage('restock')}
            >
              Generate orders <ChevronRight size={16} />
            </button>
          </div>
        )}
      </Card>

      {/* Recent Activity */}
      <Card title="Recent Activity">
        {state.activityLog.length === 0 ? (
          <p className="empty-state">No activity yet. Log production, waste or restocks from Manage.</p>
        ) : (
          <ol className="space-y-3">
            {state.activityLog.slice(0, 8).map((a, i) => (
              <li key={`${a.time}-${i}`} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 bg-[var(--primary)]" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[var(--text-main)]">{a.action}</div>
                  <div className="text-xs text-[var(--text-muted)]">{formatTimeAgo(a.time)}</div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
};
