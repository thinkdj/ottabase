import type { ChartRow } from './types';

/** A chart value: finite numbers and numeric strings count; null, '', NaN and the rest are gaps. */
export function toNumber(value: unknown): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string' && value.trim() !== '') {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}

/** A count for funnels and flows: a finite, non-negative number; anything else is 0. */
export function toCount(value: unknown): number {
    return Math.max(0, toNumber(value) ?? 0);
}

export type TimeStep = 'hour' | 'day' | 'week' | 'month';

const DAY = 86_400_000;

/**
 * Parse a date, reading zone-less timestamps as UTC. `new Date('2026-10-25 14:00')` is local
 * time in a browser but UTC in a Worker; SQL and Analytics Engine emit that shape.
 */
export function parseDate(value: Date | string | number): Date {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(value)) {
        return new Date(`${value.replace(' ', 'T')}Z`);
    }
    return new Date(value);
}

/** Truncate a date to the start of its UTC bucket. Weeks start on Monday (ISO 8601). */
export function bucketStart(date: Date | string | number, step: TimeStep): Date {
    const d = parseDate(date);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const day = d.getUTCDate();
    switch (step) {
        case 'hour':
            return new Date(Date.UTC(y, m, day, d.getUTCHours()));
        case 'day':
            return new Date(Date.UTC(y, m, day));
        case 'week': {
            const midnight = Date.UTC(y, m, day);
            return new Date(midnight - ((d.getUTCDay() + 6) % 7) * DAY);
        }
        case 'month':
            return new Date(Date.UTC(y, m, 1));
    }
}

/** The bucket's key as stored in the index column: `2026-10-25`, or `2026-10-25T14:00Z` for hours. */
export function bucketKey(date: Date | string | number, step: TimeStep): string {
    const iso = bucketStart(date, step).toISOString();
    return step === 'hour' ? `${iso.slice(0, 13)}:00Z` : iso.slice(0, 10);
}

function nextBucket(d: Date, step: TimeStep): Date {
    if (step === 'month') return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    return new Date(d.getTime() + (step === 'hour' ? 3_600_000 : step === 'week' ? 7 * DAY : DAY));
}

export interface FillTimeSeriesOptions {
    /** Column holding the date (anything `new Date()` parses). */
    index: string;
    step: TimeStep;
    /** First bucket. Defaults to the earliest row. */
    start?: Date | string | number;
    /** Last bucket, inclusive. Defaults to the latest row. */
    end?: Date | string | number;
    /** Values for an empty bucket, e.g. `{ clicks: 0 }`. Omitted columns stay missing, which charts draw as gaps. */
    fill?: ChartRow;
}

/**
 * Turn sparse rows into one row per time bucket, in order. Analytics queries return
 * only the days that had events; a chart of that skips the quiet days and lies about
 * the trend. Rows that land in the same bucket are merged by summing numeric columns.
 * Buckets are UTC.
 */
export function fillTimeSeries(rows: ChartRow[], options: FillTimeSeriesOptions): ChartRow[] {
    const { index, step, fill = {} } = options;
    const byKey = new Map<string, ChartRow>();
    let min = Infinity;
    let max = -Infinity;
    for (const row of rows) {
        const raw = row[index];
        const t = parseDate(raw as string | number | Date).getTime();
        if (raw === null || raw === undefined || Number.isNaN(t)) continue;
        min = Math.min(min, t);
        max = Math.max(max, t);
        const key = bucketKey(t, step);
        const prev = byKey.get(key);
        if (!prev) {
            byKey.set(key, { ...row, [index]: key });
            continue;
        }
        for (const [col, value] of Object.entries(row)) {
            if (col === index) continue;
            const a = toNumber(prev[col]);
            const b = toNumber(value);
            prev[col] = a !== null && b !== null ? a + b : (prev[col] ?? value);
        }
    }
    const startT = options.start !== undefined ? parseDate(options.start).getTime() : min;
    const endT = options.end !== undefined ? parseDate(options.end).getTime() : max;
    if (!Number.isFinite(startT) || !Number.isFinite(endT)) return [];
    const out: ChartRow[] = [];
    const last = bucketStart(endT, step).getTime();
    // ponytail: hard cap stops a bad range (hours over years) from building a million rows.
    for (let d = bucketStart(startT, step); d.getTime() <= last && out.length < 10_000; d = nextBucket(d, step)) {
        const key = bucketKey(d, step);
        out.push(byKey.get(key) ?? { ...fill, [index]: key });
    }
    return out;
}

export interface PivotOptions {
    /** Column that becomes the x axis (one output row per distinct value). */
    index: string;
    /** Column whose distinct values become series. */
    column: string;
    /** Column holding the number. */
    value: string;
    /** Value for a missing index × column pair. Default 0. */
    fill?: number | null;
}

/**
 * Long rows (`{ day, country, clicks }`) to wide rows (`{ day, US: 3, DE: 1 }`), the
 * shape every cartesian chart takes. Returns the series keys in first-seen order.
 * Duplicate pairs are summed.
 */
export function pivot(rows: ChartRow[], options: PivotOptions): { data: ChartRow[]; keys: string[] } {
    const { index, column, value, fill = 0 } = options;
    const keys: string[] = [];
    const seen = new Set<string>();
    const byIndex = new Map<string, ChartRow>();
    for (const row of rows) {
        const series = String(row[column] ?? '');
        if (!seen.has(series)) {
            seen.add(series);
            keys.push(series);
        }
        const id = String(row[index] ?? '');
        let out = byIndex.get(id);
        if (!out) {
            out = { [index]: row[index] };
            byIndex.set(id, out);
        }
        const n = toNumber(row[value]) ?? 0;
        out[series] = (toNumber(out[series]) ?? 0) + n;
    }
    const data = [...byIndex.values()].map((row) => {
        for (const k of keys) if (!(k in row)) row[k] = fill;
        return row;
    });
    return { data, keys };
}

export interface CategoryItem {
    name: string;
    value: number;
}

/**
 * Keep the `limit` largest items, sorted, and sum the rest into one "Other" item.
 * Categorical slots never cycle, so a donut or bar list past eight slices folds its tail.
 */
export function groupOther<T extends CategoryItem>(items: T[], limit = 7, label = 'Other'): CategoryItem[] {
    const sorted = [...items].sort((a, b) => b.value - a.value);
    if (sorted.length <= limit + 1) return sorted;
    const rest = sorted.slice(limit).reduce((sum, item) => sum + item.value, 0);
    return [...sorted.slice(0, limit), { name: label, value: rest }];
}
