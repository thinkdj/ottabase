import { bucketKey, parseDate, toNumber } from '../data';
import type { ChartRow } from '../types';

const DAY = 86_400_000;

export interface CalendarOptions {
    data: ChartRow[];
    /** Column holding the date. Default `date`. */
    index?: string;
    /** Column holding the number. Default `value`. */
    value?: string;
    /** Last day shown. Default: today (UTC). */
    end?: Date | string | number;
    /** Weeks shown, ending at `end`. Default 53 (a year). */
    weeks?: number;
    /** Intensity steps above zero. Default 4. */
    levels?: number;
    /** 0 = Sunday, 1 = Monday. Default 1. */
    weekStart?: 0 | 1;
}

export interface CalendarCell {
    date: string;
    value: number;
    /** 0 for no activity, then 1..levels by share of the busiest day. */
    level: number;
    /** Week column, oldest first. */
    col: number;
    /** Weekday row, from `weekStart`. */
    row: number;
}

export interface CalendarLayout {
    cells: CalendarCell[];
    columns: number;
    /** First column of each month, for the labels above the grid. */
    months: { label: string; col: number }[];
    max: number;
    levels: number;
}

/** A GitHub-style activity grid: one cell per UTC day, weeks as columns. */
export function computeCalendar(options: CalendarOptions): CalendarLayout {
    const { data, index = 'date', value = 'value', weeks = 53, levels = 4, weekStart = 1 } = options;
    const totals = new Map<string, number>();
    for (const row of data) {
        const raw = row[index];
        if (raw === null || raw === undefined) continue;
        const d = parseDate(raw as string | number | Date);
        if (Number.isNaN(d.getTime())) continue;
        const key = bucketKey(d, 'day');
        totals.set(key, (totals.get(key) ?? 0) + (toNumber(row[value]) ?? 0));
    }

    const endDay = parseDate(bucketKey(options.end ?? Date.now(), 'day')).getTime();
    const endRow = (new Date(endDay).getUTCDay() - weekStart + 7) % 7;
    const startDay = endDay - ((weeks - 1) * 7 + endRow) * DAY;

    const cells: CalendarCell[] = [];
    const months: { label: string; col: number }[] = [];
    let max = 0;
    let lastMonth = -1;
    for (let t = startDay, i = 0; t <= endDay; t += DAY, i++) {
        const date = new Date(t).toISOString().slice(0, 10);
        const v = totals.get(date) ?? 0;
        max = Math.max(max, v);
        const col = Math.floor(i / 7);
        cells.push({ date, value: v, level: 0, col, row: i % 7 });
        const month = new Date(t).getUTCMonth();
        if (month !== lastMonth) {
            // A month starting on the last day of a column gets its label on the next one.
            const labelCol = i % 7 === 0 ? col : col + 1;
            if (months.length === 0 || (months[months.length - 1] as { col: number }).col < labelCol) {
                months.push({
                    label: new Date(t).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
                    col: labelCol,
                });
            }
            lastMonth = month;
        }
    }
    for (const cell of cells) {
        cell.level = cell.value > 0 && max > 0 ? Math.max(1, Math.ceil((cell.value / max) * levels)) : 0;
    }
    // A partial month at the left edge would print its label on top of the next one's: drop it.
    const labels = months.filter((m, i) => m.col < weeks && (months[i + 1]?.col ?? Infinity) - m.col >= 3);
    return { cells, columns: Math.ceil(cells.length / 7), months: labels, max, levels };
}
