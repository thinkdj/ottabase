import { useMemo, useState } from 'react';
import { CHART_CHROME, resolveColor } from '../color';
import { dateFormatter, formatNumber } from '../format';
import { computeCalendar, type CalendarCell, type CalendarOptions } from '../layout/calendar';
import type { ChartColor, Formatter, MarkRadius } from '../types';
import { ChartTooltip, TooltipContent } from './ChartTooltip';
import { cx, MARK_RADII, TICK_CLASS } from './utils';

export interface CalendarHeatmapProps extends CalendarOptions {
    /** Default slot 1. */
    color?: ChartColor;
    /** Cell size in px. Default 11. */
    cellSize?: number;
    /** Gap between cells in px. Default 3. */
    gap?: number;
    valueFormatter?: Formatter;
    /** Name of the counted thing in the tooltip: "3 commits". Default "". */
    unit?: string;
    /** "Less … More" key under the grid. Default on. */
    showLegend?: boolean;
    onCellClick?: (cell: CalendarCell) => void;
    /** Corner radius of the marks: `none` 0, `sm` 2px, `md` 4px, `lg` 8px. Default `sm`. */
    radius?: MarkRadius;
    title?: string;
    className?: string;
}

const WEEKDAYS_MON = ['Mon', '', 'Wed', '', 'Fri', '', ''];
const WEEKDAYS_SUN = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
const LONG_DATE = dateFormatter('day', { timeZone: 'UTC' });

/** One cell per day over the past year (or `weeks`), darker for busier days. */
export function CalendarHeatmap({
    color,
    cellSize = 11,
    gap = 3,
    valueFormatter = formatNumber,
    unit = '',
    showLegend = true,
    onCellClick,
    radius = 'sm',
    title,
    className,
    ...options
}: CalendarHeatmapProps) {
    const { data, index, value, end, weeks, levels, weekStart = 1 } = options;
    const [active, setActive] = useState<CalendarCell | null>(null);
    const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
    const layout = useMemo(
        () => computeCalendar({ data, index, value, end, weeks, levels, weekStart }),
        [data, index, value, end, weeks, levels, weekStart],
    );
    const fill = resolveColor(color, 1);
    const step = cellSize + gap;
    const left = 28;
    const top = 16;
    const width = left + layout.columns * step;
    const height = top + 7 * step;
    const weekdays = weekStart === 1 ? WEEKDAYS_MON : WEEKDAYS_SUN;
    const opacity = (level: number) => (level === 0 ? 1 : 0.25 + (0.75 * level) / layout.levels);

    return (
        <div data-slot="calendar-heatmap" className={cx('flex flex-col gap-2', className)}>
            <div className="relative overflow-x-auto">
                <svg
                    width={width}
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
                    {layout.months.map((m) => (
                        <text key={`${m.label}-${m.col}`} x={left + m.col * step} y={10} className={TICK_CLASS}>
                            {m.label}
                        </text>
                    ))}
                    {weekdays.map((d, row) =>
                        d ? (
                            <text
                                key={d}
                                x={0}
                                y={top + row * step + cellSize / 2}
                                dominantBaseline="middle"
                                className={TICK_CLASS}
                            >
                                {d}
                            </text>
                        ) : null,
                    )}
                    {layout.cells.map((c) => (
                        <rect
                            key={c.date}
                            x={left + c.col * step}
                            y={top + c.row * step}
                            width={cellSize}
                            height={cellSize}
                            rx={MARK_RADII[radius]}
                            style={{ fill: c.level === 0 ? CHART_CHROME.grid : fill }}
                            opacity={opacity(c.level)}
                            strokeWidth={active?.date === c.date ? 1.5 : 0}
                            className={cx('stroke-foreground', onCellClick && 'cursor-pointer')}
                            onPointerEnter={() => setActive(c)}
                            onClick={() => onCellClick?.(c)}
                        >
                            <title>{`${valueFormatter(c.value)}${unit ? ` ${unit}` : ''} on ${c.date}`}</title>
                        </rect>
                    ))}
                </svg>
                {active && pointer && (
                    <ChartTooltip anchor={pointer} bounds={{ width, height }}>
                        <TooltipContent
                            items={[
                                {
                                    key: active.date,
                                    label: LONG_DATE(active.date),
                                    color: active.level === 0 ? undefined : fill,
                                    value: `${valueFormatter(active.value)}${unit ? ` ${unit}` : ''}`,
                                },
                            ]}
                        />
                    </ChartTooltip>
                )}
            </div>
            {showLegend && (
                <div className="flex items-center gap-1 self-end text-[10px] text-muted-foreground">
                    <span className="mr-1">Less</span>
                    {Array.from({ length: layout.levels + 1 }, (_, level) => (
                        <span
                            key={level}
                            aria-hidden="true"
                            style={{
                                borderRadius: MARK_RADII[radius],
                                width: cellSize,
                                height: cellSize,
                                backgroundColor: level === 0 ? CHART_CHROME.grid : fill,
                                opacity: opacity(level),
                            }}
                        />
                    ))}
                    <span className="ml-1">More</span>
                </div>
            )}
        </div>
    );
}
