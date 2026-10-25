/**
 * Status tones from Design System v1. A status breakdown takes its tone, never a categorical slot.
 * The `@ottabase/ui` `Tone` names (green, amber, red…) are accepted too, so a status map's tone plugs straight in.
 */
export type ChartTone =
    | 'success'
    | 'warning'
    | 'danger'
    | 'info'
    | 'smoke'
    | 'green'
    | 'amber'
    | 'red'
    | 'blue'
    | 'neutral'
    | 'brand';

/**
 * A series colour: a categorical slot (1-8), a status tone, or any CSS colour.
 * Omitted, the series takes the next free slot in order.
 */
export type ChartColor = number | ChartTone | (string & {});

export type SeriesType = 'line' | 'area' | 'bar';

export type Curve = 'linear' | 'monotone' | 'step';

/** `stacked` sums series; `percent` stacks each row's share of its total (0-1). */
export type StackMode = 'none' | 'stacked' | 'percent';

/** A chart's corner radius step: `none` 0, `sm` 2px, `md` 4px, `lg` 8px (see `MARK_RADII`). */
export type MarkRadius = 'none' | 'sm' | 'md' | 'lg';

export interface SeriesConfig {
    /** Column in each row that holds this series' value. */
    key: string;
    /** Legend and tooltip label. Defaults to `key`. */
    label?: string;
    color?: ChartColor;
    /** Only read by combo charts; the chart type sets it otherwise. */
    type?: SeriesType;
    /** Draw against the right y axis (a second unit, e.g. revenue beside signups). Default `left`. */
    axis?: 'left' | 'right';
}

/** Shorthand accepted everywhere a series list is: a bare key or a full config. */
export type SeriesInput = string | SeriesConfig;

/** A series after defaults are applied: label and colour resolved. */
export interface ResolvedSeries {
    key: string;
    label: string;
    /** A CSS colour, ready for `fill`/`stroke`. */
    color: string;
    type: SeriesType;
    axis: 'left' | 'right';
}

export type ChartRow = Record<string, unknown>;

export type Formatter = (value: number) => string;
