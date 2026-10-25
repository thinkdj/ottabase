import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from './utils';

export interface TooltipItem {
    key: string;
    label: ReactNode;
    value: ReactNode;
    /** Swatch colour; omitted draws no swatch. */
    color?: string;
    /** Draw the row quieter (a hidden series, a secondary figure). */
    muted?: boolean;
}

export interface TooltipContentProps {
    title?: ReactNode;
    items: TooltipItem[];
    /** A row under a rule: the stack total, a conversion rate. */
    footer?: TooltipItem;
    className?: string;
}

/** The standard tooltip body: a title, swatched rows, an optional total. Reuse it from `renderTooltip`. */
export function TooltipContent({ title, items, footer, className }: TooltipContentProps) {
    return (
        <div className={cx('min-w-36 text-xs', className)}>
            {title !== undefined && title !== '' ? <div className="mb-1.5 font-medium">{title}</div> : null}
            <ul className="space-y-1">
                {items.map((item) => (
                    <li key={item.key} className={cx('flex items-center gap-2', item.muted && 'opacity-60')}>
                        {item.color ? (
                            <span
                                aria-hidden="true"
                                className="size-2 shrink-0 rounded-[2px]"
                                style={{ backgroundColor: item.color }}
                            />
                        ) : null}
                        <span className="flex-1 text-muted-foreground">{item.label}</span>
                        <span className="font-medium tabular-nums">{item.value}</span>
                    </li>
                ))}
                {footer ? (
                    <li className="flex items-center gap-2 border-t pt-1">
                        <span className="flex-1 text-muted-foreground">{footer.label}</span>
                        <span className="font-medium tabular-nums">{footer.value}</span>
                    </li>
                ) : null}
            </ul>
        </div>
    );
}

export interface ChartTooltipProps {
    /** Where the tooltip points, in the container's pixel space. */
    anchor: { x: number; y: number };
    /** The container's size; the tooltip stays inside it. */
    bounds: { width: number; height: number };
    children: ReactNode;
    className?: string;
}

const OFFSET = 12;

/**
 * A floating panel positioned beside an anchor inside a `relative` container. It
 * measures itself, sits to the right of the anchor, flips left when that overflows,
 * and clamps vertically so it never leaves the chart.
 */
export function ChartTooltip({ anchor, bounds, children, className }: ChartTooltipProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState<{ w: number; h: number } | null>(null);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        setSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
        // Re-measure whenever the body changes; the same-size guard stops a render loop.
    }, [children]);

    const w = size?.w ?? 0;
    const h = size?.h ?? 0;
    let left = anchor.x + OFFSET;
    if (left + w > bounds.width) left = anchor.x - OFFSET - w;
    if (left < 0) left = Math.max(0, Math.min(anchor.x + OFFSET, bounds.width - w));
    const top = Math.max(0, Math.min(anchor.y - h / 2, bounds.height - h));

    return (
        <div
            ref={ref}
            role="tooltip"
            data-slot="chart-tooltip"
            className={cx(
                'pointer-events-none absolute z-10 rounded-md border bg-popover px-3 py-2 text-popover-foreground shadow-md',
                className,
            )}
            style={{ left, top, visibility: size ? 'visible' : 'hidden' }}
        >
            {children}
        </div>
    );
}
