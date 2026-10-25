import { useState, type ReactNode } from 'react';
import { CHART_SLOTS, resolveColor } from '../color';
import { groupOther } from '../data';
import { formatCompact, formatPercent } from '../format';
import type { ChartColor, Formatter, MarkRadius } from '../types';
import { ChartLegend } from './ChartLegend';
import { ChartTooltip, TooltipContent } from './ChartTooltip';
import { cx, MARK_RADII, useReveal } from './utils';

export interface CategoryBarItem {
    name: string;
    value: number;
    color?: ChartColor;
}

export interface CategoryBarProps {
    data: CategoryBarItem[];
    /** The bar's full length. Default: the sum of the items; larger leaves the rest empty (free space). */
    total?: number;
    valueFormatter?: Formatter;
    /** Bar height, px. Default 10. */
    height?: number;
    /** A tick at this value, e.g. a quota. */
    marker?: { value: number; label?: string };
    showLegend?: boolean;
    /** Each segment's share printed under the legend entry. Default on. */
    showPercent?: boolean;
    animate?: boolean;
    /** Corner radius of the marks: `none` 0, `sm` 2px, `md` 4px, `lg` 8px. Default `sm`. */
    radius?: MarkRadius;
    title?: string;
    className?: string;
}

/** One bar split by category: storage by type, traffic by source, a budget by line. */
export function CategoryBar({
    data,
    total,
    valueFormatter = formatCompact,
    height = 10,
    marker,
    showLegend = true,
    showPercent = true,
    animate = true,
    radius = 'sm',
    title,
    className,
}: CategoryBarProps) {
    const [active, setActive] = useState<number | null>(null);
    const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
    const [bounds, setBounds] = useState({ width: 0, height: 0 });
    const revealed = useReveal(animate);
    const sum = data.reduce((s, d) => s + Math.max(0, d.value), 0);
    const full = total !== undefined && total > sum ? total : sum;
    // Slots never cycle: past eight segments the smallest fold into "Other", on the neutral slot.
    const folded = data.length > CHART_SLOTS;
    const segments: CategoryBarItem[] = folded
        ? groupOther(data, CHART_SLOTS - 1).map((d, i) =>
              i === CHART_SLOTS - 1 ? { ...d, color: CHART_SLOTS } : (data.find((x) => x.name === d.name) ?? d),
          )
        : data;
    const items = segments.map((d, i) => ({
        ...d,
        color: resolveColor(d.color, i + 1),
        share: full > 0 ? Math.max(0, d.value) / full : 0,
    }));
    const focus = active !== null ? items[active] : undefined;

    return (
        <div data-slot="category-bar" className={cx('flex flex-col gap-2', className)}>
            <div
                role="img"
                aria-label={title}
                className="relative w-full"
                onPointerMove={(e) => {
                    const box = e.currentTarget.getBoundingClientRect();
                    setBounds({ width: box.width, height: box.height });
                    setPointer({ x: e.clientX - box.left, y: e.clientY - box.top });
                }}
                onPointerLeave={() => {
                    setActive(null);
                    setPointer(null);
                }}
            >
                <div
                    className="flex w-full gap-[2px] overflow-hidden bg-chart-grid"
                    style={{ height, borderRadius: MARK_RADII[radius] }}
                >
                    {items.map((item, i) => (
                        <div
                            key={item.name}
                            className={cx(
                                'h-full shrink-0 transition-[width,opacity] duration-slow ease-theme',
                                active !== null && active !== i && 'opacity-40',
                            )}
                            style={{
                                width: `${(revealed || !animate ? item.share : 0) * 100}%`,
                                backgroundColor: item.color,
                            }}
                            onPointerEnter={() => setActive(i)}
                        />
                    ))}
                </div>
                {marker && full > 0 && (
                    <div
                        aria-hidden="true"
                        className="absolute -top-1 -bottom-1 w-0.5 bg-foreground"
                        style={{ left: `${Math.min(100, (marker.value / full) * 100)}%` }}
                        title={marker.label}
                    />
                )}
                {focus && pointer && (
                    <ChartTooltip anchor={pointer} bounds={bounds}>
                        <TooltipContent
                            items={[
                                {
                                    key: focus.name,
                                    label: focus.name,
                                    color: focus.color,
                                    value: `${valueFormatter(focus.value)} · ${formatPercent(focus.share)}`,
                                },
                            ]}
                        />
                    </ChartTooltip>
                )}
            </div>
            {showLegend && (
                <ChartLegend
                    items={items.map((item): { key: string; label: ReactNode; color: string; value?: ReactNode } => ({
                        key: item.name,
                        label: item.name,
                        color: item.color,
                        value: showPercent ? formatPercent(item.share, 0) : valueFormatter(item.value),
                    }))}
                    onHover={(key) => setActive(key === null ? null : items.findIndex((i) => i.name === key))}
                />
            )}
        </div>
    );
}
