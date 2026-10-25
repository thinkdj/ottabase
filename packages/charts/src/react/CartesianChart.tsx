import {
    useCallback,
    useId,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent,
    type PointerEvent,
    type ReactNode,
} from 'react';
import { resolveSeries } from '../color';
import { toNumber } from '../data';
import { formatCompact, formatPercent } from '../format';
import { computeCartesian, type AxisOptions, type SeriesGeometry, type Tick } from '../layout/cartesian';
import { nearestIndex } from '../scale';
import type { ChartRow, Curve, Formatter, MarkRadius, SeriesInput, SeriesType, StackMode } from '../types';
import { ChartLegend } from './ChartLegend';
import { ChartSkeleton } from './ChartSkeleton';
import { ChartTooltip, TooltipContent, type TooltipItem } from './ChartTooltip';
import { Axes } from './cartesian/Axes';
import { pt, type Frame } from './cartesian/frame';
import { Marks, type ValueLabels } from './cartesian/Marks';
import { Bands, OverlayLines, type Annotation, type ReferenceArea, type ReferenceLine } from './cartesian/Overlays';
import { cx, MARK_RADII, rowIndexOf, useElementWidth, useReveal } from './utils';

export type { Annotation, ReferenceArea, ReferenceLine } from './cartesian/Overlays';

export interface ValueClickPayload {
    row: ChartRow;
    index: number;
}

export interface RangeSelectPayload {
    /** First and last selected row index, ascending. */
    start: number;
    end: number;
    rows: ChartRow[];
}

export interface TooltipSeriesValue {
    key: string;
    label: string;
    color: string;
    axis: 'left' | 'right';
    /** The raw value from the row; null when missing. */
    value: number | null;
    formatted: string;
}

export interface TooltipContext {
    row: ChartRow;
    index: number;
    /** The formatted index label. */
    label: string;
    series: TooltipSeriesValue[];
    /** Sum of the stacked series, when stacking. */
    total: number | null;
}

export interface CartesianChartProps {
    data: ChartRow[];
    /** Column for the x axis. */
    index: string;
    /** Columns to chart, in slot order. A combo chart sets `type` per series; `axis: 'right'` uses a second y axis. */
    series: SeriesInput[];
    /** Plot height in px, axes included. Default 240. */
    height?: number;
    /** Fixed width in px. Default: fill the container. */
    width?: number;
    /** `horizontal` runs categories down the left and values along the bottom (bars). Default `vertical`. */
    orientation?: 'vertical' | 'horizontal';
    stack?: StackMode;
    curve?: Curve;
    /** Draw lines across missing values instead of leaving a gap. */
    connectNulls?: boolean;
    /** Formats values in the tooltip and on the left y axis (a percent stack's axis is always percent). */
    valueFormatter?: Formatter;
    /** Formats x labels and the tooltip title. See `dateFormatter()`. */
    indexFormatter?: (value: string) => string;
    /** The right y axis, for series with `axis: 'right'`. */
    rightAxis?: AxisOptions;
    /** Axis titles. */
    xTitle?: string;
    yTitle?: string;
    minValue?: number;
    maxValue?: number;
    /** Start the y axis at the data instead of zero. Ignored when bars or areas are present. */
    autoMinValue?: boolean;
    yTickCount?: number;
    showXAxis?: boolean;
    showYAxis?: boolean;
    showGrid?: boolean;
    /** Default: on when there is more than one series. */
    showLegend?: boolean;
    legendPosition?: 'top' | 'bottom';
    showTooltip?: boolean;
    /** Point markers on lines. Default `last`: the latest reading, as in the spec. */
    dots?: 'none' | 'last' | 'all';
    /** Data labels: `true`/`'all'` on every bar and point, `'last'` on the latest only. Stacks label their totals. */
    showValues?: boolean | ValueLabels;
    referenceLines?: ReferenceLine[];
    /** Shaded bands over a run of rows: a weekend, an incident, a campaign. */
    referenceAreas?: ReferenceArea[];
    /** Labelled markers at a row: a deploy, a price change. */
    annotations?: Annotation[];
    onValueClick?: (payload: ValueClickPayload) => void;
    /** Drag (or Shift+arrows) to select a run of rows. Enables the selection UI. */
    onRangeSelect?: (payload: RangeSelectPayload) => void;
    /** Controlled selection, as row indexes. `null` clears it. */
    range?: [number, number] | null;
    /** Replace the tooltip body. `TooltipContent` renders the standard rows. */
    renderTooltip?: (ctx: TooltipContext) => ReactNode;
    /** Reveal transition on mount. Default on; collapses under `prefers-reduced-motion`. */
    animate?: boolean;
    /** Draw a skeleton instead of the data. */
    loading?: boolean;
    /** Accessible name. Also titles the screen-reader data table. */
    /** Corner radius of the marks: `none` 0, `sm` 2px, `md` 4px, `lg` 8px. Default `sm`. */
    radius?: MarkRadius;
    title?: string;
    emptyText?: ReactNode;
    className?: string;
    /** Share of each band left empty around its bars (0-1). */
    barPadding?: number;
    /** Widest a single bar may grow, px. */
    maxBarWidth?: number;
}

interface InternalProps extends CartesianChartProps {
    defaultType: SeriesType;
}

const identity = (v: string) => v;
const NONE: never[] = [];
// ponytail: the same character-width estimate the engine uses for its own labels.
const CHAR_W = 6.2;

function CartesianChart({
    data,
    index,
    series,
    defaultType,
    height = 240,
    width: fixedWidth,
    orientation = 'vertical',
    stack = 'none',
    curve = 'linear',
    connectNulls = false,
    valueFormatter = formatCompact,
    indexFormatter = identity,
    rightAxis,
    xTitle,
    yTitle,
    minValue,
    maxValue,
    autoMinValue,
    yTickCount,
    showXAxis = true,
    showYAxis = true,
    showGrid = true,
    showLegend,
    legendPosition = 'bottom',
    showTooltip = true,
    dots = 'last',
    showValues = false,
    referenceLines = NONE,
    referenceAreas = NONE,
    annotations = NONE,
    onValueClick,
    onRangeSelect,
    range,
    renderTooltip,
    animate = true,
    loading = false,
    radius = 'sm',
    title,
    emptyText = 'No data',
    className,
    barPadding,
    maxBarWidth,
}: InternalProps) {
    const [ref, measured] = useElementWidth<HTMLDivElement>(fixedWidth);
    const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
    const [emphasis, setEmphasis] = useState<string | null>(null);
    const [active, setActive] = useState<number | null>(null);
    const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
    const [innerRange, setInnerRange] = useState<[number, number] | null>(null);
    const drag = useRef<{ start: number; moved: boolean } | null>(null);
    const id = useId();
    const revealed = useReveal(animate);
    const transposed = orientation === 'horizontal';
    const isPercent = stack === 'percent';
    const selection = range !== undefined ? range : innerRange;
    const values: ValueLabels = showValues === true ? 'all' : showValues === false ? 'none' : showValues;

    // Colours resolve against the full list, so hiding a series never recolours the rest.
    const resolved = useMemo(() => resolveSeries(series, defaultType), [series, defaultType]);
    const visible = useMemo(() => resolved.filter((s) => !hidden.has(s.key)), [resolved, hidden]);
    const hasBars = visible.some((s) => s.type === 'bar');

    const layout = useMemo(() => {
        if (measured <= 0) return null;
        const categoryW = Math.max(0, ...data.map((r) => indexFormatter(String(r[index] ?? '')).length)) * CHAR_W;
        const shared = {
            data,
            index,
            series: visible,
            stack,
            curve,
            connectNulls,
            // A percent stack's axis shows shares; the caller's formatter is for raw values.
            valueFormatter: isPercent ? (v: number) => formatPercent(v, 0) : valueFormatter,
            indexFormatter,
            rightAxis,
            minValue,
            maxValue,
            autoMinValue,
            yTickCount,
            include: referenceLines.filter((r) => r.axis !== 'right').map((r) => r.value),
            barPadding,
            maxBarWidth,
        };
        return transposed
            ? computeCartesian({
                  ...shared,
                  width: height,
                  height: measured,
                  showXAxis: false,
                  showYAxis: false,
                  // Computed insets map onto the rotated chart: bottom → left (category labels),
                  // right → bottom (value ticks), top → right, left → top.
                  inset: {
                      left: 4,
                      top: 8,
                      bottom: showXAxis ? categoryW + 12 : 4,
                      right: showYAxis ? 20 + (yTitle ? 16 : 0) : 4,
                  },
              })
            : computeCartesian({ ...shared, width: measured, height, showXAxis, showYAxis, xTitle, yTitle });
    }, [
        measured,
        data,
        index,
        visible,
        height,
        transposed,
        stack,
        curve,
        connectNulls,
        isPercent,
        valueFormatter,
        indexFormatter,
        rightAxis,
        minValue,
        maxValue,
        autoMinValue,
        yTickCount,
        showXAxis,
        showYAxis,
        xTitle,
        yTitle,
        referenceLines,
        barPadding,
        maxBarWidth,
    ]);

    // Stable across pointer moves, so the memoised axes and marks skip those renders.
    const frame: Frame | null = useMemo(
        () => (layout ? { layout, width: measured, height, transposed } : null),
        [layout, measured, height, transposed],
    );
    const legend = showLegend ?? resolved.length > 1;
    const empty = data.length === 0;
    const formatOf = useCallback(
        (s: SeriesGeometry): Formatter =>
            s.axis === 'right' ? (rightAxis?.valueFormatter ?? formatCompact) : valueFormatter,
        [rightAxis, valueFormatter],
    );

    const categoryTicks: Tick[] = useMemo(() => {
        if (!layout || !transposed) return [];
        const stride = Math.max(1, Math.ceil(12 / (layout.x.step || 12)));
        return layout.x.centers
            .map((position, i) => ({ value: i, position, label: indexFormatter(String(data[i]?.[index] ?? '')) }))
            .filter((_, i) => i % stride === 0);
    }, [layout, transposed, data, index, indexFormatter]);

    const resolvedAreas = useMemo(
        () =>
            referenceAreas
                .map((a) => ({
                    ...a,
                    fromIndex: rowIndexOf(data, index, a.from),
                    toIndex: rowIndexOf(data, index, a.to),
                }))
                .filter((a) => a.fromIndex >= 0 && a.toIndex >= 0),
        [referenceAreas, data, index],
    );
    const resolvedAnnotations = useMemo(
        () =>
            annotations
                .map((a) => ({ ...a, rowIndex: rowIndexOf(data, index, a.index) }))
                .filter((a) => a.rowIndex >= 0),
        [annotations, data, index],
    );

    const toggle = (key: string) =>
        setHidden((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else if (next.size < resolved.length - 1) next.add(key); // never hide the last series
            return next;
        });

    const indexAt = (e: PointerEvent<SVGSVGElement>): { i: number; x: number; y: number } | null => {
        if (!layout) return null;
        const box = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - box.left;
        const y = e.clientY - box.top;
        return { i: nearestIndex(layout.x.centers, transposed ? y : x), x, y };
    };

    const commitRange = (a: number, b: number) => {
        const start = Math.min(a, b);
        const end = Math.max(a, b);
        if (range === undefined) setInnerRange([start, end]);
        onRangeSelect?.({ start, end, rows: data.slice(start, end + 1) });
    };

    const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
        const hit = indexAt(e);
        if (!hit) return;
        setActive(hit.i);
        setPointer({ x: hit.x, y: hit.y });
        if (drag.current) {
            if (hit.i !== drag.current.start) drag.current.moved = true;
            setInnerRange([drag.current.start, hit.i]);
        }
    };
    const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
        if (!onRangeSelect || e.button !== 0) return;
        const hit = indexAt(e);
        if (!hit) return;
        drag.current = { start: hit.i, moved: false };
        e.currentTarget.setPointerCapture(e.pointerId);
        if (range === undefined) setInnerRange(null);
    };
    const onPointerUp = (e: PointerEvent<SVGSVGElement>) => {
        const d = drag.current;
        drag.current = null;
        if (!d) return;
        const hit = indexAt(e);
        if (d.moved && hit) commitRange(d.start, hit.i);
        else if (range === undefined) setInnerRange(null);
    };
    const onClick = () => {
        if (active === null || drag.current?.moved) return;
        onValueClick?.({ row: data[active] as ChartRow, index: active });
    };

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (!data.length) return;
        const last = data.length - 1;
        const forward = transposed ? 'ArrowDown' : 'ArrowRight';
        const back = transposed ? 'ArrowUp' : 'ArrowLeft';
        const moves: Record<string, number> = {
            [forward]: Math.min((active ?? -1) + 1, last),
            [back]: Math.max((active ?? data.length) - 1, 0),
            Home: 0,
            End: last,
        };
        if (e.key in moves) {
            e.preventDefault();
            const next = moves[e.key] as number;
            setPointer(null);
            setActive(next);
            if (e.shiftKey && onRangeSelect) {
                const anchor = selection ? selection[0] : (active ?? next);
                if (range === undefined) setInnerRange([anchor, next]);
            }
        } else if (e.key === 'Escape') {
            setActive(null);
            if (range === undefined) setInnerRange(null);
        } else if (e.key === 'Enter' || e.key === ' ') {
            if (active === null) return;
            e.preventDefault();
            if (selection && onRangeSelect && selection[0] !== selection[1]) commitRange(selection[0], selection[1]);
            else onValueClick?.({ row: data[active] as ChartRow, index: active });
        }
    };

    // Tooltip content for the active row.
    const activeRow = active !== null ? data[active] : undefined;
    const tooltipCtx: TooltipContext | null =
        layout && activeRow && active !== null
            ? {
                  row: activeRow,
                  index: active,
                  label: indexFormatter(String(activeRow[index] ?? '')),
                  series: layout.series.map((s) => {
                      const value = toNumber(activeRow[s.key]);
                      return {
                          key: s.key,
                          label: s.label,
                          color: s.color,
                          axis: s.axis,
                          value,
                          formatted: value === null ? '—' : formatOf(s)(value),
                      };
                  }),
                  total:
                      stack !== 'none' && layout.series.length > 1
                          ? layout.series.reduce(
                                (sum, s) => sum + (s.type === 'line' ? 0 : (toNumber(activeRow[s.key]) ?? 0)),
                                0,
                            )
                          : null,
              }
            : null;
    const anchor = (() => {
        if (!layout || !frame || active === null) return { x: 0, y: 0 };
        if (pointer) return pointer;
        const [x, y] = pt(frame, layout.x.centers[active] ?? 0, layout.plot.y + layout.plot.height / 2);
        return { x, y };
    })();
    // In a percent stack the tooltip shows the raw value and its share of the row.
    const shareOf = (key: string, ri: number): string | null => {
        if (!isPercent || !layout) return null;
        const s = layout.series.find((g) => g.key === key);
        const v = s?.values[ri];
        return s && s.type !== 'line' && v !== null && v !== undefined ? formatPercent(v) : null;
    };

    const legendNode = legend ? (
        <ChartLegend
            items={resolved.map((s) => ({
                key: s.key,
                label: s.label,
                color: s.color,
                shape: s.type === 'line' ? 'line' : 'square',
            }))}
            hidden={hidden}
            onToggle={toggle}
            onHover={setEmphasis}
        />
    ) : null;

    return (
        <div data-slot="chart" className={cx('flex w-full min-w-0 flex-col gap-3', className)}>
            {legendPosition === 'top' && legendNode}
            <div
                ref={ref}
                role="group"
                aria-roledescription="chart"
                aria-label={title}
                aria-busy={loading || undefined}
                tabIndex={empty || loading ? undefined : 0}
                onKeyDown={onKeyDown}
                onFocus={() => setActive((a) => a ?? data.length - 1)}
                onBlur={() => {
                    setActive(null);
                    setPointer(null);
                }}
                className="relative w-full rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{ height }}
            >
                {loading ? (
                    <ChartSkeleton />
                ) : empty ? (
                    <div className="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                        {emptyText}
                    </div>
                ) : frame && layout ? (
                    <svg
                        width={measured}
                        height={height}
                        aria-hidden="true"
                        className={cx(
                            'block select-none overflow-visible',
                            onValueClick && active !== null && 'cursor-pointer',
                            onRangeSelect && 'cursor-crosshair',
                        )}
                        style={{ touchAction: transposed ? 'pan-x' : 'pan-y' }}
                        onPointerMove={onPointerMove}
                        onPointerDown={onPointerDown}
                        onPointerUp={onPointerUp}
                        onPointerLeave={() => {
                            if (!drag.current) {
                                setActive(null);
                                setPointer(null);
                            }
                        }}
                        onClick={onClick}
                    >
                        <Bands
                            frame={frame}
                            referenceAreas={resolvedAreas}
                            selection={selection}
                            active={active}
                            hasBars={hasBars}
                            showCursor={showTooltip}
                        />
                        <Axes
                            frame={frame}
                            showGrid={showGrid}
                            showXAxis={showXAxis}
                            showYAxis={showYAxis}
                            xTitle={transposed ? yTitle : xTitle}
                            yTitle={transposed ? undefined : yTitle}
                            y2Title={rightAxis?.title}
                            categoryTicks={categoryTicks}
                        />
                        <Marks
                            frame={frame}
                            clipId={`${id}-clip`}
                            gradientPrefix={`${id}-g`}
                            active={active}
                            emphasis={emphasis}
                            stacked={stack !== 'none'}
                            dots={dots}
                            showValues={values}
                            formatOf={formatOf}
                            revealed={revealed}
                            animate={animate}
                            radius={MARK_RADII[radius]}
                        />
                        <OverlayLines
                            frame={frame}
                            referenceLines={referenceLines}
                            referenceAreas={resolvedAreas}
                            annotations={resolvedAnnotations}
                            active={active}
                            hasBars={hasBars}
                            showCursor={showTooltip}
                        />
                        {/* The hovered points on lines and areas, ringed in the background colour. */}
                        {showTooltip &&
                            active !== null &&
                            layout.series
                                .filter((s) => s.type !== 'bar')
                                .map((s) => {
                                    const p = s.points[active];
                                    if (!p) return null;
                                    const [cxp, cyp] = pt(frame, p.x, p.y);
                                    return (
                                        <circle
                                            key={`active-${s.key}`}
                                            cx={cxp}
                                            cy={cyp}
                                            r={4}
                                            strokeWidth={2}
                                            className="stroke-background"
                                            style={{ fill: s.color }}
                                        />
                                    );
                                })}
                    </svg>
                ) : null}

                {showTooltip && tooltipCtx && (
                    <ChartTooltip anchor={anchor} bounds={{ width: measured, height }}>
                        {renderTooltip ? (
                            renderTooltip(tooltipCtx)
                        ) : (
                            <TooltipContent
                                title={tooltipCtx.label}
                                items={tooltipCtx.series.map((s): TooltipItem => {
                                    const share = shareOf(s.key, tooltipCtx.index);
                                    return {
                                        key: s.key,
                                        label: s.label,
                                        color: s.color,
                                        value: share ? `${s.formatted} · ${share}` : s.formatted,
                                    };
                                })}
                                footer={
                                    tooltipCtx.total !== null
                                        ? { key: 'total', label: 'Total', value: valueFormatter(tooltipCtx.total) }
                                        : undefined
                                }
                            />
                        )}
                    </ChartTooltip>
                )}
            </div>
            {legendPosition === 'bottom' && legendNode}

            {/* The same numbers for screen readers; the SVG itself is aria-hidden. */}
            <table className="sr-only">
                {/* A caption renders outside the table box, so the table's sr-only clip misses it. */}
                {title && <caption className="sr-only">{title}</caption>}
                <thead>
                    <tr>
                        <th scope="col">{index}</th>
                        {resolved.map((s) => (
                            <th key={s.key} scope="col">
                                {s.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, i) => (
                        <tr key={i}>
                            <th scope="row">{indexFormatter(String(row[index] ?? ''))}</th>
                            {resolved.map((s) => {
                                const v = toNumber(row[s.key]);
                                return <td key={s.key}>{v === null ? '' : valueFormatter(v)}</td>;
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/** Trends over time. 2px lines; the latest reading gets a dot. */
export function LineChart(props: CartesianChartProps) {
    return <CartesianChart {...props} defaultType="line" />;
}

/** Trends with volume: a line over a gradient fill. `stack` sums series; `percent` shows shares. */
export function AreaChart(props: CartesianChartProps) {
    return <CartesianChart dots="none" {...props} defaultType="area" />;
}

/** Compare categories or periods. Square-ended bars; grouped by default, `stack` to sum, `orientation="horizontal"` for long labels. */
export function BarChart(props: CartesianChartProps) {
    return <CartesianChart {...props} defaultType="bar" />;
}

/** Bars and lines on one or two axes: set `type` (default `bar`) and `axis` on each series. */
export function ComboChart(props: CartesianChartProps) {
    return <CartesianChart {...props} defaultType="bar" />;
}
