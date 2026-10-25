import * as XLSX from 'xlsx';
import { AppState, DailyLogEntry } from '../types';
import { recipeCost } from './inventory';

/* ------------------------------------------------------------------ */
/* Month-end report generation (Excel .xlsx, works fully offline)      */
/* ------------------------------------------------------------------ */

export interface MonthSummary {
  year: number;
  month: number; // 1-12
  label: string; // e.g. "October 2026"
  producedCount: number;
  wasteCount: number;
  restockCount: number;
  daysActive: number;
  wasteValue: number;
  producedValue: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Value of one log entry priced via recipe cost or raw item cost. */
const entryValue = (state: AppState, e: DailyLogEntry): number => {
  const qty = parseFloat(e.qty) || 0;
  const rc = recipeCost(state, e.name);
  if (rc) return rc.total * qty;
  const raw = state.rawItems.find((i) => i.name === e.name);
  if (raw?.costPerUnit) return raw.costPerUnit * qty;
  return 0;
};

const inMonth = (timestamp: number, year: number, month: number): boolean => {
  const d = new Date(timestamp);
  return d.getFullYear() === year && d.getMonth() + 1 === month;
};

/**
 * Aggregate a month's log into headline numbers for the summary sheet.
 */
export const monthSummary = (state: AppState, year: number, month: number): MonthSummary => {
  const entries = state.dailyLog.filter((e) => inMonth(e.timestamp, year, month));
  let producedCount = 0;
  let wasteCount = 0;
  let restockCount = 0;
  let wasteValue = 0;
  let producedValue = 0;
  const days = new Set<string>();

  for (const e of entries) {
    days.add(new Date(e.timestamp).toLocaleDateString('en-CA'));
    const qty = parseFloat(e.qty) || 0;
    const value = entryValue(state, e);
    if (e.type === 'output') {
      producedCount += qty;
      producedValue += value;
    } else if (e.type === 'waste') {
      wasteCount += qty;
      wasteValue += value;
    } else {
      restockCount += qty;
    }
  }

  const label = new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return {
    year,
    month,
    label,
    producedCount: round2(producedCount),
    wasteCount: round2(wasteCount),
    restockCount: round2(restockCount),
    daysActive: days.size,
    wasteValue: round2(wasteValue),
    producedValue: round2(producedValue),
  };
};

interface SheetSpec {
  name: string;
  rows: (string | number)[][];
}

const autoWidths = (rows: (string | number)[][]): { wch: number }[] => {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, col) => {
      const len = String(cell ?? '').length;
      widths[col] = Math.max(widths[col] ?? 10, Math.min(len + 2, 40));
    });
  }
  return widths.map((wch) => ({ wch }));
};

/**
 * Build the multi-sheet month-end workbook and download it as .xlsx.
 * Sheets: Summary, Production, Waste, Restocks, Inventory Snapshot, Full Log.
 */
export const exportMonthReport = (state: AppState, year: number, month: number): void => {
  const entries = state.dailyLog
    .filter((e) => inMonth(e.timestamp, year, month))
    .sort((a, b) => a.timestamp - b.timestamp);

  const s = monthSummary(state, year, month);

  const summaryRows: (string | number)[][] = [
    ['Month-End Report'],
    ['Period', s.label],
    ['Generated', new Date().toLocaleString()],
    [],
    ['Total produced (units)', s.producedCount],
    ['Total wasted (units)', s.wasteCount],
    ['Total restocked (units)', s.restockCount],
    ['Days with activity', s.daysActive],
    ['Estimated production cost', s.producedValue],
    ['Estimated waste value', s.wasteValue],
    [],
    ['Produced per item'],
    ['Item', 'Quantity'],
  ];
  const byFood = new Map<string, number>();
  for (const e of entries) {
    if (e.type !== 'output') continue;
    byFood.set(e.name, round2((byFood.get(e.name) ?? 0) + (parseFloat(e.qty) || 0)));
  }
  [...byFood.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, qty]) => summaryRows.push([name, qty]));

  const detailHeader = ['Date', 'Time', 'Item', 'Quantity', 'Reason', 'Est. value'];
  const detailRows = (type: DailyLogEntry['type']): (string | number)[][] => {
    const rows: (string | number)[][] = [detailHeader];
    for (const e of entries) {
      if (e.type !== type) continue;
      rows.push([
        new Date(e.timestamp).toLocaleDateString('en-CA'),
        e.time,
        e.name,
        parseFloat(e.qty) || 0,
        e.reason ?? '',
        round2(entryValue(state, e)),
      ]);
    }
    return rows;
  };

  const inventoryRows: (string | number)[][] = [
    ['Item', 'Unit', 'Current Stock', 'Par Level', 'Cost per Unit', 'Stock Value'],
    ...state.rawItems.map((i) => [
      i.name,
      i.unit,
      i.currentStock,
      i.parLevel,
      i.costPerUnit ?? '',
      round2(i.currentStock * (i.costPerUnit ?? 0)),
    ]),
  ];

  const fullLogRows: (string | number)[][] = [
    ['Date', 'Time', 'Type', 'Item', 'Quantity', 'Reason'],
    ...entries.map((e) => [
      new Date(e.timestamp).toLocaleDateString('en-CA'),
      e.time,
      e.type,
      e.name,
      parseFloat(e.qty) || 0,
      e.reason ?? '',
    ]),
  ];

  const sheets: SheetSpec[] = [
    { name: 'Summary', rows: summaryRows },
    { name: 'Production', rows: detailRows('output') },
    { name: 'Waste', rows: detailRows('waste') },
    { name: 'Restocks', rows: detailRows('restock') },
    { name: 'Inventory Snapshot', rows: inventoryRows },
    { name: 'Full Log', rows: fullLogRows },
  ];

  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sheet.rows);
    ws['!cols'] = autoWidths(sheet.rows);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }

  const filename = `month-end-report-${year}-${String(month).padStart(2, '0')}.xlsx`;
  XLSX.writeFile(wb, filename);
};

/** List of (year, month) pairs that actually have log entries, newest first. */
export const monthsWithData = (state: AppState): { year: number; month: number; label: string }[] => {
  const seen = new Map<string, { year: number; month: number; label: string }>();
  for (const e of state.dailyLog) {
    const d = new Date(e.timestamp);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const key = `${y}-${m}`;
    if (!seen.has(key)) {
      seen.set(key, {
        year: y,
        month: m,
        label: new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      });
    }
  }
  return [...seen.values()].sort((a, b) => b.year - a.year || b.month - a.month);
};
