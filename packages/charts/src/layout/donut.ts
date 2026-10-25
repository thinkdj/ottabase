import { arcPath, MARK_RADII } from '../shape';

export interface DonutItem {
    name: string;
    value: number;
    /** CSS colour, already resolved. */
    color: string;
}

export interface DonutOptions {
    items: DonutItem[];
    /** Width and height of the square, px. */
    size: number;
    /** Ring width, px. `size / 2` draws a pie. Default: 12% of `size` (the spec's ring). */
    thickness?: number;
    /** Gap between segments along the outer edge, px. Default 3. */
    gap?: number;
    /** Corner radius of each segment, px. Default `MARK_RADII.sm`; shrunk to fit thin rings and small slices. */
    cornerRadius?: number;
    /** Where the first segment starts, degrees clockwise from 12 o'clock. Default 0. */
    startAngle?: number;
    /** Where the last segment ends, degrees. Default `startAngle + 360`. `-90` to `90` draws a half donut. */
    endAngle?: number;
}

export interface DonutSegment extends DonutItem {
    /** Share of the total, 0-1. */
    share: number;
    startAngle: number;
    endAngle: number;
    path: string;
    /** Centre of the segment's arc, for a label or a hover anchor. */
    centroid: { x: number; y: number };
}

export interface DonutLayout {
    cx: number;
    cy: number;
    outer: number;
    inner: number;
    total: number;
    segments: DonutSegment[];
    /** Path of the full sweep, for a track behind a gauge or an empty state. */
    track: string;
    /** The square's height, which a half donut trims to its used part. */
    height: number;
}

const RAD = Math.PI / 180;

/**
 * Segments of a donut (or pie) chart, in item order along the sweep. Zero and negative
 * values are skipped. Angles are radians clockwise from 12 o'clock.
 */
export function computeDonut({
    items,
    size,
    thickness,
    gap = 3,
    cornerRadius = MARK_RADII.sm,
    startAngle = 0,
    endAngle,
}: DonutOptions): DonutLayout {
    const outer = size / 2 - 1;
    const inner = Math.max(0, outer - (thickness ?? Math.max(8, size * 0.12)));
    const cx = size / 2;
    const cy = size / 2;
    const a0 = startAngle * RAD;
    const a1 = (endAngle ?? startAngle + 360) * RAD;
    const sweep = a1 - a0;
    const visible = items.filter((i) => i.value > 0);
    const total = visible.reduce((sum, i) => sum + i.value, 0);
    // The gap is a fixed width at the outer edge, so it reads the same at every size.
    const pad = visible.length > 1 ? gap / outer : 0;
    let angle = a0;
    const segments = visible.map((item) => {
        const span = total === 0 ? 0 : (item.value / total) * sweep;
        const s = angle + Math.min(pad / 2, span / 4);
        const e = angle + span - Math.min(pad / 2, span / 4);
        angle += span;
        const mid = (s + e) / 2;
        const r = (outer + inner) / 2;
        return {
            ...item,
            share: total === 0 ? 0 : item.value / total,
            startAngle: s,
            endAngle: e,
            path: arcPath(cx, cy, outer, inner, s, e, cornerRadius),
            centroid: { x: cx + r * Math.sin(mid), y: cy - r * Math.cos(mid) },
        };
    });
    // A half donut (-90..90) uses only the top half of the square.
    const isTopHalf = sweep < Math.PI * 2 && Math.sin(a0) <= 0 && Math.sin(a1) >= 0 && Math.cos(a0) >= 0;
    return {
        cx,
        cy,
        outer,
        inner,
        total,
        segments,
        track: arcPath(cx, cy, outer, inner, a0, a1, cornerRadius),
        height: isTopHalf ? cy + 1 : size,
    };
}
