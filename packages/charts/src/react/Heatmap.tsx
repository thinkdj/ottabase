import { useMemo, useState } from 'react';
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

/** A matrix of two categories coloured by value: traffic by hour × weekday, errors by route × day. */
export function Heatmap({
    color,
    cellHeight = 22,
    width: fixedWidth,
    valueFormatter = formatCompact,
    xFormatter = (v) => v,
    yFormatter = (v) => v,
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
    const left = Math.ceil(Math.max(0, ...layout.yDomain.map((v) => yFormatter(v).length)) * 6.2 + 10);
    const top = 16;
    const cols = layout.xDomain.length || 1;
    const cellW = Math.max(0, (measured - left) / cols);
    const height = top + layout.yDomain.length * cellHeight;
    const xStride = Math.max(1, Math.ceil(28 / (cellW || 28)));

    return (
        <div ref={ref} data-slot="heatmap" className={cx('relative w-full min-w-0', className)} style={{ height }}>
            {measured > 0 && (
                <svg
                    width={measured}
                    height={height}
                    role="img"
                    aria-label={title}
                    className="block"
                    onPointerMove={(e) => {
                        const box = e.currentTarget.getBoundingClientRect();
                        setPointer({ x: e.clientX - box.left, y: e.clientY - box.top });
                    }}
                    onPointerLeave={() => {
                        setActive(null);
                        setPointer(null);
                    }}
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
                    {layout.yDomain.map((v, i) => (
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
                    ))}
                    {layout.cells.map((c) => {
                        const cx0 = left + c.col * cellW;
                        const cy0 = top + c.row * cellHeight;
                        const isActive = active?.col === c.col && active?.row === c.row;
                        return (
                            <g
                                key={`${c.col}-${c.row}`}
                                onPointerEnter={() => setActive(c)}
                                onClick={() => onCellClick?.(c)}
                                className={onCellClick ? 'cursor-pointer' : undefined}
                            >
                                <rect
                                    x={cx0 + 1}
                                    y={cy0 + 1}
                                    width={Math.max(0, cellW - 2)}
                                    height={cellHeight - 2}
                                    rx={MARK_RADII[radius]}
                                    style={{ fill: c.value === null ? CHART_CHROME.grid : fill }}
                                    opacity={c.value === null ? 0.5 : 0.15 + 0.85 * c.intensity}
                                    className={cx(
                                        'transition-opacity duration-fast ease-theme',
                                        isActive && 'stroke-foreground',
                                    )}
                                    strokeWidth={isActive ? 1.5 : 0}
                                />
                                {showValues && c.value !== null && cellW >= 28 && (
                                    <text
                                        x={cx0 + cellW / 2}
                                        y={cy0 + cellHeight / 2}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        className={cx(
                                            'font-mono text-[10px]',
                                            c.intensity > 0.55 ? 'fill-background' : 'fill-foreground',
                                        )}
                                    >
                                        {valueFormatter(c.value)}
                                    </text>
                                )}
                            </g>
                        );
                    })}
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
