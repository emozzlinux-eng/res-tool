import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Copy, Check, RotateCcw, ShoppingCart } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useApp } from '../hooks/useAppState';
import { ShoppingItem } from '../types';
import { generateId } from '../utils/helpers';

/**
 * A lightweight to-buy / shopping list — separate from inventory logging.
 * Items persist locally (works offline) and can be copied as plain text.
 */
export const ShoppingPage: React.FC = () => {
  const { state, setState, showToast } = useApp();
  const [text, setText] = useState('');
  const [qty, setQty] = useState('');

  const items = state.shoppingList ?? [];
  const pending = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  const sorted = useMemo(
    () => [...items].sort((a, b) => Number(a.done) - Number(b.done) || b.addedAt - a.addedAt),
    [items]
  );

  const setList = (shoppingList: ShoppingItem[]) =>
    setState((prev) => ({ ...prev, shoppingList }));

  const addItem = () => {
    const value = text.trim();
    if (!value) {
      showToast('Type what you need first');
      return;
    }
    const item: ShoppingItem = {
      id: generateId(),
      text: value,
      qty: qty.trim() || undefined,
      done: false,
      addedAt: Date.now(),
    };
    setList([item, ...items]);
    setText('');
    setQty('');
  };

  const toggleItem = (id: string) =>
    setList(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));

  const removeItem = (id: string) => setList(items.filter((i) => i.id !== id));

  const uncheckAll = () => setList(items.map((i) => ({ ...i, done: false })));

  const clearDone = () => setList(items.filter((i) => !i.done));

  const copyList = async () => {
    const lines = pending.map((i) => `• ${i.text}${i.qty ? ` (${i.qty})` : ''}`);
    if (lines.length === 0) {
      showToast('Nothing pending to copy');
      return;
    }
    try {
      await navigator.clipboard.writeText(`Shopping list:\n${lines.join('\n')}`);
      showToast('List copied to clipboard');
    } catch {
      showToast('Could not copy — clipboard unavailable');
    }
  };

  return (
    <div className="page-content">
      {/* Header card */}
      <Card className="mb-4" padding="sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[var(--primary-light)] flex items-center justify-center text-[var(--primary)]">
            <ShoppingCart size={20} />
          </div>
          <div className="flex-1">
            <h3 className="card__title mb-0">Shopping List</h3>
            <p className="text-xs text-[var(--text-muted)]">
              {pending.length} pending · {done.length} done
            </p>
          </div>
        </div>
      </Card>

      {/* Add form */}
      <Card className="mb-4">
        <div className="flex gap-2 items-stretch">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addItem()}
            placeholder="e.g. Eggs"
            aria-label="Item name"
            className="flex-1 min-w-0 h-[52px] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] px-3 text-[var(--text-main)] placeholder:text-[var(--text-muted)]"
          />
          <input
            type="text"
            inputMode="decimal"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addItem()}
            placeholder="Qty"
            aria-label="Quantity (optional)"
            className="w-20 h-[52px] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] px-2 text-center text-[var(--text-main)] placeholder:text-[var(--text-muted)]"
          />
          <button
            onClick={addItem}
            aria-label="Add item to list"
            className="w-[52px] h-[52px] shrink-0 rounded-[var(--radius)] bg-[var(--primary)] text-white flex items-center justify-center active:scale-95 transition-transform"
          >
            <Plus size={22} />
          </button>
        </div>
      </Card>

      {/* List */}
      <Card>
        <h3 className="card__title">Items ({items.length})</h3>
        {sorted.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] py-6 text-center">
            Your list is empty. Add something above ✍️
          </p>
        ) : (
          <div className="space-y-2">
            {sorted.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 p-3 rounded-[var(--radius)] border border-[var(--border)] ${
                  item.done ? 'bg-[var(--surface-2)] opacity-60' : 'bg-[var(--surface-2)]'
                }`}
              >
                <button
                  onClick={() => toggleItem(item.id)}
                  aria-label={item.done ? `Mark ${item.text} as not done` : `Mark ${item.text} as done`}
                  aria-pressed={item.done}
                  className={`w-7 h-7 shrink-0 rounded-full border flex items-center justify-center transition-colors ${
                    item.done
                      ? 'bg-[var(--success,var(--primary))] border-transparent text-white'
                      : 'border-[var(--border)] text-transparent hover:border-[var(--primary)]'
                  }`}
                >
                  <Check size={14} />
                </button>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-medium text-[var(--text-main)] truncate ${
                      item.done ? 'line-through' : ''
                    }`}
                  >
                    {item.text}
                  </div>
                  {item.qty && (
                    <div className="text-xs text-[var(--text-muted)]">{item.qty}</div>
                  )}
                </div>
                <button
                  onClick={() => removeItem(item.id)}
                  aria-label={`Remove ${item.text}`}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--danger)] active:scale-95 transition-transform"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Actions */}
      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mt-4">
          <Button variant="outline" size="sm" icon={<Copy size={14} />} onClick={copyList}>
            Copy
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<RotateCcw size={14} />}
            onClick={() => {
              uncheckAll();
              showToast('All items unchecked');
            }}
          >
            Uncheck all
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (done.length === 0) {
                showToast('Nothing checked yet');
                return;
              }
              clearDone();
              showToast(`Removed ${done.length} checked item${done.length > 1 ? 's' : ''}`);
            }}
          >
            Clear done
          </Button>
        </div>
      )}
    </div>
  );
};
