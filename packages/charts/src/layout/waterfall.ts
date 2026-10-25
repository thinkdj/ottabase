import { toNumber } from '../data';
import { formatCompact } from '../format';
import { bandLayout, linearScale, type BandLayout, type LinearScale } from '../scale';
import { spreadIndices } from '../sample';
import type { ChartRow, Formatter } from '../types';
import { AXIS_TITLE, axisTicks, CHAR_W, labelWidth, toTicks, type Tick } from './cartesian';

export interface WaterfallOptions {
    /** One row per step: a change, or (with `totalKey`) a running total. */
    data: ChartRow[];
    /** Column naming each step. */
    index: string;
    /** Column holding the change. Default `value`. */
    category?: string;
    /**
     * Column that, when truthy, makes the row a total bar of everything so far; its value
     * is ignored, except on a leading total, where it is the opening balance.
     */
    totalKey?: string;
    /** Append a final total bar. Default true. */
    showTotal?: boolean;
    totalLabel?: string;
    width: number;
    height: number;
    valueFormatter?: Formatter;
    indexFormatter?: (value: string) => string;
    yTickCount?: number;
    showXAxis?: boolean;
    showYAxis?: boolean;
    xTitle?: string;
    yTitle?: string;
    /** Share of each band left empty around its bar (0-1). Default 0.3. */
    barPadding?: number;
    /** Widest a bar may grow, px. Default 64. */
    maxBarWidth?: number;
}

export interface WaterfallStep {
    /** Bar position. */
    index: number;
    label: string;
    kind: 'increase' | 'decrease' | 'total';
    /** The change, or the total for a total bar. */
    value: number;
    /** Running total before and after the step. */
    start: number;
    end: number;
    /** First and last data row in this bar (more than one when steps are bucketed). */
    rows: [number, number];
    x: number;
    y: number;
    width: number;
    height: number;
    /** A bucket's lowest and highest running total, px, drawn as a whisker. */
    range?: [number, number];
}

export interface WaterfallLayout {
    plot: { x: number; y: number; width: number; height: number };
    x: BandLayout;
    y: LinearScale;
    xTicks: Tick[];
    yTicks: Tick[];
    y2Ticks: Tick[];
    steps: WaterfallStep[];
    /** Dashed lines carrying each running total to the next bar. Empty when bucketed. */
    connectors: { x1: number; x2: number; y: number }[];
    valueFormatter: Formatter;
    /** More steps than fit: consecutive changes are summed into one bar each, totals kept. */
    bucketed: boolean;
}

interface Raw {
    label: string;
    kind: WaterfallStep['kind'];
    value: number;
    start: number;
    end: number;
    rows: [number, number];
    lo: number;
    hi: number;
}

/**
 * A waterfall: how a start becomes an end through the changes between. Each change
 * floats from the running total before it; total rows (and the final total) stand on
 * zero. Past one bar per 4px, consecutive changes are summed into a bar per bucket,
 * which is exact for a running total; its whisker shows how far the total swung inside.
 */
export function computeWaterfall(options: WaterfallOptions): WaterfallLayout {
    const {
        data,
        index,
        category = 'value',
        totalKey,
        showTotal = true,
        totalLabel = 'Total',
        width,
        height,
        valueFormatter = (v) => formatCompact(v),
        indexFormatter = (v) => v,
    } = options;
    const showX = options.showXAxis ?? true;
    const showY = options.showYAxis ?? true;

    // 1. Running totals.
    let running = 0;
    let changed = false;
    const raw: Raw[] = data.map((row, i) => {
        const label = indexFormatter(String(row[index] ?? ''));
        if (totalKey && row[totalKey]) {
            // Before any change, a total row with a value is the opening balance.
            const opening = changed ? null : toNumber(row[category]);
            if (opening !== null) running = opening;
            return {
                label,
                kind: 'total',
                value: running,
                start: 0,
                end: running,
                rows: [i, i],
                lo: running,
                hi: running,
            };
        }
        const v = toNumber(row[category]) ?? 0;
        const start = running;
        running += v;
        changed = true;
        return {
            label,
            kind: v < 0 ? 'decrease' : 'increase',
            value: v,
            start,
            end: running,
            rows: [i, i],
            lo: Math.min(start, running),
            hi: Math.max(start, running),
        };
    });
    if (showTotal && data.length > 0) {
        const i = data.length - 1;
        raw.push({
            label: totalLabel,
            kind: 'total',
            value: running,
            start: 0,
            end: running,
            rows: [i, i],
            lo: running,
            hi: running,
        });
    }

    // 2. The axis reaches zero and every running total.
    let lo = 0;
    let hi = 0;
    for (const s of raw) {
        lo = Math.min(lo, s.lo, s.start, s.end);
        hi = Math.max(hi, s.hi, s.start, s.end);
    }
    const axis = axisTicks(lo, hi, undefined, undefined, options.yTickCount ?? 4);
    const yLabels = axis.ticks.map((t) => valueFormatter(t));
    const left = showY ? labelWidth(yLabels) + (options.yTitle ? AXIS_TITLE : 0) : 0;
    const top = showY ? 6 : 0;
    const bottom = showX ? 22 + (options.xTitle ? AXIS_TITLE : 0) : 0;
    const plot = {
        x: left,
        y: top,
        width: Math.max(0, width - left - 4),
        height: Math.max(0, height - top - bottom),
    };

    // 3. Too many steps for the width: sum runs of changes between totals.
    const buckets = Math.max(1, Math.floor(plot.width / 4));
    const bucketed = raw.length > buckets;
    let bars = raw;
    if (bucketed) {
        const size = Math.ceil(raw.length / buckets);
        bars = [];
        let run: Raw | null = null;
        let first = '';
        let count = 0;
        const flush = () => {
            if (run) bars.push(run);
            run = null;
            count = 0;
        };
        for (const s of raw) {
            if (s.kind === 'total') {
                flush();
                bars.push(s);
                continue;
            }
            if (!run) {
                run = { ...s, rows: [...s.rows] as [number, number] };
                first = s.label;
            } else {
                const r: Raw = run;
                r.value += s.value;
                r.end = s.end;
                r.rows[1] = s.rows[1];
                r.lo = Math.min(r.lo, s.lo);
                r.hi = Math.max(r.hi, s.hi);
                r.kind = r.value < 0 ? 'decrease' : 'increase';
                r.label = `${first} – ${s.label}`;
            }
            if (++count >= size) flush();
        }
        flush();
    }

    const x = bandLayout(bars.length, plot.x, plot.x + plot.width, options.barPadding ?? 0.3);
    const y = linearScale(axis.domain, [plot.y + plot.height, plot.y]);
    const barW = Math.max(1, Math.min(x.bandwidth, options.maxBarWidth ?? 64));
    const steps: WaterfallStep[] = bars.map((s, i) => {
        const y0 = y(s.start);
        const y1 = y(s.end);
        let top = Math.min(y0, y1);
        let h = Math.abs(y1 - y0);
        // A change never vanishes into a sub-pixel bar.
        if (h < 1) {
            top -= (1 - h) / 2;
            h = 1;
        }
        return {
            index: i,
            label: s.label,
            kind: s.kind,
            value: s.value,
            start: s.start,
            end: s.end,
            rows: s.rows,
            x: (x.centers[i] as number) - barW / 2,
            y: top,
            width: barW,
            height: h,
            range: bucketed && s.kind !== 'total' ? [y(s.hi), y(s.lo)] : undefined,
        };
    });

    const connectors = bucketed
        ? []
        : steps.slice(0, -1).map((s, i) => {
              const next = steps[i + 1] as WaterfallStep;
              return { x1: s.x + s.width, x2: next.x, y: y(s.end) };
          });

    const labelW = Math.max(0, ...spreadIndices(steps.length, 200).map((i) => steps[i]?.label.length ?? 0)) * CHAR_W;
    const stride = Math.max(1, Math.ceil(steps.length / Math.max(1, Math.floor(plot.width / (labelW + 16 || 1)))));
    const xTicks: Tick[] = [];
    if (showX) {
        for (let i = 0; i < steps.length; i += stride) {
            xTicks.push({ value: i, position: x.centers[i] as number, label: (steps[i] as WaterfallStep).label });
        }
    }

    return {
        plot,
        x,
        y,
        xTicks,
        yTicks: toTicks(axis.ticks, yLabels, y),
        y2Ticks: [],
        steps,
        connectors,
        valueFormatter,
        bucketed,
    };
}
