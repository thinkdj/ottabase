import { useId, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { CHART_CHROME, CHART_SLOTS, resolveColor } from '../color';
import { toNumber } from '../data';
import { formatCompact } from '../format';
import { computeWaterfall, type WaterfallStep } from '../layout/waterfall';
import { nearestIndex } from '../scale';
import { spreadIndices } from '../sample';
import type { ChartColor, ChartRow, Formatter, MarkRadius } from '../types';
import { Axes } from './cartesian/Axes';
import type { Frame } from './cartesian/frame';
import { ChartLegend } from './ChartLegend';
import { ChartSkeleton } from './ChartSkeleton';
import { ChartTooltip, TooltipContent } from './ChartTooltip';
import { cx, MARK_RADII, SR_ROWS, srCaption, useElementWidth, useReveal, VALUE_LABEL_CLASS } from './utils';

export interface WaterfallChartProps {
    /** One row per step: a change, or (with `totalKey`) a subtotal. */
    data: ChartRow[];
    /** Column naming each step. */
    index: string;
    /** Column holding the change. Default `value`. */
    category?: string;
    /** Column that, when truthy, makes the row a total bar; a leading one with a value is the opening balance. */
    totalKey?: string;
    /** Append a final total bar. Default true. */
    showTotal?: boolean;
    /** Default `Total`. */
    totalLabel?: string;
    /** Default: `success` up, `danger` down, the neutral slot for totals. A cost waterfall swaps the first two. */
    colors?: { increase?: ChartColor; decrease?: ChartColor; total?: ChartColor };
    /** Default 240. */
    height?: number;
    /** Fixed width in px. Default: fill the container. */
    width?: number;
    valueFormatter?: Formatter;
    indexFormatter?: (value: string) => string;
    /** Change labels on the bars, where they fit. Default on. */
    showValues?: boolean;
    showLegend?: boolean;
    showGrid?: boolean;
    showXAxis?: boolean;
    showYAxis?: boolean;
    xTitle?: string;
    yTitle?: string;
    yTickCount?: number;
    onStepClick?: (step: WaterfallStep, rows: ChartRow[]) => void;
    /** Corner radius of the bars: `none` 0, `sm` 2px, `md` 4px, `lg` 8px. Default `sm`. */
    radius?: MarkRadius;
    animate?: boolean;
    loading?: boolean;
    title?: string;
    emptyText?: ReactNode;
    className?: string;
}

const identity = (v: string) => v;
const signed = (format: Formatter, v: number) => (v > 0 ? `+${format(v)}` : v < 0 ? `−${format(-v)}` : format(0));

/** How a start becomes an end: each change floats from the running total; totals stand on zero. */
export function WaterfallChart({
    data,
    index,
    category = 'value',
    totalKey,
    showTotal = true,
    totalLabel = 'Total',
    colors,
    height = 240,
    width: fixedWidth,
    valueFormatter = formatCompact,
    indexFormatter = identity,
    showValues = true,
    showLegend = true,
    showGrid = true,
    showXAxis = true,
    showYAxis = true,
    xTitle,
    yTitle,
    yTickCount,
    onStepClick,
    radius = 'sm',
    animate = true,
    loading = false,
    title,
    emptyText = 'No data',
    className,
}: WaterfallChartProps) {
    const [ref, measured] = useElementWidth<HTMLDivElement>(fixedWidth);
    const [active, setActive] = useState<number | null>(null);
    const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
    const id = useId();
    const revealed = useReveal(animate);
    const { increase, decrease, total } = colors ?? {};
    const palette = useMemo(
        () => ({
            increase: resolveColor(increase ?? 'success', 1),
            decrease: resolveColor(decrease ?? 'danger', 1),
            total: resolveColor(total, CHART_SLOTS),
        }),
        [increase, decrease, total],
    );

    const layout = useMemo(
        () =>
            measured > 0
                ? computeWaterfall({
                      data,
                      index,
                      category,
                      totalKey,
                      showTotal,
                      totalLabel,
                      width: measured,
                      height,
                      valueFormatter,
                      indexFormatter,
                      yTickCount,
                      showXAxis,
                      showYAxis,
                      xTitle,
                      yTitle,
                  })
                : null,
        [
            data,
            index,
            category,
            totalKey,
            showTotal,
            totalLabel,
            measured,
            height,
            valueFormatter,
            indexFormatter,
            yTickCount,
            showXAxis,
            showYAxis,
            xTitle,
            yTitle,
        ],
    );
    const frame: Frame<NonNullable<typeof layout>> | null = useMemo(
        () => (layout ? { layout, width: measured, height, transposed: false } : null),
        [layout, measured, height],
    );
    const empty = data.length === 0;
    const focus = layout && active !== null ? layout.steps[active] : undefined;
    const rx = MARK_RADII[radius];

    const bars = useMemo(() => {
        if (!layout) return null;
        const many = layout.steps.length > 400;
        return layout.steps.map((s) => (
            <g key={s.index}>
                {s.range && (
                    <line
                        x1={s.x + s.width / 2}
                        x2={s.x + s.width / 2}
                        y1={s.range[0]}
                        y2={s.range[1]}
                        style={{ stroke: palette[s.kind] }}
                        strokeWidth={1}
                        opacity={0.6}
                    />
                )}
                <rect
                    x={s.x}
                    y={s.y}
                    width={s.width}
                    height={s.height}
                    rx={many ? 0 : rx}
                    style={{ fill: palette[s.kind] }}
                />
            </g>
        ));
    }, [layout, rx, palette]);

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (!layout?.steps.length) return;
        const last = layout.steps.length - 1;
        const moves: Record<string, number> = {
            ArrowRight: Math.min((active ?? -1) + 1, last),
            ArrowLeft: Math.max((active ?? last + 1) - 1, 0),
            Home: 0,
            End: last,
        };
        if (e.key in moves) {
            e.preventDefault();
            setPointer(null);
            setActive(moves[e.key] as number);
        } else if (e.key === 'Escape') setActive(null);
        else if ((e.key === 'Enter' || e.key === ' ') && focus && onStepClick) {
            e.preventDefault();
            onStepClick(focus, data.slice(focus.rows[0], focus.rows[1] + 1));
        }
    };

    const table = useMemo(() => {
        const rows = spreadIndices(data.length, SR_ROWS);
        const caption = srCaption(title, rows.length, data.length);
        // The same running total as the layout, row by row, without its bucketing.
        let running = 0;
        let changed = false;
        const totals = data.map((row) => {
            const v = toNumber(row[category]);
            if (!(totalKey && row[totalKey])) {
                running += v ?? 0;
                changed = true;
            } else if (!changed && v !== null) running = v;
            return running;
        });
        return (
            <table className="sr-only">
                {caption && <caption className="sr-only">{caption}</caption>}
                <thead>
                    <tr>
                        <th scope="col">{index}</th>
                        <th scope="col">Change</th>
                        <th scope="col">Running total</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((i) => {
                        const row = data[i] as ChartRow;
                        const isTotal = Boolean(totalKey && row[totalKey]);
                        return (
                            <tr key={i}>
                                <th scope="row">{indexFormatter(String(row[index] ?? ''))}</th>
                                <td>{isTotal ? '' : signed(valueFormatter, toNumber(row[category]) ?? 0)}</td>
                                <td>{valueFormatter(totals[i] ?? 0)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        );
    }, [data, index, category, totalKey, indexFormatter, valueFormatter, title]);

    const anchor = pointer ?? (focus ? { x: focus.x + focus.width / 2, y: focus.y } : { x: 0, y: 0 });

    return (
        <div data-slot="chart" className={cx('flex w-full min-w-0 flex-col gap-3', className)}>
            <div
                ref={ref}
                role="group"
                aria-roledescription="chart"
                aria-label={title}
                aria-busy={loading || undefined}
                tabIndex={empty || loading ? undefined : 0}
                onKeyDown={onKeyDown}
                onFocus={() => setActive((a) => a ?? 0)}
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
                ) : layout && frame ? (
                    <svg
                        width={measured}
                        height={height}
                        aria-hidden="true"
                        className={cx('block select-none overflow-visible', onStepClick && 'cursor-pointer')}
                        onPointerMove={(e) => {
                            const box = e.currentTarget.getBoundingClientRect();
                            const x = e.clientX - box.left;
                            setPointer({ x, y: e.clientY - box.top });
                            setActive(nearestIndex(layout.x.centers, x));
                        }}
                        onPointerLeave={() => {
                            setActive(null);
                            setPointer(null);
                        }}
                        onClick={() => focus && onStepClick?.(focus, data.slice(focus.rows[0], focus.rows[1] + 1))}
                    >
                        {focus && (
                            <rect
                                x={(layout.x.centers[focus.index] ?? 0) - layout.x.step / 2}
                                y={layout.plot.y}
                                width={Math.max(layout.x.step, 1)}
                                height={layout.plot.height}
                                className="fill-muted"
                                opacity={0.6}
                            />
                        )}
                        <Axes
                            frame={frame}
                            showGrid={showGrid}
                            showXAxis={showXAxis}
                            showYAxis={showYAxis}
                            xTitle={xTitle}
                            yTitle={yTitle}
                            categoryTicks={[]}
                        />
                        <defs>
                            <clipPath id={`${id}-clip`}>
                                <rect
                                    x={layout.plot.x - 3}
                                    y={layout.plot.y - 3}
                                    width={layout.plot.width + 6}
                                    height={layout.plot.height + 6}
                                    style={
                                        animate
                                            ? {
                                                  transformBox: 'fill-box',
                                                  transformOrigin: 'left',
                                                  transform: revealed ? 'scale(1, 1)' : 'scale(0, 1)',
                                                  transition:
                                                      'transform var(--duration-slow, 360ms) var(--ease, ease-out)',
                                              }
                                            : undefined
                                    }
                                />
                            </clipPath>
                        </defs>
                        <g clipPath={`url(#${id}-clip)`} data-slot="chart-marks">
                            {layout.connectors.map((c, i) => (
                                <line
                                    key={i}
                                    x1={c.x1}
                                    x2={c.x2}
                                    y1={c.y}
                                    y2={c.y}
                                    stroke={CHART_CHROME.axis}
                                    strokeDasharray="2 2"
                                    shapeRendering="crispEdges"
                                />
                            ))}
                            {bars}
                        </g>
                        {showValues && layout.x.bandwidth >= 24 && (
                            <g
                                data-slot="chart-values"
                                opacity={revealed || !animate ? 1 : 0}
                                className="transition-opacity duration-slow ease-theme"
                            >
                                {layout.steps.map((s) => (
                                    <text
                                        key={s.index}
                                        x={s.x + s.width / 2}
                                        y={s.kind === 'decrease' ? s.y + s.height + 12 : s.y - 4}
                                        textAnchor="middle"
                                        className={VALUE_LABEL_CLASS}
                                    >
                                        {s.kind === 'total' ? valueFormatter(s.value) : signed(valueFormatter, s.value)}
                                    </text>
                                ))}
                            </g>
                        )}
                    </svg>
                ) : null}

                {focus && layout && (
                    <ChartTooltip anchor={anchor} bounds={{ width: measured, height }}>
                        <TooltipContent
                            title={focus.label}
                            items={[
                                {
                                    key: 'change',
                                    label:
                                        focus.kind === 'total'
                                            ? 'Total'
                                            : focus.rows[1] > focus.rows[0]
                                              ? `Net of ${focus.rows[1] - focus.rows[0] + 1} steps`
                                              : 'Change',
                                    color: palette[focus.kind],
                                    value:
                                        focus.kind === 'total'
                                            ? valueFormatter(focus.value)
                                            : signed(valueFormatter, focus.value),
                                },
                            ]}
                            footer={
                                focus.kind === 'total'
                                    ? undefined
                                    : { key: 'running', label: 'Running total', value: valueFormatter(focus.end) }
                            }
                        />
                    </ChartTooltip>
                )}
            </div>
            {showLegend && !empty && !loading && (
                <ChartLegend
                    items={(['increase', 'decrease', 'total'] as const)
                        .filter((kind) => layout?.steps.some((s) => s.kind === kind))
                        .map((kind) => ({
                            key: kind,
                            label: kind === 'increase' ? 'Increase' : kind === 'decrease' ? 'Decrease' : 'Total',
                            color: palette[kind],
                        }))}
                />
            )}
            {table}
        </div>
    );
}
