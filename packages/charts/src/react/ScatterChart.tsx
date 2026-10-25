import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { CHART_CHROME, CHART_SLOTS, resolveColor } from '../color';
import { toNumber } from '../data';
import { formatCompact } from '../format';
import { computeScatter, scatterIndex, type ScatterGroup, type ScatterPoint } from '../layout/scatter';
import { spreadIndices } from '../sample';
import type { ChartColor, ChartRow, Formatter } from '../types';
import { Axes } from './cartesian/Axes';
import type { Frame } from './cartesian/frame';
import { ChartLegend } from './ChartLegend';
import { ChartSkeleton } from './ChartSkeleton';
import { ChartTooltip, TooltipContent, type TooltipItem } from './ChartTooltip';
import { cx, SR_ROWS, srCaption, useElementWidth, useReveal } from './utils';

export interface ScatterGroupConfig {
    /** The value in the `groupBy` column. */
    key: string;
    label?: string;
    color?: ChartColor;
}

export interface ScatterPointPayload {
    row: ChartRow;
    /** Row index in `data`. */
    index: number;
}

export interface ScatterChartProps {
    data: ChartRow[];
    /** Column for the horizontal position. */
    x: string;
    /** Column for the vertical position. */
    y: string;
    /** Column whose value sets each bubble's area: a bubble chart. */
    size?: string;
    /** Column that splits points into coloured groups. */
    groupBy?: string;
    /**
     * Labels and colours for the groups, in slot order. Default: groups in first-seen
     * order; past eight, the least common fold into "Other" on the neutral slot.
     */
    groups?: ScatterGroupConfig[];
    /** Column naming each point, for the tooltip title (an account, a route). */
    label?: string;
    /** Default 280. */
    height?: number;
    /** Fixed width in px. Default: fill the container. */
    width?: number;
    xFormatter?: Formatter;
    valueFormatter?: Formatter;
    sizeFormatter?: Formatter;
    /** Axis titles; also the tooltip's row labels. Default: the column names. */
    xTitle?: string;
    yTitle?: string;
    sizeTitle?: string;
    xMinValue?: number;
    xMaxValue?: number;
    minValue?: number;
    maxValue?: number;
    /** Dot radius of a plain scatter, px. Default 3.5. */
    pointRadius?: number;
    /** Smallest and largest bubble radius, px. Default [4, 22]. */
    sizeRange?: [number, number];
    /** Default: on when there is more than one group. */
    showLegend?: boolean;
    showGrid?: boolean;
    showXAxis?: boolean;
    showYAxis?: boolean;
    onPointClick?: (payload: ScatterPointPayload) => void;
    /** Replace the tooltip body. */
    renderTooltip?: (point: ScatterPoint & { data: ChartRow }) => ReactNode;
    animate?: boolean;
    loading?: boolean;
    title?: string;
    emptyText?: ReactNode;
    className?: string;
}

const OTHER = '\u0000other';
const FADE = 0.2;

/** How two measures relate: latency against payload, seats against revenue. Add `size` for bubbles. */
export function ScatterChart({
    data,
    x,
    y,
    size,
    groupBy,
    groups: groupsProp,
    label,
    height = 280,
    width: fixedWidth,
    xFormatter = formatCompact,
    valueFormatter = formatCompact,
    sizeFormatter = formatCompact,
    xTitle,
    yTitle,
    sizeTitle,
    xMinValue,
    xMaxValue,
    minValue,
    maxValue,
    pointRadius,
    sizeRange,
    showLegend,
    showGrid = true,
    showXAxis = true,
    showYAxis = true,
    onPointClick,
    renderTooltip,
    animate = true,
    loading = false,
    title,
    emptyText = 'No data',
    className,
}: ScatterChartProps) {
    const [ref, measured] = useElementWidth<HTMLDivElement>(fixedWidth);
    const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
    const [emphasis, setEmphasis] = useState<string | null>(null);
    const [active, setActive] = useState<number | null>(null);
    const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
    const revealed = useReveal(animate);

    // Groups: given, or discovered; past the slot count the rarest fold into "Other".
    const { groups, groupOf } = useMemo(() => {
        const keyOf = (row: ChartRow) => (groupBy ? String(row[groupBy] ?? '') : '');
        if (groupsProp) {
            const listed = groupsProp.map((g, i) => ({
                key: g.key,
                label: g.label ?? g.key,
                color: resolveColor(g.color, i + 1),
            }));
            return { groups: listed, groupOf: keyOf };
        }
        const counts = new Map<string, number>();
        for (const row of data) {
            const k = keyOf(row);
            counts.set(k, (counts.get(k) ?? 0) + 1);
        }
        let keys = [...counts.keys()];
        let fold: Set<string> | null = null;
        if (keys.length > CHART_SLOTS) {
            const top = new Set(
                [...counts.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, CHART_SLOTS - 1)
                    .map(([k]) => k),
            );
            fold = top;
            keys = [...keys.filter((k) => top.has(k)), OTHER];
        }
        const list: ScatterGroup[] = keys.map((k, i) => ({
            key: k,
            label: k === OTHER ? 'Other' : k || y,
            color: resolveColor(undefined, k === OTHER ? CHART_SLOTS : i + 1),
        }));
        const kept = fold;
        return { groups: list, groupOf: kept ? (row: ChartRow) => (kept.has(keyOf(row)) ? keyOf(row) : OTHER) : keyOf };
    }, [data, groupBy, groupsProp, y]);
    const visible = useMemo(() => groups.filter((g) => !hidden.has(g.key)), [groups, hidden]);

    const layout = useMemo(
        () =>
            measured > 0
                ? computeScatter({
                      data,
                      x,
                      y,
                      size,
                      groupOf,
                      groups: visible,
                      width: measured,
                      height,
                      pointRadius,
                      sizeRange,
                      xMinValue,
                      xMaxValue,
                      minValue,
                      maxValue,
                      xFormatter,
                      valueFormatter,
                      showXAxis,
                      showYAxis,
                      xTitle,
                      yTitle,
                  })
                : null,
        [
            data,
            x,
            y,
            size,
            groupOf,
            visible,
            measured,
            height,
            pointRadius,
            sizeRange,
            xMinValue,
            xMaxValue,
            minValue,
            maxValue,
            xFormatter,
            valueFormatter,
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
    const index = useMemo(() => (layout ? scatterIndex(layout.points) : null), [layout]);
    // Keyboard order: left to right.
    const order = useMemo(
        () => (layout ? layout.points.map((_, i) => i).sort((a, b) => layout.points[a]!.x - layout.points[b]!.x) : []),
        [layout],
    );
    const focus = layout && active !== null ? layout.points[active] : undefined;
    const empty = data.length === 0;
    const legend = showLegend ?? groups.length > 1;

    // The marks change with the layout and the legend emphasis, never with hover.
    const marks = useMemo(
        () =>
            layout?.series.map((s) => (
                <path
                    key={s.key}
                    d={s.path}
                    style={{ fill: s.color, stroke: size ? s.color : undefined }}
                    fillOpacity={size ? 0.5 : 0.8}
                    strokeWidth={size ? 1 : 0}
                    opacity={emphasis !== null && emphasis !== s.key ? FADE : 1}
                    className="transition-opacity duration-fast ease-theme"
                />
            )),
        [layout, size, emphasis],
    );

    const toggle = (key: string) =>
        setHidden((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else if (next.size < groups.length - 1) next.add(key);
            return next;
        });

    const click = () => {
        if (!focus) return;
        onPointClick?.({ row: data[focus.row] as ChartRow, index: focus.row });
    };

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (!order.length) return;
        const at = active === null ? -1 : order.indexOf(active);
        const moves: Record<string, number> = {
            ArrowRight: Math.min(at + 1, order.length - 1),
            ArrowLeft: Math.max((at < 0 ? order.length : at) - 1, 0),
            Home: 0,
            End: order.length - 1,
        };
        if (e.key in moves) {
            e.preventDefault();
            setPointer(null);
            setActive(order[moves[e.key] as number] ?? null);
        } else if (e.key === 'Escape') setActive(null);
        else if ((e.key === 'Enter' || e.key === ' ') && focus) {
            e.preventDefault();
            click();
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
                        {label && <th scope="col">{label}</th>}
                        {groupBy && <th scope="col">{groupBy}</th>}
                        <th scope="col">{xTitle ?? x}</th>
                        <th scope="col">{yTitle ?? y}</th>
                        {size && <th scope="col">{sizeTitle ?? size}</th>}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((i) => {
                        const row = data[i] as ChartRow;
                        const cell = (v: unknown, format: Formatter) => {
                            const n = toNumber(v);
                            return n === null ? '' : format(n);
                        };
                        return (
                            <tr key={i}>
                                {label && <th scope="row">{String(row[label] ?? '')}</th>}
                                {groupBy && <td>{String(row[groupBy] ?? '')}</td>}
                                <td>{cell(row[x], xFormatter)}</td>
                                <td>{cell(row[y], valueFormatter)}</td>
                                {size && <td>{cell(row[size], sizeFormatter)}</td>}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        );
    }, [data, label, groupBy, x, y, size, xTitle, yTitle, sizeTitle, xFormatter, valueFormatter, sizeFormatter, title]);

    const group = focus && layout ? layout.series[focus.group] : undefined;

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
                onFocus={() => setActive((a) => a ?? order[0] ?? null)}
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
                        className={cx('block select-none overflow-visible', onPointClick && focus && 'cursor-pointer')}
                        onPointerMove={(e) => {
                            const box = e.currentTarget.getBoundingClientRect();
                            const px = e.clientX - box.left;
                            const py = e.clientY - box.top;
                            const hit = index?.nearest(px, py) ?? -1;
                            setActive(hit >= 0 ? hit : null);
                            setPointer({ x: px, y: py });
                        }}
                        onPointerLeave={() => {
                            setActive(null);
                            setPointer(null);
                        }}
                        onClick={click}
                    >
                        <Axes
                            frame={frame}
                            showGrid={showGrid}
                            showXAxis={showXAxis}
                            showYAxis={showYAxis}
                            xTitle={xTitle}
                            yTitle={yTitle}
                            categoryTicks={[]}
                        />
                        {focus && (
                            <g data-slot="chart-cursor" className="pointer-events-none">
                                <line
                                    x1={layout.plot.x}
                                    x2={focus.x}
                                    y1={focus.y}
                                    y2={focus.y}
                                    stroke={CHART_CHROME.axis}
                                    strokeDasharray="2 2"
                                />
                                <line
                                    x1={focus.x}
                                    x2={focus.x}
                                    y1={focus.y}
                                    y2={layout.plot.y + layout.plot.height}
                                    stroke={CHART_CHROME.axis}
                                    strokeDasharray="2 2"
                                />
                            </g>
                        )}
                        <g
                            data-slot="chart-marks"
                            style={{
                                opacity: revealed || !animate ? 1 : 0,
                                transition: 'opacity var(--duration-slow, 360ms) var(--ease, ease-out)',
                            }}
                        >
                            {marks}
                        </g>
                        {focus && group && (
                            <circle
                                cx={focus.x}
                                cy={focus.y}
                                r={focus.r + 1.5}
                                strokeWidth={2}
                                className="pointer-events-none stroke-background"
                                style={{ fill: group.color }}
                            />
                        )}
                    </svg>
                ) : null}

                {focus && group && (
                    <ChartTooltip anchor={pointer ?? { x: focus.x, y: focus.y }} bounds={{ width: measured, height }}>
                        {renderTooltip ? (
                            renderTooltip({ ...focus, data: data[focus.row] as ChartRow })
                        ) : (
                            <TooltipContent
                                title={
                                    label ? String(data[focus.row]?.[label] ?? '') : groupBy ? group.label : undefined
                                }
                                items={[
                                    ...(label && groupBy
                                        ? [{ key: 'group', label: group.label, color: group.color, value: '' }]
                                        : []),
                                    {
                                        key: 'x',
                                        label: xTitle ?? x,
                                        color: label && groupBy ? undefined : group.color,
                                        value: xFormatter(focus.xValue),
                                    },
                                    { key: 'y', label: yTitle ?? y, value: valueFormatter(focus.yValue) },
                                    ...(size && focus.sizeValue !== null
                                        ? [
                                              {
                                                  key: 'size',
                                                  label: sizeTitle ?? size,
                                                  value: sizeFormatter(focus.sizeValue),
                                              },
                                          ]
                                        : []),
                                ].map((item): TooltipItem => item)}
                            />
                        )}
                    </ChartTooltip>
                )}
            </div>
            {legend && !empty && !loading && (
                <ChartLegend
                    items={groups.map((g) => ({ key: g.key, label: g.label, color: g.color, shape: 'dot' }))}
                    hidden={hidden}
                    onToggle={toggle}
                    onHover={setEmphasis}
                />
            )}
            {table}
        </div>
    );
}
