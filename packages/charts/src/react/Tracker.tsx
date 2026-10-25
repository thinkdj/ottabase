import { useMemo, useState } from 'react';
import { resolveColor } from '../color';
import type { ChartColor, MarkRadius } from '../types';
import { ChartTooltip, TooltipContent } from './ChartTooltip';
import { cx, MARK_RADII, useElementWidth } from './utils';

export interface TrackerItem {
    /** A tone (`success`, `danger`…) for status, or any chart colour. Default `smoke`: no data. */
    color?: ChartColor;
    /** Tooltip and accessible label, e.g. "Oct 25 · 99.98% up". */
    tooltip?: string;
    /** A second tooltip line: the detail under the label. */
    detail?: string;
}

export interface TrackerProps {
    data: TrackerItem[];
    /** Bar height in px. Default 32. */
    height?: number;
    /** Fixed width in px, for SSR and tests. Default: fill the container. */
    width?: number;
    /** Called with the item, or with a merged bar's worst item, and its index in `data`. */
    onItemClick?: (item: TrackerItem, index: number) => void;
    /** Corner radius of the bars: `none` 0, `sm` 2px, `md` 4px, `lg` 8px. Default `sm`. */
    radius?: MarkRadius;
    title?: string;
    className?: string;
}

// Worst first when periods share a bar: an outage must never hide behind a good day.
const SEVERITY: Record<string, number> = {
    danger: 5,
    red: 5,
    warning: 4,
    amber: 4,
    info: 3,
    blue: 3,
    success: 1,
    green: 1,
    smoke: 0,
    neutral: 0,
};
const severity = (item: TrackerItem) => SEVERITY[String(item.color ?? 'smoke')] ?? 2;

interface Bar {
    item: TrackerItem;
    /** Index of `item` in `data`. */
    index: number;
    /** Periods this bar stands for. */
    count: number;
    first: TrackerItem;
    last: TrackerItem;
}

/**
 * A strip of status bars, one per period: uptime, cron runs, deploys. Colour comes with
 * its tooltip. More periods than fit (a bar is at least 2px plus a 2px gap) share a bar,
 * which takes the worst status among them.
 */
export function Tracker({
    data,
    height = 32,
    width: fixedWidth,
    onItemClick,
    radius = 'sm',
    title,
    className,
}: TrackerProps) {
    const [ref, measured] = useElementWidth<HTMLDivElement>(fixedWidth);
    const [active, setActive] = useState<number | null>(null);
    const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
    const [bounds, setBounds] = useState({ width: 0, height });

    const bars = useMemo<Bar[]>(() => {
        const fit = measured > 0 ? Math.max(1, Math.floor((measured + 2) / 4)) : data.length;
        if (data.length <= fit) {
            return data.map((item, index) => ({ item, index, count: 1, first: item, last: item }));
        }
        const out: Bar[] = [];
        for (let b = 0; b < fit; b++) {
            const start = Math.floor((b * data.length) / fit);
            const end = Math.floor(((b + 1) * data.length) / fit);
            if (end <= start) continue;
            let worst = start;
            for (let i = start + 1; i < end; i++) {
                if (severity(data[i] as TrackerItem) > severity(data[worst] as TrackerItem)) worst = i;
            }
            out.push({
                item: data[worst] as TrackerItem,
                index: worst,
                count: end - start,
                first: data[start] as TrackerItem,
                last: data[end - 1] as TrackerItem,
            });
        }
        return out;
    }, [data, measured]);
    const focus = active !== null ? bars[active] : undefined;
    const labelOf = (bar: Bar) =>
        bar.count > 1 ? `${bar.first.tooltip ?? ''} – ${bar.last.tooltip ?? ''}` : (bar.item.tooltip ?? '');
    const detailOf = (bar: Bar) =>
        bar.count > 1
            ? `${bar.item.detail ? `Worst: ${bar.item.detail} · ` : ''}${bar.count} periods`
            : (bar.item.detail ?? '');

    return (
        <div
            ref={ref}
            data-slot="tracker"
            className={cx('relative w-full', className)}
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
            <div role="list" aria-label={title} className="flex w-full gap-[2px]" style={{ height }}>
                {bars.map((bar, i) => (
                    <div
                        key={i}
                        role="listitem"
                        aria-label={labelOf(bar) || undefined}
                        className={cx(
                            'min-w-[2px] flex-1 transition-opacity duration-fast ease-theme',
                            active !== null && active !== i && 'opacity-60',
                            onItemClick && 'cursor-pointer',
                        )}
                        style={{
                            backgroundColor: resolveColor(bar.item.color ?? 'smoke', 8),
                            borderRadius: MARK_RADII[radius],
                        }}
                        onPointerEnter={() => setActive(i)}
                        onClick={() => onItemClick?.(bar.item, bar.index)}
                    />
                ))}
            </div>
            {focus && pointer && (focus.item.tooltip || focus.item.detail || focus.count > 1) && (
                <ChartTooltip anchor={pointer} bounds={bounds}>
                    <TooltipContent
                        items={[
                            {
                                key: 'item',
                                label: labelOf(focus),
                                color: resolveColor(focus.item.color ?? 'smoke', 8),
                                value: detailOf(focus),
                            },
                        ]}
                    />
                </ChartTooltip>
            )}
        </div>
    );
}
