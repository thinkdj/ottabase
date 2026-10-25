import { toNumber } from '../data';
import { formatCompact } from '../format';
import { linearScale, type LinearScale } from '../scale';
import type { ChartRow, Formatter } from '../types';
import { AXIS_TITLE, axisTicks, CHAR_W, labelWidth, toTicks, type Tick } from './cartesian';

export interface ScatterGroup {
    /** The value in the `groupBy` column this group collects; `''` when there is no grouping. */
    key: string;
    label: string;
    /** CSS colour, already resolved. */
    color: string;
}

export interface ScatterOptions {
    data: ChartRow[];
    /** Column for the horizontal position. */
    x: string;
    /** Column for the vertical position. */
    y: string;
    /** Column whose value sets each bubble's area. Omit for a plain scatter. */
    size?: string;
    /** Column that splits points into coloured groups. */
    groupBy?: string;
    /** The group of a row, instead of reading `groupBy` (to fold rare groups into one). */
    groupOf?: (row: ChartRow) => string;
    /** Groups in draw and slot order. Rows whose group is not listed are left out. */
    groups: ScatterGroup[];
    width: number;
    height: number;
    /** Dot radius of a plain scatter, px. Default 3.5. */
    pointRadius?: number;
    /** Smallest and largest bubble radius, px. Default [4, 22]. */
    sizeRange?: [number, number];
    /** Pinned axis ends. Default: round ticks around the data (an axis need not reach zero). */
    xMinValue?: number;
    xMaxValue?: number;
    minValue?: number;
    maxValue?: number;
    xFormatter?: Formatter;
    valueFormatter?: Formatter;
    xTickCount?: number;
    yTickCount?: number;
    showXAxis?: boolean;
    showYAxis?: boolean;
    xTitle?: string;
    yTitle?: string;
}

export interface ScatterPoint {
    /** Row in `data`. */
    row: number;
    /** Index into `groups`. */
    group: number;
    x: number;
    y: number;
    r: number;
    xValue: number;
    yValue: number;
    sizeValue: number | null;
}

export interface ScatterSeries extends ScatterGroup {
    /** Every point of the group as one path of circles. */
    path: string;
    /** Points in the group. */
    count: number;
}

export interface ScatterLayout {
    plot: { x: number; y: number; width: number; height: number };
    xScale: LinearScale;
    yScale: LinearScale;
    xTicks: Tick[];
    yTicks: Tick[];
    y2Ticks: Tick[];
    /** Every plotted point (rows with both values), biggest bubble first. */
    points: ScatterPoint[];
    series: ScatterSeries[];
    /** Circles in the paths: points that land on the same pixel as another of their group draw once. */
    drawn: number;
    xFormatter: Formatter;
    valueFormatter: Formatter;
}

const f = (n: number) => Math.round(n * 100) / 100;

/**
 * A scatter or bubble chart on two linear axes. Each group draws as one `<path>` of
 * circles, not an element a point, so 50,000 points cost one DOM node per colour; a
 * point on a pixel its group already covers adds nothing and is skipped. `points` keeps
 * every one for hover (see `scatterIndex`).
 */
export function computeScatter(options: ScatterOptions): ScatterLayout {
    const { data, x: xKey, y: yKey, size, groupBy, groups, width, height, pointRadius = 3.5 } = options;
    const [rMin, rMax] = options.sizeRange ?? [4, 22];
    const showX = options.showXAxis ?? true;
    const showY = options.showYAxis ?? true;
    const xFormatter: Formatter = options.xFormatter ?? ((v) => formatCompact(v));
    const valueFormatter: Formatter = options.valueFormatter ?? ((v) => formatCompact(v));
    const groupIndex = new Map(groups.map((g, i) => [g.key, i]));

    // 1. Rows with both coordinates, and the extents.
    const raw: { row: number; group: number; xv: number; yv: number; sv: number | null }[] = [];
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    let sMax = 0;
    data.forEach((row, i) => {
        const xv = toNumber(row[xKey]);
        const yv = toNumber(row[yKey]);
        const g = groupIndex.get(options.groupOf ? options.groupOf(row) : groupBy ? String(row[groupBy] ?? '') : '');
        if (xv === null || yv === null || g === undefined) return;
        const sv = size ? toNumber(row[size]) : null;
        raw.push({ row: i, group: g, xv, yv, sv });
        if (xv < x0) x0 = xv;
        if (xv > x1) x1 = xv;
        if (yv < y0) y0 = yv;
        if (yv > y1) y1 = yv;
        if (sv !== null && sv > sMax) sMax = sv;
    });

    // 2. Axes and the plot box. Points are inset by the largest radius so none is cut at an edge.
    const xAxis = axisTicks(x0, x1, options.xMinValue, options.xMaxValue, options.xTickCount ?? 5);
    const yAxis = axisTicks(y0, y1, options.minValue, options.maxValue, options.yTickCount ?? 4);
    const xLabels = xAxis.ticks.map((t) => xFormatter(t));
    const yLabels = yAxis.ticks.map((t) => valueFormatter(t));
    const overhang = showX ? (Math.max(0, ...xLabels.map((l) => l.length)) * CHAR_W) / 2 : 0;
    const left = Math.max(showY ? labelWidth(yLabels) + (options.yTitle ? AXIS_TITLE : 0) : 0, overhang);
    const top = showY ? 6 : 0;
    const bottom = showX ? 22 + (options.xTitle ? AXIS_TITLE : 0) : 0;
    const plot = {
        x: left,
        y: top,
        width: Math.max(0, width - left - Math.max(overhang, 4)),
        height: Math.max(0, height - top - bottom),
    };
    const pad = Math.min(size ? rMax : pointRadius + 1, plot.width / 4, plot.height / 4);
    const xScale = linearScale(xAxis.domain, [plot.x + pad, plot.x + plot.width - pad]);
    const yScale = linearScale(yAxis.domain, [plot.y + plot.height - pad, plot.y + pad]);
    // Area, not radius, follows the value: radius goes with its square root.
    const rOf = (sv: number | null) =>
        size ? (sv === null || sv <= 0 || sMax <= 0 ? rMin : Math.max(rMin, rMax * Math.sqrt(sv / sMax))) : pointRadius;

    // A pinned axis can cut the data: rows outside it are neither drawn over the axes nor hoverable.
    const [xd0, xd1] = xAxis.domain;
    const [yd0, yd1] = yAxis.domain;
    const inside = raw.filter((p) => p.xv >= xd0 && p.xv <= xd1 && p.yv >= yd0 && p.yv <= yd1);
    const points: ScatterPoint[] = inside.map((p) => ({
        row: p.row,
        group: p.group,
        x: xScale(p.xv),
        y: yScale(p.yv),
        r: rOf(p.sv),
        xValue: p.xv,
        yValue: p.yv,
        sizeValue: p.sv,
    }));
    // Big bubbles first, so small ones are drawn over them and stay reachable.
    if (size) points.sort((a, b) => b.r - a.r);

    // 3. One path per group, one circle per occupied pixel.
    const paths = groups.map(() => [] as string[]);
    const counts = groups.map(() => 0);
    const seen = new Set<number>();
    let drawn = 0;
    for (const p of points) {
        counts[p.group] = (counts[p.group] ?? 0) + 1;
        const key = ((Math.round(p.x) * 8192 + Math.round(p.y)) * 64 + Math.round(p.r)) * 64 + p.group;
        if (seen.has(key)) continue;
        seen.add(key);
        drawn++;
        const r = f(p.r);
        (paths[p.group] as string[]).push(
            `M${f(p.x - p.r)} ${f(p.y)}a${r} ${r} 0 1 0 ${f(2 * p.r)} 0a${r} ${r} 0 1 0 ${f(-2 * p.r)} 0`,
        );
    }

    return {
        plot,
        xScale,
        yScale,
        xTicks: showX ? toTicks(xAxis.ticks, xLabels, xScale) : [],
        yTicks: toTicks(yAxis.ticks, yLabels, yScale),
        y2Ticks: [],
        points,
        series: groups.map((g, i) => ({ ...g, path: (paths[i] as string[]).join(''), count: counts[i] ?? 0 })),
        drawn,
        xFormatter,
        valueFormatter,
    };
}

/**
 * Nearest-point lookup for hover over many points: a grid of buckets at least as wide
 * as the biggest bubble plus the hit radius, so a query reads the 3 × 3 cells around
 * the pointer instead of every point.
 */
export function scatterIndex(points: ScatterPoint[], hitRadius = 12) {
    const cell = Math.max(24, points.reduce((m, p) => Math.max(m, p.r), 0) + hitRadius);
    const grid = new Map<number, number[]>();
    const keyOf = (cx: number, cy: number) => cx * 100_003 + cy;
    points.forEach((p, i) => {
        const k = keyOf(Math.floor(p.x / cell), Math.floor(p.y / cell));
        const list = grid.get(k);
        if (list) list.push(i);
        else grid.set(k, [i]);
    });
    return {
        /** Index into `points` of the nearest point within `radius` px (plus its own radius), or -1. */
        nearest(x: number, y: number, radius = hitRadius): number {
            const cx = Math.floor(x / cell);
            const cy = Math.floor(y / cell);
            let best = -1;
            let bestD = Infinity;
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    for (const i of grid.get(keyOf(cx + dx, cy + dy)) ?? []) {
                        const p = points[i] as ScatterPoint;
                        // Inside a bubble counts as on it; the smallest bubble under the pointer wins.
                        const d = Math.hypot(p.x - x, p.y - y) - p.r;
                        if (
                            d <= radius &&
                            (d < bestD || (d <= 0 && bestD <= 0 && p.r < (points[best]?.r ?? Infinity)))
                        ) {
                            best = i;
                            bestD = d;
                        }
                    }
                }
            }
            return best;
        },
    };
}
