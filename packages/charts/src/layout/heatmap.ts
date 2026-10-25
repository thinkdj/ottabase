import { toNumber } from '../data';
import type { ChartRow } from '../types';

export interface HeatmapOptions {
    /** Long rows: one per cell, with an x column, a y column and a value. */
    data: ChartRow[];
    /** Column for the columns (e.g. hour). */
    x: string;
    /** Column for the rows (e.g. weekday). */
    y: string;
    /** Column holding the number. Default `value`. */
    value?: string;
    /** Column order. Default: first-seen order in `data`. */
    xDomain?: string[];
    yDomain?: string[];
    /** Intensity steps above zero. Default 5. */
    levels?: number;
}

export interface HeatmapCell {
    x: string;
    y: string;
    col: number;
    row: number;
    /** null when no row covered this cell. */
    value: number | null;
    /** 0 for null or min, up to `levels`. */
    level: number;
    /** 0-1 share between the min and the max. */
    intensity: number;
}

export interface HeatmapLayout {
    cells: HeatmapCell[];
    xDomain: string[];
    yDomain: string[];
    min: number;
    max: number;
    levels: number;
}

/** A matrix of x × y categories coloured by value: traffic by hour and weekday, errors by route and day. */
export function computeHeatmap(options: HeatmapOptions): HeatmapLayout {
    const { data, x, y, value = 'value', levels = 5 } = options;
    const seenX = new Set<string>();
    const seenY = new Set<string>();
    const totals = new Map<string, number>();
    for (const row of data) {
        const xv = String(row[x] ?? '');
        const yv = String(row[y] ?? '');
        seenX.add(xv);
        seenY.add(yv);
        const key = `${xv}\u0000${yv}`;
        totals.set(key, (totals.get(key) ?? 0) + (toNumber(row[value]) ?? 0));
    }
    const xDomain = options.xDomain ?? [...seenX];
    const yDomain = options.yDomain ?? [...seenY];
    let min = Infinity;
    let max = -Infinity;
    for (const v of totals.values()) {
        min = Math.min(min, v);
        max = Math.max(max, v);
    }
    if (!Number.isFinite(min)) min = max = 0;
    const span = max - min;
    const cells: HeatmapCell[] = [];
    yDomain.forEach((yv, row) => {
        xDomain.forEach((xv, col) => {
            const v = totals.get(`${xv}\u0000${yv}`);
            const intensity = v === undefined ? 0 : span === 0 ? (v > 0 ? 1 : 0) : (v - min) / span;
            cells.push({
                x: xv,
                y: yv,
                col,
                row,
                value: v ?? null,
                // A present value is never drawn as empty: the minimum is level 1.
                level: v === undefined ? 0 : Math.max(1, Math.ceil(intensity * levels)),
                intensity,
            });
        });
    });
    return { cells, xDomain, yDomain, min, max, levels };
}
