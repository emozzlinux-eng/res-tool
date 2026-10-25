import React, { useMemo, useState } from 'react';
import { Search, Plus, X, Copy, MessageCircle, FileText } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useApp } from '../hooks/useAppState';
import {
  buildLogEntry,
  buildOrders,
  commitLogEntry,
  findShortages,
  orderMessage,
  PurchaseOrder,
  whatsappLink,
  inventoryValue,
} from '../utils/inventory';
import { dayKey } from '../utils/format';
import { downloadFile, inventoryToCsv } from '../utils/export';

export const RestockPage: React.FC = () => {
  const { state, setState, showToast, setCurrentPage } = useApp();
  const [query, setQuery] = useState('');
  const [showOrders, setShowOrders] = useState(false);
  const [restockItem, setRestockItem] = useState<string | null>(null);
  const [restockQty, setRestockQty] = useState('');
  const [sortMode, setSortMode] = useState<'name' | 'low'>('low');

  const shortages = useMemo(() => findShortages(state.rawItems), [state.rawItems]);
  const shortageNames = useMemo(
    () => new Set(shortages.map((s) => s.item.name)),
    [shortages]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = q
      ? state.rawItems.filter((i) => i.name.toLowerCase().includes(q))
      : state.rawItems;
    const sorted = [...items];
    if (sortMode === 'low') {
      // Problem items first: out of stock, then below par, then everyone else
      const rank = (i: typeof sorted[number]) =>
        i.currentStock <= 0 ? 0 : shortageNames.has(i.name) ? 1 : 2;
      sorted.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    return sorted;
  }, [state.rawItems, query, sortMode, shortageNames]);

  const outCount = state.rawItems.filter((i) => i.currentStock <= 0).length;
  const lowCount = shortages.filter((s) => !s.outOfStock).length;

  const orders = useMemo(
    () => buildOrders(state.suppliers, shortages),
    [state.suppliers, shortages]
  );

  const quickRestock = (itemName: string, qty: number) => {
    if (qty <= 0) return;
    const item = state.rawItems.find((i) => i.name === itemName);
    if (!item) return;
    // Route through the shared build/commit helpers so the entry records the
    // actually-applied deltas (undo-safe) — no duplicated logic here.
    const built = buildLogEntry(state, 'restock', itemName, qty, item.icon);
    if (!built) return;
    setState((prev) =>
      commitLogEntry(prev, built.entry, built.changes, `🔵 restock (quick): ${qty} ${itemName}`)
    );
    showToast(`Added ${qty} ${item.unit} of ${itemName}`);
  };

  const copyOrder = async (order: PurchaseOrder) => {
    const msg = orderMessage(order);
    try {
      await navigator.clipboard.writeText(msg);
      showToast('Order copied to clipboard');
    } catch {
      showToast('Could not copy — clipboard unavailable');
    }
  };

  const openWhatsApp = (order: PurchaseOrder) => {
    const link = whatsappLink(order);
    if (!link) {
      showToast('No phone number for this supplier');
      return;
    }
    window.open(link, '_blank', 'noopener');
  };

  return (
    <div className="page-content">
      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <Card className="text-center py-4" padding="sm">
          <div className="text-lg font-bold text-[var(--text-main)]">{state.rawItems.length}</div>
          <div className="text-xs text-[var(--text-muted)]">Items</div>
        </Card>
        <Card className="text-center py-4" padding="sm">
          <div className="text-lg font-bold text-[var(--warning)]">{lowCount}</div>
          <div className="text-xs text-[var(--text-muted)]">Low stock</div>
        </Card>
        <Card className="text-center py-4" padding="sm">
          <div className="text-lg font-bold text-[var(--danger)]">{outCount}</div>
          <div className="text-xs text-[var(--text-muted)]">Out</div>
        </Card>
        <Card className="text-center py-4" padding="sm">
          <div className="text-lg font-bold text-[var(--primary)]">{state.currency}{inventoryValue(state.rawItems).toFixed(0)}</div>
          <div className="text-xs text-[var(--text-muted)]">Stock value</div>
        </Card>
      </div>

      {/* Search + export */}
      <div className="sticky top-0 z-10 bg-[var(--bg)] pb-3 mb-3 flex gap-2 items-center">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search inventory…"
            aria-label="Search inventory"
            className="w-full h-[52px] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] pl-10 pr-3 text-[var(--text-main)] placeholder:text-[var(--text-muted)]"
          />
        </div>
        <button
          onClick={() => setSortMode((m) => (m === 'low' ? 'name' : 'low'))}
          aria-label={`Sort by ${sortMode === 'low' ? 'name' : 'need'}`}
          title={sortMode === 'low' ? 'Sorted: needs first — tap for A–Z' : 'Sorted: A–Z — tap for needs first'}
          className="h-[52px] px-3 shrink-0 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] text-sm font-medium text-[var(--text-sub)] active:scale-95 transition-transform"
        >
          {sortMode === 'low' ? '⚠️ First' : 'A–Z'}
        </button>
        <button
          onClick={() => {
            downloadFile(`inventory-${dayKey(Date.now())}.csv`, inventoryToCsv(state.rawItems));
            showToast('Inventory exported as CSV');
          }}
          aria-label="Export inventory as CSV"
          title="Export inventory as CSV"
          className="h-[52px] px-4 shrink-0 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] text-sm font-medium text-[var(--primary)] active:scale-95 transition-transform"
        >
          CSV
        </button>
      </div>

      {/* Inventory list */}
      <Card>
        {state.rawItems.length === 0 ? (
          <div className="py-8 text-center">
            <div className="text-3xl mb-3">📦</div>
            <p className="text-sm font-medium text-[var(--text-main)] mb-1">No ingredients yet</p>
            <p className="text-xs text-[var(--text-muted)] mb-4">Add your raw items to start tracking stock.</p>
            <button onClick={() => setCurrentPage('profile')} className="btn btn--primary btn--sm">
              + Add ingredients
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] py-6 text-center">
            No items match “{query}”.
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((item) => {
              const isOut = item.currentStock <= 0;
              const isLow = shortageNames.has(item.name) && !isOut;
              return (
                <div key={item.name}>
                  <div className="flex items-center gap-3 p-3 rounded-[var(--radius)] bg-[var(--surface-2)] border border-[var(--border)]">
                    <div className="text-xl">{item.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[var(--text-main)] truncate">
                        {item.name}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        Par: {item.parLevel} {item.unit}
                        {(item.costPerUnit ?? 0) > 0 && (
                          <span> · {state.currency}{(item.currentStock * (item.costPerUnit ?? 0)).toFixed(2)} value</span>
                        )}
                        {isOut && (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-[var(--danger-bg)] text-[var(--danger)] font-semibold">
                            OUT
                          </span>
                        )}
                        {isLow && (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-[var(--warning-bg)] text-[var(--warning)] font-semibold">
                            LOW
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold text-[var(--text-main)]">
                        {item.currentStock}
                        <span className="text-xs font-normal text-[var(--text-muted)] ml-1">
                          {item.unit}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setRestockItem(restockItem === item.name ? null : item.name);
                        setRestockQty('');
                      }}
                      aria-label={`Add stock to ${item.name}`}
                      className="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--primary-light)] text-[var(--primary)] active:scale-95 transition-transform"
                    >
                      <Plus size={18} />
                    </button>
                  </div>

                  {/* Quick add-stock inline form */}
                  {restockItem === item.name && (
                    <div className="mt-1 mb-2 p-3 rounded-[var(--radius)] border border-[var(--primary)] bg-[var(--surface)] flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        autoFocus
                        value={restockQty}
                        onChange={(e) => setRestockQty(e.target.value)}
                        placeholder={`Qty in ${item.unit}`}
                        aria-label={`Quantity of ${item.name} to add`}
                        className="flex-1 h-10 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] px-3 text-[var(--text-main)]"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          const n = parseFloat(restockQty);
                          if (!n || n <= 0) {
                            showToast('Enter a quantity first');
                            return;
                          }
                          quickRestock(item.name, n);
                          setRestockItem(null);
                        }}
                      >
                        Add
                      </Button>
                      <button
                        onClick={() => setRestockItem(null)}
                        aria-label="Cancel add stock"
                        className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-muted)]"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* FAB - Generate Orders */}
      <button
        onClick={() => {
          if (shortages.length === 0) {
            showToast('Nothing to order — all stock above par 🎉');
            return;
          }
          setShowOrders(true);
        }}
        aria-label="Generate purchase orders"
        title="Generate purchase orders"
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-[var(--primary)] text-white shadow-lg flex items-center justify-center z-40 active:scale-95 transition-transform"
      >
        <FileText size={24} />
      </button>

      {/* Orders sheet modal */}
      {showOrders && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
          onClick={() => setShowOrders(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Generated purchase orders"
        >
          <div
            className="w-full max-w-[414px] max-h-[80vh] overflow-y-auto overscroll-contain bg-[var(--surface)] rounded-t-2xl sm:rounded-2xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="card__title mb-0">Purchase Orders ({orders.length})</h3>
              <button
                onClick={() => setShowOrders(false)}
                aria-label="Close orders"
                className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-muted)]"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              {orders.map((order, idx) => (
                <Card key={idx} padding="sm">
                  <div className="text-sm font-semibold text-[var(--text-main)] mb-2">
                    {order.supplier ? `🏪 ${order.supplier.name}` : '❓ Unassigned items'}
                  </div>
                  <pre className="whitespace-pre-wrap text-xs text-[var(--text-sub)] font-sans mb-3">
                    {orderMessage(order)}
                  </pre>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={whatsappLink(order) ? 'primary' : 'outline'}
                      icon={<MessageCircle size={14} />}
                      onClick={() => openWhatsApp(order)}
                    >
                      WhatsApp
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<Copy size={14} />}
                      onClick={() => copyOrder(order)}
                    >
                      Copy
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
