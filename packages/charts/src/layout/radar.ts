import { toNumber } from '../data';
import { formatCompact } from '../format';
import { sampleIndices, spreadIndices } from '../sample';
import { niceTicks } from '../scale';
import type { ChartRow, Formatter, ResolvedSeries } from '../types';
import { CHAR_W } from './cartesian';

export interface RadarOptions {
    /** One row per axis (spoke). */
    data: ChartRow[];
    /** Column naming each axis. */
    index: string;
    series: ResolvedSeries[];
    width: number;
    height: number;
    /** Fixed outer value. Default: the next round tick above the data. */
    maxValue?: number;
    /** Rings, roughly. Default 4. */
    levels?: number;
    /** `polygon` rings follow the spokes; `circle` rings are round. Default `polygon`. */
    grid?: 'polygon' | 'circle';
    valueFormatter?: Formatter;
    indexFormatter?: (value: string) => string;
}

export interface RadarAxis {
    index: number;
    label: string;
    /** Radians clockwise from 12 o'clock. */
    angle: number;
    /** Outer end of the spoke. */
    x: number;
    y: number;
    /** Where the label sits, and how it is anchored to stay off the plot. */
    labelX: number;
    labelY: number;
    anchor: 'start' | 'middle' | 'end';
    /** Labels thin out when there are more axes than fit around the edge. */
    showLabel: boolean;
}

export interface RadarRing {
    value: number;
    label: string;
    radius: number;
    path: string;
}

export interface RadarSeries extends ResolvedSeries {
    /** Value per axis; null is drawn at the centre. */
    values: (number | null)[];
    /** Vertex per axis. */
    points: { x: number; y: number }[];
    /** Closed outline through the vertices drawn. */
    path: string;
}

export interface RadarLayout {
    cx: number;
    cy: number;
    radius: number;
    axes: RadarAxis[];
    rings: RadarRing[];
    series: RadarSeries[];
    /** The outer value. */
    max: number;
    /** More axes than the edge has pixels for: outlines go through a sample that keeps the extremes. */
    sampled: boolean;
    /** Spokes and vertex dots are drawn only while the axes are few enough to tell apart. */
    sparse: boolean;
}

const f = (n: number) => Math.round(n * 100) / 100;

/**
 * A radar (spider) chart: one spoke per row, a closed outline per series, values from
 * the centre out on one scale. Best with 3-12 axes; past that it reads as a polar line
 * and thins labels, spokes and dots to what fits.
 */
export function computeRadar({
    data,
    index,
    series,
    width,
    height,
    maxValue,
    levels = 4,
    grid = 'polygon',
    valueFormatter = (v) => formatCompact(v),
    indexFormatter = (v) => v,
}: RadarOptions): RadarLayout {
    const n = data.length;
    const values = series.map((s) => data.map((row) => toNumber(row[s.key])));
    let hi = 0;
    for (const col of values) for (const v of col) if (v !== null && v > hi) hi = v;
    const ticks = niceTicks(0, maxValue ?? (hi || 1), levels).filter((t) => t >= 0);
    const max = maxValue ?? (ticks[ticks.length - 1] as number);

    const labelOf = (i: number) => indexFormatter(String(data[i]?.[index] ?? ''));
    // Labels sit outside the outline; leave room for the widest, capped so a long one cannot shrink the chart away.
    const labelW = Math.min(96, Math.max(0, ...spreadIndices(n, 200).map((i) => labelOf(i).length)) * CHAR_W);
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.max(0, Math.min(width / 2 - labelW - 12, height / 2 - 20));
    const step = n > 0 ? (Math.PI * 2) / n : 0;
    const at = (i: number, r: number) => {
        const a = i * step;
        return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) };
    };
    const rOf = (v: number | null) => (v === null || max <= 0 ? 0 : (Math.min(Math.max(v, 0), max) / max) * radius);

    // A label every ~18px of edge; spokes and dots while they stay ~10px apart.
    const edge = Math.PI * 2 * radius;
    const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(edge / 18))));
    const sparse = n <= 36 && (n === 0 || edge / n >= 10);
    const axes: RadarAxis[] = Array.from({ length: n }, (_, i) => {
        const end = at(i, radius);
        const lab = at(i, radius + 10);
        const s = Math.sin(i * step);
        return {
            index: i,
            label: i % labelEvery === 0 ? labelOf(i) : '',
            angle: i * step,
            x: end.x,
            y: end.y,
            labelX: lab.x,
            labelY: lab.y,
            anchor: Math.abs(s) < 0.2 ? 'middle' : s > 0 ? 'start' : 'end',
            showLabel: i % labelEvery === 0,
        };
    });

    const outline = (pts: { x: number; y: number }[]) =>
        pts.length ? `M${pts.map((p) => `${f(p.x)} ${f(p.y)}`).join('L')}Z` : '';
    const rings: RadarRing[] = ticks
        .filter((t) => t > 0 && t <= max)
        .map((t) => {
            const r = rOf(t);
            const path =
                grid === 'circle' || n < 3
                    ? `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`
                    : outline(Array.from({ length: n }, (_, i) => at(i, r)));
            return { value: t, label: valueFormatter(t), radius: r, path };
        });

    // One vertex per pixel of edge is all an outline can show.
    const drawn = sampleIndices(values, n, edge);
    const geometry: RadarSeries[] = series.map((s, si) => {
        const col = values[si] as (number | null)[];
        const points = col.map((v, i) => at(i, rOf(v)));
        return { ...s, values: col, points, path: outline(drawn.map((i) => points[i] as { x: number; y: number })) };
    });

    return { cx, cy, radius, axes, rings, series: geometry, max, sampled: drawn.length < n, sparse };
}

/** The axis under a point: the spoke nearest its angle around the centre. */
export function radarAxisAt(layout: RadarLayout, x: number, y: number): number {
    const n = layout.axes.length;
    if (n === 0) return -1;
    const a = Math.atan2(x - layout.cx, layout.cy - y);
    const turn = (a + Math.PI * 2) % (Math.PI * 2);
    return Math.round(turn / ((Math.PI * 2) / n)) % n;
}
