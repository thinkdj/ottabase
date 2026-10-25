import type { ChartRow } from './types';

/**
 * Rows to RFC 4180 CSV. `columns` picks and orders the columns (default: the keys of
 * the first row). Values with commas, quotes or newlines are quoted. Text that a
 * spreadsheet would run as a formula (`=`, `+`, `-`, `@`, tab, CR first) gets a leading
 * `'`, so a page title like `=HYPERLINK(…)` opens as text; numbers are left alone.
 */
export function toCsv(rows: ChartRow[], columns?: { key: string; label?: string }[]): string {
    const cols: { key: string; label?: string }[] = columns ?? Object.keys(rows[0] ?? {}).map((key) => ({ key }));
    const cell = (v: unknown) => {
        let s = v === null || v === undefined ? '' : String(v);
        if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s) && !Number.isFinite(Number(s))) s = `'${s}`;
        return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = cols.map((c) => cell(c.label ?? c.key)).join(',');
    const body = rows.map((row) => cols.map((c) => cell(row[c.key])).join(','));
    return [head, ...body].join('\r\n');
}
