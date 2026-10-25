import { useMemo, useState, type PointerEvent } from 'react';
import { CHART_CHROME, resolveColor } from '../color';
import { formatCompact } from '../format';
import { computeHeatmap, type HeatmapCell, type HeatmapOptions } from '../layout/heatmap';
import type { ChartColor, Formatter, MarkRadius } from '../types';
import { ChartTooltip, TooltipContent } from './ChartTooltip';
import { cx, MARK_RADII, TICK_CLASS, useElementWidth } from './utils';

export interface HeatmapProps extends HeatmapOptions {
    /** Default slot 1. */
    color?: ChartColor;
    /** Row height, px. Default 22. */
    cellHeight?: number;
    /** Fixed width in px. Default: fill the container. */
    width?: number;
    valueFormatter?: Formatter;
    xFormatter?: (value: string) => string;
    yFormatter?: (value: string) => string;
    /** Print the value inside each cell when it fits. */
    showValues?: boolean;
    onCellClick?: (cell: HeatmapCell) => void;
    /** Corner radius of the marks: `none` 0, `sm` 2px, `md` 4px, `lg` 8px. Default `sm`. */
    radius?: MarkRadius;
    title?: string;
    className?: string;
}

const identity = (v: string) => v;
// Past this many cells, cells draw as one path per shade instead of a rect each.
const DENSE_CELLS = 1500;
const SHADES = 10;
const opacityOf = (intensity: number) => 0.15 + 0.85 * intensity;
const r = (n: number) => Math.round(n * 100) / 100;

/** A matrix of two categories coloured by value: traffic by hour × weekday, errors by route × day. */
export function Heatmap({
    color,
    cellHeight = 22,
    width: fixedWidth,
    valueFormatter = formatCompact,
    xFormatter = identity,
    yFormatter = identity,
    showValues = false,
    onCellClick,
    radius = 'sm',
    title,
    className,
    ...options
}: HeatmapProps) {
    const [ref, measured] = useElementWidth<HTMLDivElement>(fixedWidth);
    const [active, setActive] = useState<HeatmapCell | null>(null);
    const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
    const { data, x, y, value, xDomain, yDomain, levels } = options;
    const layout = useMemo(
        () => computeHeatmap({ data, x, y, value, xDomain, yDomain, levels }),
        [data, x, y, value, xDomain, yDomain, levels],
    );
    const fill = resolveColor(color, 1);
    // ponytail: label width by character count, like the cartesian engine.
    const left = Math.ceil(layout.yDomain.reduce((m, v) => Math.max(m, yFormatter(v).length), 0) * 6.2 + 10);
    const top = 16;
    const cols = layout.xDomain.length || 1;
    const cellW = Math.max(0, (measured - left) / cols);
    const height = top + layout.yDomain.length * cellHeight;
    const xStride = Math.max(1, Math.ceil(28 / (cellW || 28)));
    const yStride = Math.max(1, Math.ceil(12 / cellHeight));
    const dense = layout.cells.length > DENSE_CELLS;

    // Cells are drawn once per layout and size; hover only moves the outline on top.
    const cells = useMemo(() => {
        if (measured <= 0) return null;
        const rx = MARK_RADII[radius];
        const w = Math.max(0, cellW - 2);
        const h = cellHeight - 2;
        if (dense) {
            const empty: string[] = [];
            const shades = Array.from({ length: SHADES + 1 }, () => [] as string[]);
            for (const c of layout.cells) {
                const d = `M${r(left + c.col * cellW + 1)} ${r(top + c.row * cellHeight + 1)}h${r(w)}v${h}h${r(-w)}Z`;
                if (c.value === null) empty.push(d);
                else (shades[Math.round(c.intensity * SHADES)] as string[]).push(d);
            }
            return (
                <>
                    <path d={empty.join('')} style={{ fill: CHART_CHROME.grid }} opacity={0.5} />
                    {shades.map((ds, i) =>
                        ds.length ? (
                            <path key={i} d={ds.join('')} style={{ fill }} opacity={opacityOf(i / SHADES)} />
                        ) : null,
                    )}
                </>
            );
        }
        return layout.cells.map((c) => {
            const cx0 = left + c.col * cellW;
            const cy0 = top + c.row * cellHeight;
            return (
                <g key={`${c.col}-${c.row}`}>
                    <rect
                        x={cx0 + 1}
                        y={cy0 + 1}
                        width={w}
                        height={h}
                        rx={rx}
                        style={{ fill: c.value === null ? CHART_CHROME.grid : fill }}
                        opacity={c.value === null ? 0.5 : opacityOf(c.intensity)}
                    />
                    {showValues && c.value !== null && cellW >= 28 && (
                        <text
                            x={cx0 + cellW / 2}
                            y={cy0 + cellHeight / 2}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className={cx(
                                'pointer-events-none font-mono text-[10px]',
                                c.intensity > 0.55 ? 'fill-background' : 'fill-foreground',
                            )}
                        >
                            {valueFormatter(c.value)}
                        </text>
                    )}
                </g>
            );
        });
    }, [layout, measured, cellW, cellHeight, left, dense, fill, radius, showValues, valueFormatter]);

    const cellAt = (e: PointerEvent<SVGSVGElement>): HeatmapCell | null => {
        const box = e.currentTarget.getBoundingClientRect();
        const col = Math.floor((e.clientX - box.left - left) / (cellW || 1));
        const row = Math.floor((e.clientY - box.top - top) / cellHeight);
        if (col < 0 || row < 0 || col >= layout.xDomain.length || row >= layout.yDomain.length) return null;
        // Cells are row-major: every x for the first y, then the next y.
        return layout.cells[row * layout.xDomain.length + col] ?? null;
    };

    return (
        <div ref={ref} data-slot="heatmap" className={cx('relative w-full min-w-0', className)} style={{ height }}>
            {measured > 0 && (
                <svg
                    width={measured}
                    height={height}
                    role="img"
                    aria-label={title}
                    className={cx('block', onCellClick && active && 'cursor-pointer')}
                    onPointerMove={(e) => {
                        const box = e.currentTarget.getBoundingClientRect();
                        setPointer({ x: e.clientX - box.left, y: e.clientY - box.top });
                        const c = cellAt(e);
                        setActive((prev) => (prev?.col === c?.col && prev?.row === c?.row ? prev : c));
                    }}
                    onPointerLeave={() => {
                        setActive(null);
                        setPointer(null);
                    }}
                    onClick={() => active && onCellClick?.(active)}
                >
                    {layout.xDomain.map((v, i) =>
                        i % xStride === 0 ? (
                            <text
                                key={v}
                                x={left + i * cellW + cellW / 2}
                                y={10}
                                textAnchor="middle"
                                className={TICK_CLASS}
                            >
                                {xFormatter(v)}
                            </text>
                        ) : null,
                    )}
                    {layout.yDomain.map((v, i) =>
                        i % yStride === 0 ? (
                            <text
                                key={v}
                                x={left - 8}
                                y={top + i * cellHeight + cellHeight / 2}
                                textAnchor="end"
                                dominantBaseline="middle"
                                className={TICK_CLASS}
                            >
                                {yFormatter(v)}
                            </text>
                        ) : null,
                    )}
                    {cells}
                    {active && (
                        <rect
                            x={left + active.col * cellW + 1}
                            y={top + active.row * cellHeight + 1}
                            width={Math.max(0, cellW - 2)}
                            height={cellHeight - 2}
                            rx={MARK_RADII[radius]}
                            fill="none"
                            strokeWidth={1.5}
                            className="pointer-events-none stroke-foreground"
                        />
                    )}
                </svg>
            )}
            {active && pointer && (
                <ChartTooltip anchor={pointer} bounds={{ width: measured, height }}>
                    <TooltipContent
                        title={`${yFormatter(active.y)} · ${xFormatter(active.x)}`}
                        items={[
                            {
                                key: 'v',
                                label: value ?? 'value',
                                color: fill,
                                value: active.value === null ? '—' : valueFormatter(active.value),
                            },
                        ]}
                    />
                </ChartTooltip>
            )}
        </div>
    );
}
