import type { ChartColor, ChartTone, ResolvedSeries, SeriesInput, SeriesType } from './types';

/** Categorical slots the brand engine emits (`--chart-1` … `--chart-8`). */
export const CHART_SLOTS = 8;

const TONE_VAR: Record<ChartTone, string> = {
    success: 'success',
    warning: 'warning',
    danger: 'destructive',
    info: 'info',
    smoke: 'smoke',
    green: 'success',
    amber: 'warning',
    red: 'destructive',
    blue: 'info',
    neutral: 'neutral',
    brand: 'primary',
};

/**
 * The CSS colour of a categorical slot. Slots are assigned in order and never cycle
 * (Design System v1): past slot 8 the colour stays on 8, the neutral, so fold the
 * tail with `groupOther()` rather than charting more than eight series.
 */
export function chartColor(slot: number): string {
    const n = Math.min(Math.max(Math.round(slot), 1), CHART_SLOTS);
    return `hsl(var(--chart-${n}))`;
}

export function toneColor(tone: ChartTone): string {
    return `hsl(var(--${TONE_VAR[tone]}))`;
}

/** Recessive chrome: the grid, the axis line and tick labels. */
export const CHART_CHROME = {
    grid: 'hsl(var(--chart-grid, var(--border)))',
    axis: 'hsl(var(--chart-axis, var(--input)))',
    label: 'hsl(var(--chart-label, var(--muted-foreground)))',
} as const;

function isTone(value: string): value is ChartTone {
    return value in TONE_VAR;
}

/** Resolve a `ChartColor` to CSS. `fallbackSlot` is used when `color` is omitted. */
export function resolveColor(color: ChartColor | undefined, fallbackSlot: number): string {
    if (color === undefined) return chartColor(fallbackSlot);
    if (typeof color === 'number') return chartColor(color);
    return isTone(color) ? toneColor(color) : color;
}

/**
 * Normalise a series list. A series without a colour takes the next slot that no
 * other series claimed explicitly, so pinning one series to slot 1 does not make
 * the next one share it.
 */
export function resolveSeries(series: SeriesInput[], defaultType: SeriesType): ResolvedSeries[] {
    const configs = series.map((s) => (typeof s === 'string' ? { key: s } : s));
    const taken = new Set(configs.map((c) => c.color).filter((c): c is number => typeof c === 'number'));
    let next = 1;
    return configs.map((c) => {
        let color = c.color;
        if (color === undefined) {
            while (taken.has(next) && next < CHART_SLOTS) next++;
            color = next;
            taken.add(next);
        }
        return {
            key: c.key,
            label: c.label ?? c.key,
            color: resolveColor(color, next),
            type: c.type ?? defaultType,
            axis: c.axis ?? 'left',
        };
    });
}
