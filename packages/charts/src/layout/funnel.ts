import { toCount } from '../data';

export interface FunnelItem {
    name: string;
    value: number;
    /** CSS colour, already resolved. */
    color: string;
}

export interface FunnelOptions {
    items: FunnelItem[];
    width: number;
    /** Height of one step's bar, px. Default 32. */
    stepHeight?: number;
    /** Vertical space between steps, px. Default 2 (the bar gap). */
    gap?: number;
}

export interface FunnelStep extends FunnelItem {
    index: number;
    x: number;
    y: number;
    width: number;
    height: number;
    /** Share of the first step, 0-1. */
    share: number;
    /** Share of the previous step, 0-1; 1 for the first. */
    conversion: number;
    /** Drop from the previous step, as a share of it (0 for the first). */
    dropOff: number;
}

export interface FunnelLayout {
    steps: FunnelStep[];
    width: number;
    height: number;
}

/** Centred bars narrowing by value, with the conversion from each step to the next. */
export function computeFunnel({ items, width, stepHeight = 32, gap = 2 }: FunnelOptions): FunnelLayout {
    const values = items.map((i) => toCount(i.value));
    const first = values[0] ?? 0;
    const steps = items.map((item, index) => {
        const value = values[index]!;
        const prev = values[index - 1] ?? value;
        const share = first > 0 ? value / first : 0;
        // A later step larger than the first (a mis-ordered funnel) caps at full width.
        const w = Math.min(width, Math.max(width * share, value > 0 ? 2 : 0));
        const conversion = index === 0 ? 1 : prev > 0 ? value / prev : 0;
        return {
            ...item,
            value,
            index,
            x: (width - w) / 2,
            y: index * (stepHeight + gap),
            width: w,
            height: stepHeight,
            share,
            conversion,
            dropOff: index === 0 ? 0 : Math.max(0, 1 - conversion),
        };
    });
    return { steps, width, height: items.length * (stepHeight + gap) - gap };
}

export interface FlowFunnelOptions {
    /** Steps in order; `values` holds each series' count at that step, in `series` order. */
    steps: { name: string; values: number[] }[];
    /** One per entry in each step's `values`, top to bottom. */
    series: { key: string; color: string }[];
    width: number;
    height: number;
}

export interface FlowFunnelColumn {
    index: number;
    name: string;
    /** Sum of the step's series. */
    value: number;
    x: number;
    width: number;
    share: number;
    conversion: number;
}

export interface FlowFunnelBand {
    key: string;
    color: string;
    /** Closed SVG path: the series' thickness easing from step to step. */
    path: string;
}

export interface FlowFunnelLayout {
    columns: FlowFunnelColumn[];
    bands: FlowFunnelBand[];
    width: number;
    height: number;
}

/**
 * One equal-width column per step, the series stacked and centred. Each band eases
 * from its thickness at one column's left edge to the next column's, then runs flat
 * through the last column.
 */
export function computeFlowFunnel({ steps, series, width, height }: FlowFunnelOptions): FlowFunnelLayout {
    const totals = steps.map((s) => s.values.reduce((sum, v) => sum + toCount(v), 0));
    const max = Math.max(0, ...totals);
    const colW = steps.length > 0 ? width / steps.length : 0;
    const columns = steps.map((s, index) => {
        const value = totals[index] ?? 0;
        const prev = totals[index - 1] ?? value;
        return {
            index,
            name: s.name,
            value,
            x: index * colW,
            width: colW,
            share: totals[0] ? value / totals[0] : 0,
            conversion: index === 0 ? 1 : prev > 0 ? value / prev : 0,
        };
    });

    // Top and bottom edge of every series at every step.
    const edges = steps.map((s, i) => {
        let y = (height - (max > 0 ? ((totals[i] ?? 0) / max) * height : 0)) / 2;
        return series.map((_, k) => {
            const top = y;
            y += max > 0 ? (toCount(s.values[k]) / max) * height : 0;
            return [top, y] as const;
        });
    });
    const xs = [...columns.map((c) => c.x), width];
    const r = (n: number) => Math.round(n * 100) / 100;
    // A run of edge y's, one per step plus the flat end, as S-curves with level tangents.
    const curve = (ys: number[], x: number[]) =>
        ys
            .slice(1)
            .map((y, i) => {
                const mid = r((x[i]! + x[i + 1]!) / 2);
                return `C${mid},${r(ys[i]!)} ${mid},${r(y)} ${r(x[i + 1]!)},${r(y)}`;
            })
            .join('');

    const bands = series.map((s, k) => {
        const tops = edges.map((e) => e[k]![0]);
        const bottoms = edges.map((e) => e[k]![1]);
        tops.push(tops[tops.length - 1] ?? height / 2);
        bottoms.push(bottoms[bottoms.length - 1] ?? height / 2);
        const back = [...xs].reverse();
        const path =
            steps.length === 0
                ? ''
                : `M0,${r(tops[0]!)}${curve(tops, xs)}L${r(width)},${r(bottoms[bottoms.length - 1]!)}` +
                  `${curve([...bottoms].reverse(), back)}Z`;
        return { key: s.key, color: s.color, path };
    });

    return { columns, bands, width, height };
}
