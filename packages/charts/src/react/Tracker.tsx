import { useState } from 'react';
import { resolveColor } from '../color';
import type { ChartColor, MarkRadius } from '../types';
import { ChartTooltip, TooltipContent } from './ChartTooltip';
import { cx, MARK_RADII } from './utils';

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
    onItemClick?: (item: TrackerItem, index: number) => void;
    /** Corner radius of the bars: `none` 0, `sm` 2px, `md` 4px, `lg` 8px. Default `sm`. */
    radius?: MarkRadius;
    title?: string;
    className?: string;
}

/** A strip of status bars, one per period: uptime, cron runs, deploys. Colour comes with its tooltip. */
export function Tracker({ data, height = 32, onItemClick, radius = 'sm', title, className }: TrackerProps) {
    const [active, setActive] = useState<number | null>(null);
    const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
    const [bounds, setBounds] = useState({ width: 0, height });
    const focus = active !== null ? data[active] : undefined;

    return (
        <div
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
                {data.map((item, i) => (
                    <div
                        key={i}
                        role="listitem"
                        aria-label={item.tooltip}
                        className={cx(
                            'min-w-[2px] flex-1 transition-opacity duration-fast ease-theme',
                            active !== null && active !== i && 'opacity-60',
                            onItemClick && 'cursor-pointer',
                        )}
                        style={{
                            backgroundColor: resolveColor(item.color ?? 'smoke', 8),
                            borderRadius: MARK_RADII[radius],
                        }}
                        onPointerEnter={() => setActive(i)}
                        onClick={() => onItemClick?.(item, i)}
                    />
                ))}
            </div>
            {focus && pointer && (focus.tooltip || focus.detail) && (
                <ChartTooltip anchor={pointer} bounds={bounds}>
                    <TooltipContent
                        items={[
                            {
                                key: 'item',
                                label: focus.tooltip ?? '',
                                color: resolveColor(focus.color ?? 'smoke', 8),
                                value: focus.detail ?? '',
                            },
                        ]}
                    />
                </ChartTooltip>
            )}
        </div>
    );
}
