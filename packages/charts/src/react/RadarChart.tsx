import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { CHART_CHROME, resolveSeries } from '../color';
import { toNumber } from '../data';
import { formatCompact } from '../format';
import { computeRadar, radarAxisAt } from '../layout/radar';
import { spreadIndices } from '../sample';
import type { ChartRow, Formatter, SeriesInput } from '../types';
import { ChartLegend } from './ChartLegend';
import { ChartSkeleton } from './ChartSkeleton';
import { ChartTooltip, TooltipContent } from './ChartTooltip';
import { cx, SR_ROWS, srCaption, TICK_CLASS, useElementWidth, useReveal } from './utils';

export interface RadarChartProps {
    /** One row per axis (spoke). */
    data: ChartRow[];
    /** Column naming each axis. */
    index: string;
    /** Columns to draw as outlines, in slot order. */
    series: SeriesInput[];
    /** Default 300. */
    height?: number;
    /** Fixed width in px. Default: fill the container. */
    width?: number;
    /** Fixed outer value (a score out of 100). Default: the next round tick above the data. */
    maxValue?: number;
    /** Rings, roughly. Default 4. */
    levels?: number;
    /** `polygon` rings follow the spokes; `circle` rings are round. Default `polygon`. */
    grid?: 'polygon' | 'circle';
    valueFormatter?: Formatter;
    indexFormatter?: (value: string) => string;
    /** Fill under each outline. Default on. */
    fill?: boolean;
    /** Default: on when there is more than one series. */
    showLegend?: boolean;
    showTooltip?: boolean;
    onAxisClick?: (payload: { row: ChartRow; index: number }) => void;
    animate?: boolean;
    loading?: boolean;
    title?: string;
    emptyText?: ReactNode;
    className?: string;
}

const identity = (v: string) => v;
const FADE = 0.2;

/** Several measures of a few things at once: plan features, a service's health, a team's skills. */
export function RadarChart({
    data,
    index,
    series,
    height = 300,
    width: fixedWidth,
    maxValue,
    levels,
    grid = 'polygon',
    valueFormatter = formatCompact,
    indexFormatter = identity,
    fill = true,
    showLegend,
    showTooltip = true,
    onAxisClick,
    animate = true,
    loading = false,
    title,
    emptyText = 'No data',
    className,
}: RadarChartProps) {
    const [ref, measured] = useElementWidth<HTMLDivElement>(fixedWidth);
    const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
    const [emphasis, setEmphasis] = useState<string | null>(null);
    const [active, setActive] = useState<number | null>(null);
    const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
    const revealed = useReveal(animate);

    const resolved = useMemo(() => resolveSeries(series, 'area'), [series]);
    const visible = useMemo(() => resolved.filter((s) => !hidden.has(s.key)), [resolved, hidden]);
    const layout = useMemo(
        () =>
            measured > 0
                ? computeRadar({
                      data,
                      index,
                      series: visible,
                      width: measured,
                      height,
                      maxValue,
                      levels,
                      grid,
                      valueFormatter,
                      indexFormatter,
                  })
                : null,
        [data, index, visible, measured, height, maxValue, levels, grid, valueFormatter, indexFormatter],
    );
    const empty = data.length === 0;
    const legend = showLegend ?? resolved.length > 1;
    const many = visible.length > 1;

    // Grid and outlines redraw with the layout and the legend emphasis, not with hover.
    const body = useMemo(() => {
        if (!layout) return null;
        const { cx: ox, cy: oy } = layout;
        return (
            <>
                <g data-slot="chart-grid">
                    {layout.rings.map((ring) => (
                        <path key={ring.value} d={ring.path} fill="none" stroke={CHART_CHROME.grid} strokeWidth={1} />
                    ))}
                    {layout.sparse &&
                        layout.axes.map((a) => (
                            <line
                                key={a.index}
                                x1={ox}
                                y1={oy}
                                x2={a.x}
                                y2={a.y}
                                stroke={CHART_CHROME.grid}
                                strokeWidth={1}
                            />
                        ))}
                    {layout.rings.map((ring) => (
                        <text
                            key={`l-${ring.value}`}
                            x={ox + 4}
                            y={oy - ring.radius + 7}
                            dominantBaseline="middle"
                            className={TICK_CLASS}
                        >
                            {ring.label}
                        </text>
                    ))}
                </g>
                <g
                    data-slot="chart-marks"
                    style={{
                        transformBox: 'view-box',
                        transformOrigin: `${ox}px ${oy}px`,
                        transform: revealed || !animate ? 'scale(1)' : 'scale(0.4)',
                        opacity: revealed || !animate ? 1 : 0,
                        transition:
                            'transform var(--duration-slow, 360ms) var(--ease-enter, ease-out), opacity var(--duration-slow, 360ms) ease',
                    }}
                >
                    {layout.series.map((s) => (
                        <g
                            key={s.key}
                            opacity={emphasis !== null && emphasis !== s.key ? FADE : 1}
                            className="transition-opacity duration-fast ease-theme"
                        >
                            <path
                                d={s.path}
                                style={{ fill: fill ? s.color : 'none', stroke: s.color }}
                                fillOpacity={many ? 0.12 : 0.2}
                                strokeWidth={2}
                                strokeLinejoin="round"
                            />
                            {layout.sparse &&
                                s.points.map((p, i) =>
                                    s.values[i] === null ? null : (
                                        <circle key={i} cx={p.x} cy={p.y} r={2.5} style={{ fill: s.color }} />
                                    ),
                                )}
                        </g>
                    ))}
                </g>
            </>
        );
    }, [layout, emphasis, fill, many, revealed, animate]);

    const toggle = (key: string) =>
        setHidden((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else if (next.size < resolved.length - 1) next.add(key);
            return next;
        });

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        const n = data.length;
        if (!n) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            setPointer(null);
            setActive((a) => ((a ?? -1) + 1) % n);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            setPointer(null);
            setActive((a) => ((a ?? n) - 1 + n) % n);
        } else if (e.key === 'Escape') setActive(null);
        else if ((e.key === 'Enter' || e.key === ' ') && active !== null && onAxisClick) {
            e.preventDefault();
            onAxisClick({ row: data[active] as ChartRow, index: active });
        }
    };

    const table = useMemo(() => {
        const rows = spreadIndices(data.length, SR_ROWS);
        const caption = srCaption(title, rows.length, data.length);
        return (
            <table className="sr-only">
                {caption && <caption className="sr-only">{caption}</caption>}
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
                    {rows.map((i) => {
                        const row = data[i] as ChartRow;
                        return (
                            <tr key={i}>
                                <th scope="row">{indexFormatter(String(row[index] ?? ''))}</th>
                                {resolved.map((s) => {
                                    const v = toNumber(row[s.key]);
                                    return <td key={s.key}>{v === null ? '' : valueFormatter(v)}</td>;
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        );
    }, [data, index, resolved, indexFormatter, valueFormatter, title]);

    const axis = layout && active !== null ? layout.axes[active] : undefined;
    const activeRow = active !== null ? data[active] : undefined;

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
                ) : layout ? (
                    <svg
                        width={measured}
                        height={height}
                        aria-hidden="true"
                        className={cx('block select-none overflow-visible', onAxisClick && 'cursor-pointer')}
                        onPointerMove={(e) => {
                            const box = e.currentTarget.getBoundingClientRect();
                            const px = e.clientX - box.left;
                            const py = e.clientY - box.top;
                            // Only near the chart: the corners of a wide box are not on any spoke.
                            const near = Math.hypot(px - layout.cx, py - layout.cy) <= layout.radius + 24;
                            setActive(near ? radarAxisAt(layout, px, py) : null);
                            setPointer({ x: px, y: py });
                        }}
                        onPointerLeave={() => {
                            setActive(null);
                            setPointer(null);
                        }}
                        onClick={() =>
                            active !== null && onAxisClick?.({ row: data[active] as ChartRow, index: active })
                        }
                    >
                        {axis && (
                            <line
                                x1={layout.cx}
                                y1={layout.cy}
                                x2={axis.x}
                                y2={axis.y}
                                stroke={CHART_CHROME.axis}
                                strokeWidth={1}
                            />
                        )}
                        {body}
                        {layout.axes.map((a) =>
                            a.showLabel || a.index === active ? (
                                <text
                                    key={a.index}
                                    x={a.labelX}
                                    y={a.labelY}
                                    textAnchor={a.anchor}
                                    dominantBaseline="middle"
                                    className={cx(
                                        'font-mono text-[10px]',
                                        a.index === active ? 'fill-foreground' : 'fill-chart-label',
                                    )}
                                >
                                    {a.label || indexFormatter(String(data[a.index]?.[index] ?? ''))}
                                </text>
                            ) : null,
                        )}
                        {axis &&
                            layout.series.map((s) => {
                                const p = s.points[axis.index];
                                return p && s.values[axis.index] !== null ? (
                                    <circle
                                        key={s.key}
                                        cx={p.x}
                                        cy={p.y}
                                        r={4}
                                        strokeWidth={2}
                                        className="pointer-events-none stroke-background"
                                        style={{ fill: s.color }}
                                    />
                                ) : null;
                            })}
                    </svg>
                ) : null}

                {showTooltip && axis && activeRow && layout && (
                    <ChartTooltip anchor={pointer ?? { x: axis.x, y: axis.y }} bounds={{ width: measured, height }}>
                        <TooltipContent
                            title={indexFormatter(String(activeRow[index] ?? ''))}
                            items={layout.series.map((s) => {
                                const v = toNumber(activeRow[s.key]);
                                return {
                                    key: s.key,
                                    label: s.label,
                                    color: s.color,
                                    value: v === null ? '—' : valueFormatter(v),
                                };
                            })}
                        />
                    </ChartTooltip>
                )}
            </div>
            {legend && !empty && !loading && (
                <ChartLegend
                    className="justify-center"
                    items={resolved.map((s) => ({ key: s.key, label: s.label, color: s.color }))}
                    hidden={hidden}
                    onToggle={toggle}
                    onHover={setEmphasis}
                />
            )}
            {table}
        </div>
    );
}
