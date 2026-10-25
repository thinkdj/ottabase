/** Strip float noise from tick arithmetic: 0.1 + 0.2 → 0.3. */
function clean(n: number): number {
    return Number(n.toPrecision(12));
}

/**
 * Round tick values covering [min, max] in steps of 1, 2 or 5 × 10ⁿ. The returned
 * first and last ticks are the axis domain, so the data never touches the frame.
 */
export function niceTicks(min: number, max: number, count = 5): number[] {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
    if (min > max) [min, max] = [max, min];
    if (min === max) {
        // A flat series still needs a visible range around it.
        if (min === 0) return [0, 1];
        const pad = Math.abs(min) * 0.5;
        return niceTicks(min - pad, max + pad, count);
    }
    const raw = (max - min) / Math.max(count, 1);
    const pow = 10 ** Math.floor(Math.log10(raw));
    const err = raw / pow;
    const step = pow * (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1);
    const start = Math.floor(clean(min / step)) * step;
    const end = Math.ceil(clean(max / step)) * step;
    const ticks: number[] = [];
    for (let i = 0; start + i * step <= end + step / 2; i++) ticks.push(clean(start + i * step));
    return ticks;
}

export interface LinearScale {
    (value: number): number;
    domain: [number, number];
    range: [number, number];
    invert(pixel: number): number;
}

export function linearScale(domain: [number, number], range: [number, number]): LinearScale {
    const [d0, d1] = domain;
    const [r0, r1] = range;
    const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
    const scale = ((v: number) => r0 + (v - d0) * k) as LinearScale;
    scale.domain = domain;
    scale.range = range;
    scale.invert = (p: number) => (k === 0 ? d0 : d0 + (p - r0) / k);
    return scale;
}

export interface BandLayout {
    /** Centre of each band, in order. */
    centers: number[];
    /** Width of the drawable part of one band. */
    bandwidth: number;
    /** Distance between neighbouring centres. */
    step: number;
}

/** `count` equal bands across [start, end]; `padding` (0-1) is the share of each band left empty. */
export function bandLayout(count: number, start: number, end: number, padding = 0.3): BandLayout {
    if (count <= 0) return { centers: [], bandwidth: 0, step: 0 };
    const step = (end - start) / count;
    return {
        centers: Array.from({ length: count }, (_, i) => start + step * (i + 0.5)),
        bandwidth: step * (1 - padding),
        step,
    };
}

/** `count` points spread edge to edge across [start, end]; one point sits in the middle. */
export function pointLayout(count: number, start: number, end: number): BandLayout {
    if (count <= 0) return { centers: [], bandwidth: 0, step: 0 };
    if (count === 1) return { centers: [(start + end) / 2], bandwidth: 0, step: end - start };
    const step = (end - start) / (count - 1);
    return { centers: Array.from({ length: count }, (_, i) => start + step * i), bandwidth: 0, step };
}

/** Index of the position closest to `x`. Positions are sorted ascending. */
export function nearestIndex(positions: number[], x: number): number {
    if (positions.length === 0) return -1;
    let lo = 0;
    let hi = positions.length - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if ((positions[mid] as number) < x) lo = mid;
        else hi = mid;
    }
    return Math.abs((positions[lo] as number) - x) <= Math.abs((positions[hi] as number) - x) ? lo : hi;
}
