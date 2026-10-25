import type { Curve, MarkRadius } from './types';

export interface Point {
    x: number;
    y: number;
}

const f = (n: number) => Math.round(n * 100) / 100;

/** Corner radius of a mark (bars, cells, slices, nodes, rings), px for each step of `radius`. */
export const MARK_RADII: Record<MarkRadius, number> = { none: 0, sm: 2, md: 4, lg: 8 };

/** Split on nulls: a missing value is a gap in the line, never a dip to zero. */
export function segments<T>(points: (T | null)[]): T[][] {
    const out: T[][] = [];
    let run: T[] = [];
    for (const p of points) {
        if (p === null) {
            if (run.length) out.push(run);
            run = [];
        } else run.push(p);
    }
    if (run.length) out.push(run);
    return out;
}

/*
 * Monotone cubic interpolation (Fritsch–Carlson, as in d3's curveMonotoneX): smooth,
 * but never overshoots the data, so a curve cannot invent a peak or dip below zero.
 */
function monotoneTangents(pts: Point[]): number[] {
    const n = pts.length;
    const t = new Array<number>(n).fill(0);
    for (let i = 1; i < n - 1; i++) {
        const a = pts[i - 1] as Point;
        const b = pts[i] as Point;
        const c = pts[i + 1] as Point;
        const h0 = b.x - a.x;
        const h1 = c.x - b.x;
        const s0 = (b.y - a.y) / (h0 || 1);
        const s1 = (c.y - b.y) / (h1 || 1);
        const p = (s0 * h1 + s1 * h0) / (h0 + h1 || 1);
        // Opposite slopes (a peak or a dip) get a flat tangent; otherwise the gentlest of the three.
        t[i] = (Math.sign(s0) + Math.sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
    }
    const end = (a: Point, b: Point, inner: number) => {
        const h = b.x - a.x;
        return h ? ((3 * (b.y - a.y)) / h - inner) / 2 : inner;
    };
    t[0] = end(pts[0] as Point, pts[1] as Point, t[1] as number);
    t[n - 1] = end(pts[n - 2] as Point, pts[n - 1] as Point, t[n - 2] as number);
    return t;
}

/** Path commands for one unbroken run, continuing from `pts[0]` (no leading M). */
function run(pts: Point[], curve: Curve): string {
    let d = '';
    if (curve === 'step') {
        for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1] as Point;
            const b = pts[i] as Point;
            const mid = (a.x + b.x) / 2;
            d += `H${f(mid)}V${f(b.y)}H${f(b.x)}`;
        }
        return d;
    }
    if (curve === 'monotone' && pts.length > 2) {
        const t = monotoneTangents(pts);
        for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1] as Point;
            const b = pts[i] as Point;
            const dx = (b.x - a.x) / 3;
            d += `C${f(a.x + dx)} ${f(a.y + dx * (t[i - 1] as number))} ${f(b.x - dx)} ${f(b.y - dx * (t[i] as number))} ${f(b.x)} ${f(b.y)}`;
        }
        return d;
    }
    for (let i = 1; i < pts.length; i++) {
        const p = pts[i] as Point;
        d += `L${f(p.x)} ${f(p.y)}`;
    }
    return d;
}

/** SVG path for a line. Nulls break it into separate runs. */
export function linePath(points: (Point | null)[], curve: Curve = 'linear'): string {
    return segments(points)
        .map((pts) => {
            const first = pts[0] as Point;
            return `M${f(first.x)} ${f(first.y)}${run(pts, curve)}`;
        })
        .join('');
}

export interface AreaPoint extends Point {
    /** Baseline under this point (the axis, or the series below in a stack). */
    y0: number;
}

/** SVG path for a filled area between each point and its baseline. Nulls break it into separate shapes. */
export function areaPath(points: (AreaPoint | null)[], curve: Curve = 'linear'): string {
    return segments(points)
        .map((pts) => {
            const first = pts[0] as AreaPoint;
            const last = pts[pts.length - 1] as AreaPoint;
            const base = pts.map((p) => ({ x: p.x, y: p.y0 })).reverse();
            return `M${f(first.x)} ${f(first.y)}${run(pts, curve)}L${f(last.x)} ${f(last.y0)}${run(base, curve)}Z`;
        })
        .join('');
}

/**
 * SVG path for a ring segment between angles `a0` and `a1` (radians, clockwise from
 * 12 o'clock). `inner` 0 draws a pie wedge. A full turn is drawn as two halves, since
 * a single arc whose ends coincide renders as nothing. `corner` rounds the four corners
 * (px), shrunk to what the segment's thickness and span can hold.
 */
export function arcPath(
    cx: number,
    cy: number,
    outer: number,
    inner: number,
    a0: number,
    a1: number,
    corner = 0,
): string {
    const span = a1 - a0;
    if (span >= Math.PI * 2 - 1e-6) {
        const mid = a0 + Math.PI;
        return arcPath(cx, cy, outer, inner, a0, mid) + arcPath(cx, cy, outer, inner, mid, a0 + Math.PI * 2);
    }
    const pt = (r: number, a: number) => `${f(cx + r * Math.sin(a))} ${f(cy - r * Math.cos(a))}`;
    const large = span > Math.PI ? 1 : 0;
    // A corner circle touches the radial edge and the arc; it must fit the ring's width and,
    // on each arc, half the span (sin(δ) = c / (outer - c) outside, c / (inner + c) inside).
    const s = Math.sin(Math.min(span / 2, Math.PI / 2));
    const c = Math.min(
        corner,
        inner > 0 ? (outer - inner) / 2 : outer / 2,
        (outer * s) / (1 + s),
        inner > 0 && s < 1 ? (inner * s) / (1 - s) : Infinity,
    );
    if (c > 0.5) {
        const dO = Math.asin(c / (outer - c));
        const eO = Math.sqrt((outer - c) ** 2 - c * c);
        const bigO = span - 2 * dO > Math.PI ? 1 : 0;
        const rc = `${f(c)} ${f(c)} 0 0 1`;
        const head = `M${pt(eO, a0)}A${rc} ${pt(outer, a0 + dO)}A${f(outer)} ${f(outer)} 0 ${bigO} 1 ${pt(outer, a1 - dO)}A${rc} ${pt(eO, a1)}`;
        if (inner <= 0) return `${head}L${f(cx)} ${f(cy)}Z`;
        const dI = Math.asin(c / (inner + c));
        const eI = Math.sqrt((inner + c) ** 2 - c * c);
        const bigI = span - 2 * dI > Math.PI ? 1 : 0;
        return `${head}L${pt(eI, a1)}A${rc} ${pt(inner, a1 - dI)}A${f(inner)} ${f(inner)} 0 ${bigI} 0 ${pt(inner, a0 + dI)}A${rc} ${pt(eI, a0)}Z`;
    }
    const outerArc = `M${pt(outer, a0)}A${f(outer)} ${f(outer)} 0 ${large} 1 ${pt(outer, a1)}`;
    if (inner <= 0) return `${outerArc}L${f(cx)} ${f(cy)}Z`;
    return `${outerArc}L${pt(inner, a1)}A${f(inner)} ${f(inner)} 0 ${large} 0 ${pt(inner, a0)}Z`;
}
