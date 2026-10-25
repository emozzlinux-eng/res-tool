import { DailyLogEntry, RawItem } from '../types';

/**
 * Neutralize spreadsheet formula injection (CSV/Excel "DDE" attacks).
 * Item names & reasons are user-editable free text; a value starting with
 * = + - @ (or a tab/CR used to force a formula) would execute when the export
 * is opened in Excel/Sheets. Prefixing an apostrophe keeps the text visible
 * but stops evaluation.
 */
export const defuseFormula = (value: string): string =>
  /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;

const escapeCsv = (value: string): string => {
  const safe = defuseFormula(value);
  if (/[",\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
};

const csvRow = (cells: (string | number)[]): string =>
  cells.map((c) => escapeCsv(String(c))).join(',');

/**
 * Export the daily production/waste/restock log as CSV text.
 */
export const logToCsv = (log: DailyLogEntry[]): string => {
  const header = csvRow(['Date', 'Time', 'Type', 'Item', 'Quantity', 'Unit', 'Reason']);
  const rows = log.map((e) =>
    csvRow([
      new Date(e.timestamp).toLocaleDateString('en-CA'), // YYYY-MM-DD, spreadsheet friendly
      e.time,
      e.type,
      e.name,
      e.qty,
      '',
      e.reason ?? '',
    ])
  );
  return [header, ...rows].join('\n');
};

/**
 * Export current inventory levels (with costs when set) as CSV text.
 */
export const inventoryToCsv = (items: RawItem[]): string => {
  const header = csvRow(['Item', 'Unit', 'Current Stock', 'Par Level', 'Cost per Unit', 'Stock Value']);
  const rows = items.map((i) => {
    const cost = i.costPerUnit ?? 0;
    const value = cost > 0 ? Math.round(i.currentStock * cost * 100) / 100 : '';
    return csvRow([
      i.name,
      i.unit,
      i.currentStock,
      i.parLevel,
      cost > 0 ? cost : '',
      value,
    ]);
  });
  return [header, ...rows].join('\n');
};

/**
 * Trigger a client-side file download (works offline).
 */
export const downloadFile = (filename: string, content: string, mime = 'text/csv'): void => {
  const blob = new Blob([content], { type: `${mime};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
