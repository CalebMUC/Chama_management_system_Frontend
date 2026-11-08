// Client-side CSV export: the API has no export endpoints (README §12).
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
}

function escape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  // Neutralise spreadsheet formula injection from user-entered text.
  const safe = /^[=+\-@\t\r]/.test(text) && !/^-?\d/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const head = columns.map((c) => escape(c.header)).join(',');
  const body = rows.map((row) => columns.map((c) => escape(c.value(row))).join(','));
  return [head, ...body].join('\r\n');
}

export function downloadCsv<T>(fileName: string, rows: readonly T[], columns: readonly CsvColumn<T>[]) {
  // A BOM so Excel opens UTF-8 correctly.
  const blob = new Blob(['﻿', toCsv(rows, columns)], { type: 'text/csv;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

/** Minor units as a plain decimal for spreadsheets (150050 -> 1500.5). */
export const csvMoney = (minor: number | null | undefined, digits = 2) => (minor === null || minor === undefined ? '' : minor / 10 ** digits);
