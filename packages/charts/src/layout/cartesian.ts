import { toNumber } from '../data';
import { formatCompact, formatPercent } from '../format';
import { bandLayout, linearScale, niceTicks, pointLayout, type BandLayout, type LinearScale } from '../scale';
import { areaPath, linePath, type AreaPoint } from '../shape';
import type { ChartRow, Curve, Formatter, ResolvedSeries, StackMode } from '../types';

/** Design System v1: square-ended bars with 2px gaps between neighbours and stacked segments. */
export const BAR_GAP = 2;

// ponytail: tick labels are measured by character count, not by the DOM. 10px mono ≈ 6.2px a glyph.
const CHAR_W = 6.2;
/** Height reserved for an axis title. */
const AXIS_TITLE = 16;

export interface Insets {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

export interface AxisOptions {
    /** Fixed bottom of the axis. Default: 0, or the lowest value when it is negative. */
    minValue?: number;
    /** Fixed top of the axis. Default: the next round tick above the data. */
    maxValue?: number;
    /** Formats this axis' ticks. */
    valueFormatter?: Formatter;
    /** Axis title; space is reserved for it. */
    title?: string;
    /** Extra values the axis must reach (reference lines, targets). */
    include?: number[];
}

export interface CartesianOptions {
    data: ChartRow[];
    /** Column for the x axis (one category per row). */
    index: string;
    series: ResolvedSeries[];
    width: number;
    height: number;
    stack?: StackMode;
    curve?: Curve;
    /** Draw lines across missing values instead of breaking them. */
    connectNulls?: boolean;
    /** Fixed bottom of the left y axis. Default: 0, or the lowest value when it is negative. */
    minValue?: number;
    /** Fixed top of the left y axis. Default: the next round tick above the data. */
    maxValue?: number;
    /** Start the y axis at the data instead of at zero (lines only; bars always start at zero). */
    autoMinValue?: boolean;
    yTickCount?: number;
    showXAxis?: boolean;
    showYAxis?: boolean;
    /** Formats left y ticks. Default: compact numbers, or percents for a percent stack. */
    valueFormatter?: Formatter;
    indexFormatter?: (value: string) => string;
    /** Extra left-axis values the axis must reach (reference lines, targets). */
    include?: number[];
    /** The right y axis, used by series with `axis: 'right'`. */
    rightAxis?: AxisOptions;
    /** Titles; space is reserved under the x axis and beside each y axis. */
    xTitle?: string;
    yTitle?: string;
    /** Extra space around the plot, added to what the axes need. */
    inset?: Partial<Insets>;
    /** Share of each band left empty around its bars (0-1). */
    barPadding?: number;
    /** Widest a single bar may grow, px. */
    maxBarWidth?: number;
}

export interface BarRect {
    x: number;
    y: number;
    width: number;
    height: number;
    value: number;
    index: number;
}

export interface SeriesGeometry extends ResolvedSeries {
    /** The value per row as charted (a share of the row total in a percent stack); null is a gap. */
    values: (number | null)[];
    /** Point per row; `y0` is its baseline. Null where the value is missing. */
    points: (AreaPoint | null)[];
    /** SVG `d` for line and area series. */
    line: string;
    /** SVG `d` for the fill of area series. */
    area: string;
    bars: BarRect[];
    /** The y scale this series is drawn on. */
    scale: LinearScale;
}

export interface Tick {
    value: number;
    /** Pixel position along the axis. */
    position: number;
    label: string;
}

export interface CartesianLayout {
    plot: { x: number; y: number; width: number; height: number };
    /** Centre of each row along x. */
    x: BandLayout;
    y: LinearScale;
    yTicks: Tick[];
    /** The right axis, present when a series uses it. */
    y2?: LinearScale;
    y2Ticks: Tick[];
    /** The x labels that fit, thinned evenly when the plot is too narrow for all of them. */
    xTicks: Tick[];
    series: SeriesGeometry[];
    valueFormatter: Formatter;
    rightValueFormatter: Formatter;
    /** Pixel y of zero on the left axis (the bar baseline), clamped to the plot. */
    baseline: number;
}

/** Series that stack together: same mark type, same axis. Lines never stack. */
function stackGroup(s: ResolvedSeries): string | null {
    return s.type === 'line' ? null : `${s.type}:${s.axis}`;
}

interface AxisDomain {
    ticks: number[];
    domain: [number, number];
}

/** Round ticks covering [lo, hi], or exactly the pinned bounds when given. */
function axisTicks(
    lo: number,
    hi: number,
    min: number | undefined,
    max: number | undefined,
    count: number,
): AxisDomain {
    if (!Number.isFinite(lo)) {
        lo = 0;
        hi = 1;
    }
    let ticks = niceTicks(min ?? lo, max ?? hi, count);
    if (min !== undefined || max !== undefined) {
        // A pinned bound is the axis end exactly, not the round tick beyond it.
        const lower = min ?? (ticks[0] as number);
        const upper = max ?? (ticks[ticks.length - 1] as number);
        ticks = ticks.filter((t) => t >= lower && t <= upper);
        if (ticks[0] !== lower) ticks.unshift(lower);
        if (ticks[ticks.length - 1] !== upper) ticks.push(upper);
    }
    return { ticks, domain: [ticks[0] as number, ticks[ticks.length - 1] as number] };
}

/**
 * All the geometry of a line, area, bar or combo chart as plain numbers and path
 * strings. No DOM and no React: the `/react` components draw it, and a native
 * renderer could draw the same output.
 */
export function computeCartesian(options: CartesianOptions): CartesianLayout {
    const { data, index, series, width, height, stack = 'none', curve = 'linear' } = options;
    const showX = options.showXAxis ?? true;
    const showY = options.showYAxis ?? true;
    const isPercent = stack === 'percent';
    const valueFormatter: Formatter =
        options.valueFormatter ?? (isPercent ? (v) => formatPercent(v, 0) : (v) => formatCompact(v));
    const right = options.rightAxis ?? {};
    const rightValueFormatter: Formatter = right.valueFormatter ?? ((v) => formatCompact(v));
    const indexFormatter = options.indexFormatter ?? ((v: string) => v);
    const hasRight = series.some((s) => s.axis === 'right');

    // 1. Raw values, then stacked [base, top] spans per series and row.
    const raw = series.map((s) => data.map((row) => toNumber(row[s.key])));
    const spans: ([number, number] | null)[][] = series.map((s, si) =>
        (raw[si] as (number | null)[]).map((v) => (v === null ? null : [0, v])),
    );
    const charted: (number | null)[][] = raw.map((r) => [...r]);
    if (stack !== 'none') {
        const groups = new Map<string, number[]>();
        series.forEach((s, si) => {
            const g = stackGroup(s);
            if (g) groups.set(g, [...(groups.get(g) ?? []), si]);
        });
        for (const members of groups.values()) {
            data.forEach((_, ri) => {
                const total = members.reduce((sum, si) => sum + Math.abs(raw[si]?.[ri] ?? 0), 0);
                let pos = 0;
                let neg = 0;
                for (const si of members) {
                    let v = raw[si]?.[ri] ?? null;
                    if (v === null) continue;
                    if (isPercent) v = total === 0 ? 0 : v / total;
                    (charted[si] as (number | null)[])[ri] = v;
                    const base = v >= 0 ? pos : neg;
                    (spans[si] as ([number, number] | null)[])[ri] = [base, base + v];
                    if (v >= 0) pos += v;
                    else neg += v;
                }
            });
        }
    }

    // 2. One domain per axis: every span end, plus zero under bars and areas.
    const extent = (axis: 'left' | 'right', include: number[]): [number, number] => {
        let lo = Infinity;
        let hi = -Infinity;
        let hasFill = false;
        series.forEach((s, si) => {
            if (s.axis !== axis) return;
            if (s.type !== 'line') hasFill = true;
            const stacked = stack !== 'none' && stackGroup(s) !== null;
            for (const span of spans[si] as ([number, number] | null)[]) {
                if (!span) continue;
                for (const v of stacked ? span : [span[1]]) {
                    lo = Math.min(lo, v);
                    hi = Math.max(hi, v);
                }
            }
        });
        for (const v of include) {
            lo = Math.min(lo, v);
            hi = Math.max(hi, v);
        }
        if (Number.isFinite(lo) && (hasFill || !options.autoMinValue)) {
            // Bars and fills grow from zero, so the axis must reach it from either side.
            lo = Math.min(lo, 0);
            hi = Math.max(hi, 0);
        }
        if (isPercent && axis === 'left') {
            lo = Math.min(lo, 0);
            hi = Math.max(hi, 1);
        }
        return [lo, hi];
    };
    const tickCount = options.yTickCount ?? 4;
    const leftAxis = axisTicks(...extent('left', options.include ?? []), options.minValue, options.maxValue, tickCount);
    const rightAxisTicks = hasRight
        ? axisTicks(...extent('right', right.include ?? []), right.minValue, right.maxValue, tickCount)
        : null;

    // 3. The plot box: room for the tick labels and titles the axes need.
    const yLabels = leftAxis.ticks.map((t) => valueFormatter(t));
    const y2Labels = rightAxisTicks ? rightAxisTicks.ticks.map((t) => rightValueFormatter(t)) : [];
    const xLabels = data.map((row) => indexFormatter(String(row[index] ?? '')));
    const xLabelW = Math.max(0, ...xLabels.map((l) => l.length)) * CHAR_W;
    const labelW = (labels: string[]) => Math.ceil(Math.max(0, ...labels.map((l) => l.length)) * CHAR_W + 8);
    const yAxisW = showY ? labelW(yLabels) + (options.yTitle ? AXIS_TITLE : 0) : 0;
    const y2AxisW = showY && rightAxisTicks ? labelW(y2Labels) + (right.title ? AXIS_TITLE : 0) : 0;
    const hasBars = series.some((s) => s.type === 'bar');
    // Edge-to-edge points put the first and last label on the plot edge; half of each overhangs.
    const overhang = showX && !hasBars ? xLabelW / 2 : 0;
    const inset = options.inset ?? {};
    const left = Math.max(yAxisW, overhang) + (inset.left ?? 0);
    const rightW = Math.max(y2AxisW, overhang, showX ? 4 : 0) + (inset.right ?? 0);
    const top = (showY ? 6 : 0) + (inset.top ?? 0);
    const bottom = (showX ? 22 + (options.xTitle ? AXIS_TITLE : 0) : 0) + (inset.bottom ?? 0);
    const plot = {
        x: left,
        y: top,
        width: Math.max(0, width - left - rightW),
        height: Math.max(0, height - top - bottom),
    };

    const range: [number, number] = [plot.y + plot.height, plot.y];
    const y = linearScale(leftAxis.domain, range);
    const y2 = rightAxisTicks ? linearScale(rightAxisTicks.domain, range) : undefined;
    const x = hasBars
        ? bandLayout(data.length, plot.x, plot.x + plot.width, options.barPadding ?? 0.35)
        : pointLayout(data.length, plot.x, plot.x + plot.width);

    const toTicks = (ticks: number[], labels: string[], scale: LinearScale): Tick[] =>
        ticks.map((value, i) => ({ value, position: scale(value), label: labels[i] as string }));
    const yTicks = toTicks(leftAxis.ticks, yLabels, y);
    const y2Ticks = rightAxisTicks && y2 ? toTicks(rightAxisTicks.ticks, y2Labels, y2) : [];
    const fit = Math.max(1, Math.floor(plot.width / (xLabelW + 16 || 1)));
    const stride = Math.max(1, Math.ceil(data.length / fit));
    const xTicks: Tick[] = showX
        ? x.centers
              .map((position, i) => ({ value: i, position, label: xLabels[i] as string }))
              .filter((_, i) => i % stride === 0)
        : [];

    // 4. Marks.
    const zeroOf = (scale: LinearScale) => scale(Math.min(Math.max(0, scale.domain[0]), scale.domain[1]));
    const baseline = zeroOf(y);
    const barSeries = series.map((s, si) => (s.type === 'bar' ? si : -1)).filter((si) => si >= 0);
    const grouped = stack === 'none' && barSeries.length > 1;
    const maxBar = options.maxBarWidth ?? 48;
    const groupW = Math.min(x.bandwidth, maxBar * (grouped ? barSeries.length : 1));
    const barW = grouped ? Math.max(1, (groupW - BAR_GAP * (barSeries.length - 1)) / barSeries.length) : groupW;
    // Per row and sign: has a stacked segment already been placed against the axis?
    const placed = data.map(() => ({ pos: false, neg: false }));

    const geometry: SeriesGeometry[] = series.map((s, si) => {
        const scale = s.axis === 'right' && y2 ? y2 : y;
        const values = charted[si] as (number | null)[];
        const stacked = stack !== 'none' && s.type !== 'line';
        const points: (AreaPoint | null)[] = (spans[si] as ([number, number] | null)[]).map((span, ri) => {
            if (!span) return null;
            return {
                x: x.centers[ri] as number,
                y: scale(span[1]),
                y0: stacked ? scale(span[0]) : zeroOf(scale),
            };
        });

        const bars: BarRect[] = [];
        if (s.type === 'bar') {
            const slot = barSeries.indexOf(si);
            points.forEach((p, ri) => {
                const value = values[ri];
                if (!p || value === null || value === undefined) return;
                const left = (x.centers[ri] as number) - groupW / 2 + (grouped ? slot * (barW + BAR_GAP) : 0);
                let top = Math.min(p.y, p.y0);
                let h = Math.abs(p.y0 - p.y);
                if (stacked && value !== 0) {
                    // Every segment after the first in its direction leaves a gap on its axis side.
                    const sign = value > 0 ? 'pos' : 'neg';
                    const row = placed[ri] as { pos: boolean; neg: boolean };
                    if (row[sign] && h > BAR_GAP) {
                        h -= BAR_GAP;
                        if (value < 0) top += BAR_GAP;
                    }
                    row[sign] = true;
                }
                // A non-zero value never vanishes into a sub-pixel bar.
                if (value !== 0 && h < 1) {
                    if (value > 0) top = p.y0 - 1;
                    h = 1;
                }
                bars.push({ x: left, y: top, width: barW, height: h, value, index: ri });
            });
        }

        const linePoints = options.connectNulls ? points.filter((p) => p !== null) : points;
        return {
            ...s,
            values,
            points,
            line: s.type === 'bar' ? '' : linePath(linePoints, curve),
            area: s.type === 'area' ? areaPath(linePoints, curve) : '',
            bars,
            scale,
        };
    });

    return {
        plot,
        x,
        y,
        yTicks,
        y2,
        y2Ticks,
        xTicks,
        series: geometry,
        valueFormatter,
        rightValueFormatter,
        baseline,
    };
}
