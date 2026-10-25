import React, { useMemo, useRef, useState } from 'react';
import { ChevronRight, Plus, Trash2, Pencil } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { useApp } from '../hooks/useAppState';
import { Food, RawItem, Recipe, Supplier } from '../types';
import { DEFAULT_STATE } from '../types';
import { clearState, normalizeState, persistPanicWipeEnabled, wrapBackup, unwrapBackup } from '../utils/storage';
import { sanitize } from '../utils/helpers';
import { recipeCost } from '../utils/inventory';
import { downloadFile, logToCsv } from '../utils/export';
import { dayKey } from '../utils/format';
import { Sheet } from '../components/ui/Sheet';

type EditorKind = 'foods' | 'recipes' | 'rawItems' | 'suppliers' | null;

interface ProfilePageProps {
  onOpenChangePin: () => void;
}

/** Small inline id generator for recipe draft lines (stable React keys). */
let lineSeq = 0;
const nextLineId = () => `line_${Date.now().toString(36)}_${++lineSeq}`;

export const ProfilePage: React.FC<ProfilePageProps> = ({ onOpenChangePin }) => {
  const { state, setState, updateState, showToast, lock, replayTutorial } = useApp();
  const [editor, setEditor] = useState<EditorKind>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [nameValue, setNameValue] = useState(state.userName);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const counts = useMemo(
    () => ({
      foods: state.foods.length,
      recipes: state.recipes.length,
      rawItems: state.rawItems.length,
      suppliers: state.suppliers.length,
    }),
    [state]
  );

  // ---------- Backup / Restore / Reset ----------
  const handleBackup = () => {
    // Versioned envelope (app id + schemaVersion) so future releases can
    // migrate old files instead of guessing, and foreign JSON is rejected.
    downloadFile(
      `inventory-pro-backup-${dayKey(Date.now())}.json`,
      JSON.stringify(wrapBackup(state), null, 2),
      'application/json'
    );
    showToast('Backup downloaded');
  };

  const handleExportCsv = () => {
    if (state.dailyLog.length === 0) {
      showToast('Nothing to export yet');
      return;
    }
    downloadFile(`inventory-pro-log-${dayKey(Date.now())}.csv`, logToCsv(state.dailyLog));
    showToast('Log exported as CSV');
  };

  const handleRestoreFile = (file: File) => {
    // Guard against multi-GB "backups": reading them into memory would hang
    // or crash the tab before normalizeState ever runs.
    if (file.size > 10 * 1024 * 1024) {
      showToast('File too large to be a valid backup (max 10 MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as unknown;
        // Rejects files that clearly aren't ours; passes legacy bare-state
        // backups through unchanged for backward compatibility.
        const inner = unwrapBackup(parsed);
        // Repair/validate every field before adopting the backup — a corrupt
        // or foreign JSON file can never poison the running app state.
        const restored = normalizeState(inner);
        setState({ ...DEFAULT_STATE, ...restored });
        showToast('Backup restored');
      } catch {
        showToast('Restore failed — invalid backup file');
      }
    };
    reader.onerror = () => showToast('Could not read that file');
    reader.readAsText(file);
  };

  const handleReset = () => {
    setShowResetDialog(false);
    clearState();
    setState({ ...DEFAULT_STATE, onboardingSeen: false, pin: '' });
    showToast('All data reset');
  };

  // ---------- Master data editors ----------
  const openEditor = (kind: Exclude<EditorKind, null>) => {
    setEditor(kind);
    setEditingIndex(null);
  };

  const closeEditor = () => {
    setEditor(null);
    setEditingIndex(null);
    setFoodDraft({ name: '', icon: '🍞', category: '' });
    setRawDraft({ name: '', icon: '📦', unit: 'kg', parLevel: '1', currentStock: '0', costPerUnit: '' });
    setSupplierDraft({ name: '', phone: '', items: '' });
    setRecipeDraft({ foodName: '', lines: [] });
  };

  // Draft forms
  const [foodDraft, setFoodDraft] = useState({ name: '', icon: '🍞', category: '' });
  const [rawDraft, setRawDraft] = useState({ name: '', icon: '📦', unit: 'kg', parLevel: '1', currentStock: '0', costPerUnit: '' });
  const [supplierDraft, setSupplierDraft] = useState({ name: '', phone: '', items: '' });
  const [recipeDraft, setRecipeDraft] = useState<{ foodName: string; lines: { id: string; itemName: string; qty: string }[] }>({
    foodName: '',
    lines: [],
  });

  const loadForEdit = (kind: Exclude<EditorKind, null>, index: number) => {
    setEditingIndex(index);
    if (kind === 'foods') {
      const f = state.foods[index];
      setFoodDraft({ name: f.name, icon: f.icon, category: f.category });
    } else if (kind === 'rawItems') {
      const r = state.rawItems[index];
      setRawDraft({ name: r.name, icon: r.icon, unit: r.unit, parLevel: String(r.parLevel), currentStock: String(r.currentStock), costPerUnit: r.costPerUnit ? String(r.costPerUnit) : '' });
    } else if (kind === 'suppliers') {
      const s = state.suppliers[index];
      setSupplierDraft({ name: s.name, phone: s.phone, items: s.items.join(', ') });
    } else if (kind === 'recipes') {
      const rec = state.recipes[index];
      setRecipeDraft({
        foodName: rec.foodName,
        lines: rec.ingredients.map((i) => ({ id: nextLineId(), itemName: i.itemName, qty: String(i.qty) })),
      });
    }
  };

  const removeAt = <K extends 'foods' | 'rawItems' | 'suppliers' | 'recipes'>(key: K, index: number) => {
    setState((prev) => ({ ...prev, [key]: prev[key].filter((_, i) => i !== index) }));
    if (editingIndex === index) setEditingIndex(null);
    showToast('Deleted');
  };

  const saveFood = () => {
    const name = sanitize(foodDraft.name.trim());
    if (!name) { showToast('Name is required'); return; }
    const food: Food = { name, icon: foodDraft.icon || '🍞', category: sanitize(foodDraft.category.trim()) || 'General' };
    setState((prev) => {
      if (editingIndex !== null) {
        const old = prev.foods[editingIndex];
        // rename cascades to recipes
        const foods = prev.foods.map((f, i) => (i === editingIndex ? food : f));
        const recipes = prev.recipes.map((r) =>
          r.foodName === old.name ? { ...r, foodName: food.name } : r
        );
        return { ...prev, foods, recipes };
      }
      if (prev.foods.some((f) => f.name === food.name)) { showToast('That food already exists'); return prev; }
      return { ...prev, foods: [...prev.foods, food] };
    });
    showToast(editingIndex !== null ? 'Food updated' : 'Food added');
    setEditingIndex(null);
    setFoodDraft({ name: '', icon: '🍞', category: '' });
  };

  const saveRawItem = () => {
    const name = sanitize(rawDraft.name.trim());
    if (!name) { showToast('Name is required'); return; }
    const item: RawItem = {
      name,
      icon: rawDraft.icon || '📦',
      unit: rawDraft.unit.trim() || 'pcs',
      parLevel: Math.max(0, parseFloat(rawDraft.parLevel) || 0),
      currentStock: Math.max(0, parseFloat(rawDraft.currentStock) || 0),
      costPerUnit: Math.max(0, parseFloat(rawDraft.costPerUnit) || 0),
    };
    setState((prev) => {
      if (editingIndex !== null) {
        const old = prev.rawItems[editingIndex];
        const rawItems = prev.rawItems.map((r, i) => (i === editingIndex ? item : r));
        const suppliers = prev.suppliers.map((s) => ({
          ...s,
          items: s.items.map((n) => (n === old.name ? item.name : n)),
        }));
        const recipes = prev.recipes.map((rec) => ({
          ...rec,
          ingredients: rec.ingredients.map((ing) =>
            ing.itemName === old.name ? { ...ing, itemName: item.name } : ing
          ),
        }));
        return { ...prev, rawItems, suppliers, recipes };
      }
      if (prev.rawItems.some((r) => r.name === item.name)) { showToast('That item already exists'); return prev; }
      return { ...prev, rawItems: [...prev.rawItems, item] };
    });
    showToast(editingIndex !== null ? 'Item updated' : 'Item added');
    setEditingIndex(null);
    setRawDraft({ name: '', icon: '📦', unit: 'kg', parLevel: '1', currentStock: '0', costPerUnit: '' });
  };

  const saveSupplier = () => {
    const name = sanitize(supplierDraft.name.trim());
    if (!name) { showToast('Name is required'); return; }
    const supplier: Supplier = {
      name,
      phone: supplierDraft.phone.replace(/[^\d+ -]/g, ''),
      items: supplierDraft.items.split(',').map((s) => sanitize(s.trim())).filter(Boolean),
    };
    setState((prev) => {
      if (editingIndex !== null) {
        const suppliers = prev.suppliers.map((s, i) => (i === editingIndex ? supplier : s));
        return { ...prev, suppliers };
      }
      if (prev.suppliers.some((s) => s.name === supplier.name)) { showToast('That supplier already exists'); return prev; }
      return { ...prev, suppliers: [...prev.suppliers, supplier] };
    });
    showToast(editingIndex !== null ? 'Supplier updated' : 'Supplier added');
    setEditingIndex(null);
    setSupplierDraft({ name: '', phone: '', items: '' });
  };

  const saveRecipe = () => {
    if (!recipeDraft.foodName) { showToast('Pick a food'); return; }
    const recipe: Recipe = {
      foodName: recipeDraft.foodName,
      ingredients: recipeDraft.lines
        .filter((l) => l.itemName && parseFloat(l.qty) > 0)
        .map((l) => ({ itemName: l.itemName, qty: parseFloat(l.qty) })),
    };
    if (recipe.ingredients.length === 0) { showToast('Add at least one ingredient'); return; }
    setState((prev) => {
      if (editingIndex !== null) {
        const recipes = prev.recipes.map((r, i) => (i === editingIndex ? recipe : r));
        return { ...prev, recipes };
      }
      const recipes = prev.recipes.filter((r) => r.foodName !== recipe.foodName);
      return { ...prev, recipes: [...recipes, recipe] };
    });
    showToast(editingIndex !== null ? 'Recipe updated' : 'Recipe saved');
    setEditingIndex(null);
    setRecipeDraft({ foodName: '', lines: [] });
  };

  // ---------- Render helpers ----------
  const editorTitle: Record<Exclude<EditorKind, null>, string> = {
    foods: 'Foods',
    recipes: 'Recipes',
    rawItems: 'Raw Items',
    suppliers: 'Suppliers',
  };

  const listRows = (): React.ReactNode => {
    if (!editor) return null;
    if (editor === 'foods') {
      return state.foods.map((f, i) => (
        <Row key={f.name} label={`${f.icon} ${f.name}`} sub={f.category} onEdit={() => loadForEdit('foods', i)} onDelete={() => removeAt('foods', i)} />
      ));
    }
    if (editor === 'rawItems') {
      return state.rawItems.map((r, i) => (
        <Row key={r.name} label={`${r.icon} ${r.name}`} sub={`${r.currentStock}/${r.parLevel} ${r.unit}${(r.costPerUnit ?? 0) > 0 ? ` · ${r.costPerUnit}/${r.unit}` : ''}`} onEdit={() => loadForEdit('rawItems', i)} onDelete={() => removeAt('rawItems', i)} />
      ));
    }
    if (editor === 'suppliers') {
      return state.suppliers.map((s, i) => (
        <Row key={s.name} label={`🏪 ${s.name}`} sub={`${s.items.length} items · ${s.phone || 'no phone'}`} onEdit={() => loadForEdit('suppliers', i)} onDelete={() => removeAt('suppliers', i)} />
      ));
    }
    return state.recipes.map((r, i) => (
      <Row key={r.foodName} label={`📋 ${r.foodName}`} sub={`${r.ingredients.length} ingredients`} onEdit={() => loadForEdit('recipes', i)} onDelete={() => removeAt('recipes', i)} />
    ));
  };

  const formNode = (): React.ReactNode => {
    if (!editor) return null;
    if (editor === 'foods') {
      return (
        <div className="space-y-3">
          <Input label="Food name" value={foodDraft.name} onChange={(e) => setFoodDraft({ ...foodDraft, name: e.target.value })} />
          <Input label="Emoji icon" value={foodDraft.icon} onChange={(e) => setFoodDraft({ ...foodDraft, icon: e.target.value })} />
          <Input label="Category" value={foodDraft.category} onChange={(e) => setFoodDraft({ ...foodDraft, category: e.target.value })} placeholder="e.g. Pastries" />
          <Button fullWidth onClick={saveFood}>{editingIndex !== null ? 'Save changes' : 'Add food'}</Button>
        </div>
      );
    }
    if (editor === 'rawItems') {
      return (
        <div className="space-y-3">
          <Input label="Item name" value={rawDraft.name} onChange={(e) => setRawDraft({ ...rawDraft, name: e.target.value })} />
          <Input label="Emoji icon" value={rawDraft.icon} onChange={(e) => setRawDraft({ ...rawDraft, icon: e.target.value })} />
          <div className="grid grid-cols-3 gap-2">
            <Input label="Unit" value={rawDraft.unit} onChange={(e) => setRawDraft({ ...rawDraft, unit: e.target.value })} />
            <Input label="Par level" type="number" inputMode="decimal" value={rawDraft.parLevel} onChange={(e) => setRawDraft({ ...rawDraft, parLevel: e.target.value })} />
            <Input label="In stock" type="number" inputMode="decimal" value={rawDraft.currentStock} onChange={(e) => setRawDraft({ ...rawDraft, currentStock: e.target.value })} />
          </div>
          <Input label="Cost per unit (optional)" type="number" inputMode="decimal" min="0" step="0.01" value={rawDraft.costPerUnit} onChange={(e) => setRawDraft({ ...rawDraft, costPerUnit: e.target.value })} placeholder="e.g. 1.20" hint="Used for recipe costs and waste value" />
          <Button fullWidth onClick={saveRawItem}>{editingIndex !== null ? 'Save changes' : 'Add item'}</Button>
        </div>
      );
    }
    if (editor === 'suppliers') {
      return (
        <div className="space-y-3">
          <Input label="Supplier name" value={supplierDraft.name} onChange={(e) => setSupplierDraft({ ...supplierDraft, name: e.target.value })} />
          <Input label="Phone (for WhatsApp orders)" type="tel" value={supplierDraft.phone} onChange={(e) => setSupplierDraft({ ...supplierDraft, phone: e.target.value })} placeholder="15551234567" />
          <Input label="Supplies items (comma separated)" value={supplierDraft.items} onChange={(e) => setSupplierDraft({ ...supplierDraft, items: e.target.value })} placeholder="Flour, Butter" hint="Use exact raw item names" />
          <Button fullWidth onClick={saveSupplier}>{editingIndex !== null ? 'Save changes' : 'Add supplier'}</Button>
        </div>
      );
    }
    // recipes
    return (
      <div className="space-y-3">
        <select
          value={recipeDraft.foodName}
          onChange={(e) => setRecipeDraft({ ...recipeDraft, foodName: e.target.value })}
          aria-label="Food for this recipe"
          className="w-full h-[52px] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] px-3 text-[var(--text-main)]"
        >
          <option value="">Choose food…</option>
          {state.foods.map((f) => (
            <option key={f.name} value={f.name}>{f.icon} {f.name}</option>
          ))}
        </select>
        {recipeDraft.lines.map((line, i) => (
          <div key={line.id} className="flex gap-2 items-center">
            <select
              value={line.itemName}
              onChange={(e) => {
                const lines = [...recipeDraft.lines];
                lines[i] = { ...lines[i], itemName: e.target.value };
                setRecipeDraft({ ...recipeDraft, lines });
              }}
              aria-label={`Ingredient ${i + 1}`}
              className="flex-1 h-11 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] px-2 text-sm text-[var(--text-main)]"
            >
              <option value="">Item…</option>
              {state.rawItems.map((r) => (
                <option key={r.name} value={r.name}>{r.name} ({r.unit})</option>
              ))}
            </select>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={line.qty}
              onChange={(e) => {
                const lines = [...recipeDraft.lines];
                lines[i] = { ...lines[i], qty: e.target.value };
                setRecipeDraft({ ...recipeDraft, lines });
              }}
              placeholder="qty"
              aria-label={`Quantity of ${line.itemName || 'ingredient'} per unit`}
              className="w-20 h-11 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] px-2 text-sm text-[var(--text-main)]"
            />
            <button
              onClick={() => setRecipeDraft({ ...recipeDraft, lines: recipeDraft.lines.filter((_, j) => j !== i) })}
              aria-label="Remove ingredient line"
              className="w-9 h-9 flex items-center justify-center text-[var(--danger)]"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <Button
          variant="outline"
          fullWidth
          icon={<Plus size={16} />}
          onClick={() => setRecipeDraft({ ...recipeDraft, lines: [...recipeDraft.lines, { id: nextLineId(), itemName: '', qty: '' }] })}
        >
          Add ingredient
        </Button>
        {(() => {
          const rc = recipeDraft.foodName ? recipeCost(state, recipeDraft.foodName) : null;
          if (!rc) return null;
          return (
            <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text-sub)]">
              <strong className="text-[var(--text-main)]">Estimated ingredient cost: {state.currency}{rc.total.toFixed(2)} per unit</strong>
              <div className="mt-1 space-y-0.5">
                {rc.lines.filter((l) => l.cost > 0).map((l) => (
                  <div key={l.itemName}>• {l.itemName}: {l.qty} × {state.currency}{(state.rawItems.find((r) => r.name === l.itemName)?.costPerUnit ?? 0).toFixed(2)} = {state.currency}{l.cost.toFixed(2)}</div>
                ))}
              </div>
              <div className="mt-1 text-[var(--text-muted)]">Set a cost per unit on raw items (edit an item) to see real numbers.</div>
            </div>
          );
        })()}
        <Button fullWidth onClick={saveRecipe}>{editingIndex !== null ? 'Save changes' : 'Save recipe'}</Button>
      </div>
    );
  };

  // ---------- Main render ----------
  if (editor) {
    return (
      <div className="page-content">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={closeEditor}
            aria-label="Back to profile"
            className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--surface-2)] border border-[var(--border)] rotate-180 text-[var(--text-main)]"
          >
            <ChevronRight size={18} />
          </button>
          <h2 className="text-lg font-semibold text-[var(--text-main)]">{editorTitle[editor]}</h2>
        </div>

        <Card className="mb-4">
          <h3 className="card__title">{editingIndex !== null ? 'Edit entry' : 'New entry'}</h3>
          {formNode()}
          {editingIndex !== null && (
            <button
              onClick={() => { setEditingIndex(null); }}
              className="mt-3 text-xs text-[var(--text-sub)] underline"
            >
              Cancel edit (make a new entry instead)
            </button>
          )}
        </Card>

        <Card>
          <h3 className="card__title">Existing ({editor === 'recipes' ? state.recipes.length : state[editor].length})</h3>
          <div className="space-y-2">{listRows()}</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-content">
      {/* Profile Header */}
      <div className="text-center mb-6 pt-2">
        <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl bg-[var(--primary-light)]">
          👤
        </div>
        <h2 className="text-lg font-semibold text-[var(--text-main)]">{state.userName || 'Manager'}</h2>
        <p className="text-sm text-[var(--text-sub)]">Store Manager</p>
        <button
          onClick={() => { setNameValue(state.userName); setShowNameDialog(true); }}
          className="text-xs text-[var(--primary)] underline mt-1"
        >
          Edit name
        </button>
      </div>

      {/* Security Group */}
      <div className="mb-6">
        <p className="settings-group__title">Security</p>
        <div className="settings-group">
          <button className="settings-item" onClick={onOpenChangePin}>
            <div className="settings-item__icon bg-[var(--primary-light)]">🔐</div>
            <div className="settings-item__content">
              <div className="settings-item__label">Change PIN</div>
              <div className="settings-item__desc">Update your security PIN</div>
            </div>
            <ChevronRight size={16} className="settings-item__chevron" />
          </button>
          <button className="settings-item" onClick={() => setShowLockDialog(true)}>
            <div className="settings-item__icon bg-[var(--primary-light)]">⏱️</div>
            <div className="settings-item__content">
              <div className="settings-item__label">Auto-Lock Timer</div>
              <div className="settings-item__desc">{state.autoLockMinutes} minutes</div>
            </div>
            <ChevronRight size={16} className="settings-item__chevron" />
          </button>
          <button className="settings-item" onClick={replayTutorial}>
            <div className="settings-item__icon bg-[var(--primary-light)]">🎓</div>
            <div className="settings-item__content">
              <div className="settings-item__label">App Tutorial</div>
              <div className="settings-item__desc">Replay onboarding</div>
            </div>
            <ChevronRight size={16} className="settings-item__chevron" />
          </button>
          <button className="settings-item" onClick={lock}>
            <div className="settings-item__icon bg-[var(--primary-light)]">🔒</div>
            <div className="settings-item__content">
              <div className="settings-item__label">Lock Now</div>
              <div className="settings-item__desc">Require PIN to reopen</div>
            </div>
            <ChevronRight size={16} className="settings-item__chevron" />
          </button>
          <div className="settings-item">
            <div className="settings-item__icon bg-[var(--surface-2)]">🔀</div>
            <div className="settings-item__content">
              <div className="settings-item__label">Scramble Keypad</div>
              <div className="settings-item__desc">Randomize PIN key positions at login</div>
            </div>
            <ToggleSwitch checked={state.scrambleKeypad} onChange={(c) => updateState({ scrambleKeypad: c })} label="" />
          </div>
          <div className="settings-item">
            <div className="settings-item__icon bg-[var(--surface-2)]">🫥</div>
            <div className="settings-item__content">
              <div className="settings-item__label">Privacy Lock on Hide</div>
              <div className="settings-item__desc">Lock the app when you switch tabs or apps</div>
            </div>
            <ToggleSwitch checked={state.privacyBlur} onChange={(c) => updateState({ privacyBlur: c })} label="" />
          </div>
          <div className="settings-item">
            <div className="settings-item__icon bg-[var(--danger-bg)]">💣</div>
            <div className="settings-item__content">
              <div className="settings-item__label">Panic Erase Option</div>
              <div className="settings-item__desc">Offer “erase all data” after 5 wrong PINs (requires your correct PIN to fire)</div>
            </div>
            <ToggleSwitch
              checked={state.panicWipeEnabled}
              onChange={(c) => {
                // Persist to its own key (not the backup blob) — see storage.ts
                persistPanicWipeEnabled(c);
                updateState({ panicWipeEnabled: c });
              }}
              label=""
            />
          </div>
        </div>
      </div>

      {/* Master Data Group */}
      <div className="mb-6">
        <p className="settings-group__title">Master Data</p>
        <div className="settings-group">
          {(
            [
              { kind: 'foods', icon: '🍞', label: 'Foods', count: counts.foods },
              { kind: 'recipes', icon: '📋', label: 'Recipes', count: counts.recipes },
              { kind: 'rawItems', icon: '📦', label: 'Raw Items', count: counts.rawItems },
              { kind: 'suppliers', icon: '🏪', label: 'Suppliers', count: counts.suppliers },
            ] as { kind: Exclude<EditorKind, null>; icon: string; label: string; count: number }[]
          ).map((item) => (
            <button key={item.kind} className="settings-item" onClick={() => openEditor(item.kind)}>
              <div className="settings-item__icon bg-[var(--surface-2)]">{item.icon}</div>
              <div className="settings-item__content">
                <div className="settings-item__label">{item.label}</div>
              </div>
              <span className="badge badge--primary mr-2">{item.count}</span>
              <ChevronRight size={16} className="settings-item__chevron" />
            </button>
          ))}
        </div>
      </div>

      {/* Preferences Group */}
      <div className="mb-6">
        <p className="settings-group__title">Preferences</p>
        <div className="settings-group">
          <div className="settings-item">
            <div className="settings-item__icon bg-[var(--surface-2)]">🌙</div>
            <div className="settings-item__content">
              <div className="settings-item__label">Dark Mode</div>
            </div>
            <ToggleSwitch checked={state.darkMode} onChange={(checked) => updateState({ darkMode: checked })} label="" />
          </div>
          <div className="settings-item">
            <div className="settings-item__icon bg-[var(--surface-2)]">💱</div>
            <div className="settings-item__content">
              <div className="settings-item__label">Currency</div>
              <div className="settings-item__desc">Used for costs, stock value &amp; waste</div>
            </div>
            <select
              value={state.currency}
              onChange={(e) => updateState({ currency: e.target.value })}
              aria-label="Choose currency symbol"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm text-[var(--text-main)]"
            >
              {['$', '₦', '₹', '£', '€', 'R', 'KSh', 'Cedi', 'GHC', 'AED', 'SAR'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <button className="settings-item" onClick={handleBackup}>
            <div className="settings-item__icon bg-[var(--surface-2)]">💾</div>
            <div className="settings-item__content">
              <div className="settings-item__label">Backup Data</div>
              <div className="settings-item__desc">Export as JSON</div>
            </div>
            <ChevronRight size={16} className="settings-item__chevron" />
          </button>
          <button className="settings-item" onClick={() => fileInputRef.current?.click()}>
            <div className="settings-item__icon bg-[var(--surface-2)]">📂</div>
            <div className="settings-item__content">
              <div className="settings-item__label">Restore Backup</div>
              <div className="settings-item__desc">Import from JSON</div>
            </div>
            <ChevronRight size={16} className="settings-item__chevron" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="Choose backup file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleRestoreFile(file);
              e.target.value = '';
            }}
          />
          <button className="settings-item" onClick={handleExportCsv}>
            <div className="settings-item__icon bg-[var(--surface-2)]">📊</div>
            <div className="settings-item__content">
              <div className="settings-item__label">Export Log as CSV</div>
              <div className="settings-item__desc">For accounting</div>
            </div>
            <ChevronRight size={16} className="settings-item__chevron" />
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="mb-6">
        <p className="settings-group__title">Danger Zone</p>
        <div className="settings-group">
          <button className="settings-item settings-item--danger" onClick={() => setShowResetDialog(true)}>
            <div className="settings-item__icon bg-[var(--danger-bg)]">🗑️</div>
            <div className="settings-item__content">
              <div className="settings-item__label">Reset All Data</div>
              <div className="settings-item__desc" style={{ color: 'var(--danger)' }}>This cannot be undone</div>
            </div>
          </button>
        </div>
      </div>

      {/* Privacy */}
      <Card className="mb-6">
        <h3 className="card__title">🛡️ Privacy &amp; security</h3>
        <ul className="space-y-1.5 text-xs text-[var(--text-sub)] list-none">
          <li>✅ 100% offline — no servers, no accounts, no tracking, no analytics.</li>
          <li>✅ All data lives only in this browser’s local storage.</li>
          <li>✅ Your PIN is never stored — only a salted SHA-256 (PBKDF2, 100k rounds) hash.</li>
          <li>✅ Wrong-PIN lockouts persist even if the page reloads.</li>
          <li>⚠️ Anyone with this device and your PIN can see the data — keep backups private.</li>
        </ul>
      </Card>

      {/* About */}
      <div className="text-center py-4">
        <p className="text-xs text-[var(--text-muted)]">Inventory Pro v{__APP_VERSION__} · offline &amp; private by design</p>
      </div>

      {/* Name dialog */}
      {showNameDialog && (
        <Modal title="Your name" onClose={() => setShowNameDialog(false)}>
          <Input
            label="Name"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            maxLength={30}
          />
          <Button
            fullWidth
            className="mt-3"
            onClick={() => {
              updateState({ userName: sanitize(nameValue.trim()) || 'Manager' });
              setShowNameDialog(false);
              showToast('Name saved');
            }}
          >
            Save
          </Button>
        </Modal>
      )}

      {/* Auto-lock dialog */}
      {showLockDialog && (
        <Modal title="Auto-Lock Timer" onClose={() => setShowLockDialog(false)}>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 5, 10, 15, 30, 60].map((m) => (
              <button
                key={m}
                onClick={() => {
                  updateState({ autoLockMinutes: m });
                  setShowLockDialog(false);
                  showToast(`Auto-lock set to ${m} minutes`);
                }}
                className={`px-4 py-2 rounded-full text-sm border ${
                  state.autoLockMinutes === m
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                    : 'bg-[var(--surface-2)] text-[var(--text-main)] border-[var(--border)]'
                }`}
              >
                {m} min
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Reset confirmation — in-app sheet instead of window.confirm */}
      {showResetDialog && (
        <Sheet title="Reset all data?" onClose={() => setShowResetDialog(false)}>
          <p className="text-sm text-[var(--text-sub)] mb-4">
            This permanently deletes every food, ingredient, recipe, supplier and log entry stored on this device.
            It cannot be undone — export a backup first if you might need this data later.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" fullWidth onClick={() => setShowResetDialog(false)}>
              Cancel
            </Button>
            <Button variant="danger" fullWidth onClick={handleReset}>
              Delete everything
            </Button>
          </div>
        </Sheet>
      )}
    </div>
  );
};

/* ---------- Small local components ---------- */

const Row: React.FC<{ label: string; sub?: string; onEdit: () => void; onDelete: () => void }> = ({
  label,
  sub,
  onEdit,
  onDelete,
}) => (
  <div className="flex items-center gap-3 p-3 rounded-[var(--radius)] bg-[var(--surface-2)] border border-[var(--border)]">
    <div className="flex-1 min-w-0">
      <div className="text-sm font-medium text-[var(--text-main)] truncate">{label}</div>
      {sub && <div className="text-xs text-[var(--text-muted)] truncate">{sub}</div>}
    </div>
    <button onClick={onEdit} aria-label={`Edit ${label}`} className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-sub)]">
      <Pencil size={15} />
    </button>
    <button onClick={onDelete} aria-label={`Delete ${label}`} className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--danger)]">
      <Trash2 size={15} />
    </button>
  </div>
);

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({
  title,
  onClose,
  children,
}) => (
  <div
    className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
    onClick={onClose}
    role="dialog"
    aria-modal="true"
    aria-label={title}
  >
    <div
      className="w-full max-w-[360px] bg-[var(--surface)] rounded-2xl p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="card__title mb-0">{title}</h3>
        <button onClick={onClose} aria-label="Close dialog" className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)]">
          ✕
        </button>
      </div>
      {children}
    </div>
  </div>
);
