import { useId, useMemo, useRef, useState } from 'react';
import { resolveColor, resolveSeries } from '../color';
import { formatCompact, formatPercent } from '../format';
import { computeFlowFunnel, computeFunnel } from '../layout/funnel';
import type { ChartColor, Formatter, MarkRadius, SeriesInput } from '../types';
import { ChartLegend } from './ChartLegend';
import { ChartTooltip, TooltipContent } from './ChartTooltip';
import { cx, MARK_RADII, useElementWidth, useReveal } from './utils';

export interface FunnelStepInput {
    name: string;
    /** The step's count. Defaults to the sum of `breakdown`. */
    value?: number;
    /** Per-series counts at this step, keyed by `series` key. Read by the `flow` variant. */
    breakdown?: Record<string, number>;
    color?: ChartColor;
}

export interface FunnelChartProps {
    /** Steps in order, largest first. */
    data: FunnelStepInput[];
    /**
     * `bars`: centred bars, one row per step (default). `flow`: one column per step with
     * the count on top and a band easing between steps, split by `series` when given.
     */
    variant?: 'bars' | 'flow';
    /** `flow` only: the series each step's `breakdown` holds, stacked top to bottom. */
    series?: SeriesInput[];
    valueFormatter?: Formatter;
    /** Height of each step's bar, px. Default 32. */
    stepHeight?: number;
    /** `flow` only: height of the band area, px. Default 220. */
    height?: number;
    /** Fixed width in px. Default: fill the container. */
    width?: number;
    /** One colour for every step (default slot 1), or per-step colours in `data`. */
    color?: ChartColor;
    /** Show each step's conversion: from the previous step (bars), of the first step (flow). Default on. */
    showConversion?: boolean;
    onStepClick?: (step: { name: string; value: number; index: number }) => void;
    animate?: boolean;
    /** `bars` only: corner radius of the steps, `none` 0, `sm` 2px, `md` 4px, `lg` 8px. Default `md`. */
    radius?: MarkRadius;
    title?: string;
    className?: string;
}

const stepValue = (d: FunnelStepInput) => d.value ?? Object.values(d.breakdown ?? {}).reduce((sum, v) => sum + v, 0);

/** Conversion through ordered steps: visit → signup → activate → pay. */
export function FunnelChart(props: FunnelChartProps) {
    return props.variant === 'flow' ? <FlowFunnel {...props} /> : <BarsFunnel {...props} />;
}

function BarsFunnel({
    data,
    valueFormatter = formatCompact,
    stepHeight = 32,
    width: fixedWidth,
    color,
    showConversion = true,
    onStepClick,
    animate = true,
    radius = 'md',
    title,
    className,
}: FunnelChartProps) {
    const [ref, measured] = useElementWidth<HTMLDivElement>(fixedWidth);
    const [active, setActive] = useState<number | null>(null);
    const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
    const revealed = useReveal(animate);
    // Labels sit beside the bars: the name on the left, the count on the right.
    const labelW = Math.min(160, Math.max(72, measured * 0.22));
    const figuresW = 64;
    const barsW = Math.max(0, measured - labelW - figuresW);
    // Between steps, a tapered band shows the narrowing; with conversion on it is tall enough to carry the rate.
    const gap = showConversion ? 22 : 8;
    const layout = useMemo(
        () =>
            computeFunnel({
                items: data.map((d) => ({
                    name: d.name,
                    value: stepValue(d),
                    color: resolveColor(d.color ?? color, 1),
                })),
                width: barsW,
                stepHeight,
                gap,
            }),
        [data, color, barsW, stepHeight, gap],
    );
    const focus = active !== null ? layout.steps[active] : undefined;
    const height = layout.height;
    const shown = revealed || !animate;

    return (
        <div ref={ref} data-slot="funnel" className={cx('relative w-full min-w-0', className)} style={{ height }}>
            {measured > 0 && (
                <svg
                    width={measured}
                    height={height}
                    aria-hidden="true"
                    className="block overflow-visible"
                    onPointerMove={(e) => {
                        const box = e.currentTarget.getBoundingClientRect();
                        setPointer({ x: e.clientX - box.left, y: e.clientY - box.top });
                    }}
                    onPointerLeave={() => {
                        setActive(null);
                        setPointer(null);
                    }}
                >
                    {layout.steps.map((s) => {
                        const prev = layout.steps[s.index - 1];
                        const mid = s.y + s.height / 2;
                        return (
                            <g
                                key={s.index}
                                opacity={active !== null && active !== s.index ? 0.45 : 1}
                                className={cx(
                                    'transition-opacity duration-fast ease-theme',
                                    onStepClick && 'cursor-pointer',
                                )}
                                onPointerEnter={() => setActive(s.index)}
                                onClick={() => onStepClick?.({ name: s.name, value: s.value, index: s.index })}
                            >
                                {/* A full-width hit area, gaps included, keeps the hover stable across narrow steps. */}
                                <rect
                                    x={0}
                                    y={s.y - (prev ? gap / 2 : 0)}
                                    width={measured}
                                    height={
                                        s.height +
                                        (prev ? gap / 2 : 0) +
                                        (s.index < layout.steps.length - 1 ? gap / 2 : 0)
                                    }
                                    fill="transparent"
                                />
                                {prev && (
                                    <path
                                        d={`M${labelW + prev.x},${prev.y + prev.height}H${labelW + prev.x + prev.width}L${labelW + s.x + s.width},${s.y}H${labelW + s.x}Z`}
                                        style={{ fill: s.color }}
                                        fillOpacity={shown ? 0.14 : 0}
                                        className="transition-[fill-opacity] duration-slow ease-theme"
                                    />
                                )}
                                {prev && showConversion && (
                                    <text
                                        x={labelW + barsW / 2}
                                        y={s.y - gap / 2}
                                        textAnchor="middle"
                                        dominantBaseline="central"
                                        className="fill-muted-foreground text-[11px] font-medium tabular-nums"
                                    >
                                        {formatPercent(s.conversion, 0)}
                                    </text>
                                )}
                                <text
                                    x={labelW - 12}
                                    y={mid}
                                    textAnchor="end"
                                    dominantBaseline="central"
                                    className="fill-foreground text-xs font-medium"
                                >
                                    {s.name}
                                </text>
                                <rect
                                    x={labelW + s.x}
                                    y={s.y}
                                    width={s.width}
                                    height={s.height}
                                    rx={MARK_RADII[radius]}
                                    style={{
                                        fill: s.color,
                                        transformBox: 'fill-box',
                                        transformOrigin: 'center',
                                        transform: shown ? 'scaleX(1)' : 'scaleX(0)',
                                        transition: 'transform var(--duration-slow, 360ms) var(--ease, ease-out)',
                                    }}
                                />
                                <text
                                    x={labelW + barsW + 12}
                                    y={mid}
                                    dominantBaseline="central"
                                    className="fill-foreground text-xs font-semibold tabular-nums"
                                >
                                    {valueFormatter(s.value)}
                                </text>
                            </g>
                        );
                    })}
                </svg>
            )}
            {focus && pointer && (
                <ChartTooltip anchor={pointer} bounds={{ width: measured, height }}>
                    <TooltipContent
                        title={focus.name}
                        items={[
                            { key: 'value', label: 'Count', color: focus.color, value: valueFormatter(focus.value) },
                            { key: 'share', label: 'Of first step', value: formatPercent(focus.share, 1) },
                            ...(focus.index > 0
                                ? [
                                      {
                                          key: 'conv',
                                          label: 'From previous',
                                          value: formatPercent(focus.conversion, 1),
                                      },
                                      {
                                          key: 'drop',
                                          label: 'Drop-off',
                                          value: formatPercent(focus.dropOff, 1),
                                          muted: true,
                                      },
                                  ]
                                : []),
                        ]}
                    />
                </ChartTooltip>
            )}

            <table className="sr-only">
                {/* A caption renders outside the table box, so the table's sr-only clip misses it. */}
                {title && <caption className="sr-only">{title}</caption>}
                <thead>
                    <tr>
                        <th scope="col">Step</th>
                        <th scope="col">Count</th>
                        <th scope="col">From previous</th>
                    </tr>
                </thead>
                <tbody>
                    {layout.steps.map((s) => (
                        <tr key={s.index}>
                            <th scope="row">{s.name}</th>
                            <td>{valueFormatter(s.value)}</td>
                            <td>{s.index > 0 ? formatPercent(s.conversion, 1) : ''}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function FlowFunnel({
    data,
    series,
    valueFormatter = formatCompact,
    height = 220,
    width: fixedWidth,
    color,
    showConversion = true,
    onStepClick,
    animate = true,
    title,
    className,
}: FunnelChartProps) {
    const [ref, measured] = useElementWidth<HTMLDivElement>(fixedWidth);
    const boxRef = useRef<HTMLDivElement>(null);
    const [activeSeries, setActiveSeries] = useState<string | null>(null);
    const [hover, setHover] = useState<{ column: number; x: number; y: number } | null>(null);
    const revealed = useReveal(animate);
    const id = useId();
    // Without series the flow is one band of each step's total.
    const split = series !== undefined && series.length > 0;
    const resolved = useMemo(
        () => resolveSeries(split ? series : [{ key: 'value', label: 'Count', color: color ?? 1 }], 'area'),
        [split, series, color],
    );
    const layout = useMemo(
        () =>
            computeFlowFunnel({
                steps: data.map((d) => ({
                    name: d.name,
                    values: split ? resolved.map((s) => d.breakdown?.[s.key] ?? 0) : [stepValue(d)],
                })),
                series: resolved,
                width: measured,
                height,
            }),
        [data, split, resolved, measured, height],
    );
    const focus = hover ? layout.columns[hover.column] : undefined;
    const focusRow = focus ? data[focus.index] : undefined;

    return (
        <div ref={ref} data-slot="funnel" data-variant="flow" className={cx('w-full min-w-0 space-y-3', className)}>
            <div
                ref={boxRef}
                className={cx('relative', onStepClick && 'cursor-pointer')}
                onPointerMove={(e) => {
                    const box = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - box.left;
                    const n = layout.columns.length;
                    const column = Math.min(n - 1, Math.max(0, Math.floor((x / box.width) * n)));
                    setHover({ column, x, y: e.clientY - box.top });
                }}
                onPointerLeave={() => setHover(null)}
                onClick={() => focus && onStepClick?.({ name: focus.name, value: focus.value, index: focus.index })}
            >
                <div
                    className="grid"
                    style={{ gridTemplateColumns: `repeat(${Math.max(1, data.length)}, minmax(0, 1fr))` }}
                >
                    {layout.columns.map((c) => (
                        <div
                            key={c.index}
                            className={cx(
                                'min-w-0 px-3 pb-4 transition-opacity duration-fast ease-theme',
                                hover && hover.column !== c.index && 'opacity-60',
                            )}
                        >
                            <div className="truncate text-xl font-semibold tabular-nums sm:text-2xl">
                                {valueFormatter(c.value)}
                            </div>
                            <div className="truncate text-xs font-medium text-muted-foreground">{c.name}</div>
                            {showConversion && c.index > 0 && (
                                <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                                    {formatPercent(c.share, 1)}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                {measured > 0 && (
                    <svg width={measured} height={height} aria-hidden="true" className="block">
                        <defs>
                            {layout.bands.map((b, i) => (
                                <linearGradient key={b.key} id={`${id}-${i}`} x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" style={{ stopColor: b.color, stopOpacity: 0.45 }} />
                                    <stop offset="100%" style={{ stopColor: b.color }} />
                                </linearGradient>
                            ))}
                        </defs>
                        <g
                            style={{
                                transformOrigin: 'left',
                                transform: revealed || !animate ? 'scaleX(1)' : 'scaleX(0)',
                                transition: 'transform var(--duration-slow, 360ms) var(--ease, ease-out)',
                            }}
                        >
                            {layout.bands.map((b, i) => (
                                <path
                                    key={b.key}
                                    d={b.path}
                                    fill={`url(#${id}-${i})`}
                                    opacity={activeSeries !== null && activeSeries !== b.key ? 0.3 : 1}
                                    className="transition-opacity duration-fast ease-theme"
                                />
                            ))}
                        </g>
                    </svg>
                )}
                {/* Column rules run through the figures and the bands. */}
                {layout.columns.slice(1).map((c) => (
                    <div
                        key={c.index}
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 w-px bg-chart-grid"
                        style={{ left: c.x }}
                    />
                ))}
                {focus && focusRow && hover && (
                    <ChartTooltip
                        anchor={hover}
                        bounds={{ width: measured, height: boxRef.current?.offsetHeight ?? height }}
                    >
                        <TooltipContent
                            title={focus.name}
                            items={[
                                ...(split
                                    ? resolved.map((s) => ({
                                          key: s.key,
                                          label: s.label,
                                          color: s.color,
                                          value: valueFormatter(focusRow.breakdown?.[s.key] ?? 0),
                                      }))
                                    : []),
                                ...(focus.index > 0
                                    ? [
                                          {
                                              key: 'conv',
                                              label: 'From previous',
                                              value: formatPercent(focus.conversion, 1),
                                              muted: true,
                                          },
                                      ]
                                    : []),
                            ]}
                            footer={{ key: 'total', label: 'Total', value: valueFormatter(focus.value) }}
                        />
                    </ChartTooltip>
                )}
            </div>

            {split && (
                <ChartLegend
                    className="justify-center"
                    items={resolved.map((s) => ({ key: s.key, label: s.label, color: s.color, shape: 'dot' as const }))}
                    onHover={setActiveSeries}
                />
            )}

            <table className="sr-only">
                {/* A caption renders outside the table box, so the table's sr-only clip misses it. */}
                {title && <caption className="sr-only">{title}</caption>}
                <thead>
                    <tr>
                        <th scope="col">Step</th>
                        {split &&
                            resolved.map((s) => (
                                <th key={s.key} scope="col">
                                    {s.label}
                                </th>
                            ))}
                        <th scope="col">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {layout.columns.map((c) => (
                        <tr key={c.index}>
                            <th scope="row">{c.name}</th>
                            {split &&
                                resolved.map((s) => (
                                    <td key={s.key}>{valueFormatter(data[c.index]?.breakdown?.[s.key] ?? 0)}</td>
                                ))}
                            <td>{valueFormatter(c.value)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
