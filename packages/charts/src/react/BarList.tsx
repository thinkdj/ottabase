import { useMemo, type ReactNode } from 'react';
import { resolveColor } from '../color';
import { formatCompact, formatPercent } from '../format';
import type { ChartColor, Formatter, MarkRadius } from '../types';
import { cx, MARK_RADII, useReveal } from './utils';

export interface BarListItem {
    name: string;
    value: number;
    /** Per-row colour; default the list's `color`. */
    color?: ChartColor;
    /** An icon or flag before the name. */
    icon?: ReactNode;
}

export interface BarListProps<T extends BarListItem> {
    data: T[];
    valueFormatter?: Formatter;
    /** Default `desc`. `none` keeps the given order. */
    sortOrder?: 'desc' | 'asc' | 'none';
    /** Default slot 1. */
    color?: ChartColor;
    /** Render the name, e.g. as a router `<Link>`. Default: the name as text. */
    renderName?: (item: T) => ReactNode;
    /** Makes each row a button. */
    onSelect?: (item: T) => void;
    /** Header row labels, e.g. `['Page', 'Visits']`. */
    labels?: [ReactNode, ReactNode];
    /** Rows shown; the rest are dropped (fold them first with `groupOther()` to keep the total). */
    limit?: number;
    /** Bars are relative to this instead of the largest row: pass the grand total for shares. */
    maxValue?: number;
    /** Print each row's share of `maxValue` (or of the sum) after the value. */
    showPercent?: boolean;
    /** Corner radius of the bars: `none` 0, `sm` 2px, `md` 4px, `lg` 8px. Default `md`: a full-row bar reads square at 2px. */
    radius?: MarkRadius;
    animate?: boolean;
    className?: string;
}

/** A ranked list with an in-row bar: top pages, referrers, countries. Reads like a table, compares like a chart. */
export function BarList<T extends BarListItem>({
    data,
    valueFormatter = formatCompact,
    sortOrder = 'desc',
    color,
    renderName,
    onSelect,
    labels,
    limit,
    maxValue,
    showPercent = false,
    radius = 'md',
    animate = true,
    className,
}: BarListProps<T>) {
    const revealed = useReveal(animate);
    const rows = useMemo(() => {
        const sorted =
            sortOrder === 'none'
                ? data
                : [...data].sort((a, b) => (sortOrder === 'desc' ? b.value - a.value : a.value - b.value));
        return limit === undefined ? sorted : sorted.slice(0, limit);
    }, [data, sortOrder, limit]);
    const max = maxValue ?? Math.max(0, ...rows.map((r) => r.value));
    const sum = data.reduce((s, r) => s + Math.max(0, r.value), 0);
    const shareBase = maxValue ?? sum;

    return (
        <div data-slot="bar-list" className={cx('flex flex-col gap-1 text-sm', className)}>
            {labels && (
                <div className="flex justify-between px-2 pb-1 text-xs font-medium text-muted-foreground">
                    <span>{labels[0]}</span>
                    <span>{labels[1]}</span>
                </div>
            )}
            {rows.map((item, i) => {
                const width = max > 0 ? Math.max((item.value / max) * 100, item.value > 0 ? 1 : 0) : 0;
                const body = (
                    <>
                        <span
                            aria-hidden="true"
                            className="absolute inset-y-0 left-0 opacity-20 transition-[width] duration-slow ease-theme"
                            style={{
                                borderRadius: MARK_RADII[radius],
                                width: `${revealed || !animate ? width : 0}%`,
                                backgroundColor: resolveColor(item.color ?? color, 1),
                            }}
                        />
                        {item.icon ? (
                            <span className="relative shrink-0 text-muted-foreground">{item.icon}</span>
                        ) : null}
                        <span className="relative min-w-0 flex-1 truncate">
                            {renderName ? renderName(item) : item.name}
                        </span>
                        {showPercent && shareBase > 0 ? (
                            <span className="relative shrink-0 text-xs tabular-nums text-muted-foreground">
                                {formatPercent(item.value / shareBase, 0)}
                            </span>
                        ) : null}
                        <span className="relative shrink-0 font-medium tabular-nums">{valueFormatter(item.value)}</span>
                    </>
                );
                const rowClass = 'relative flex h-8 w-full items-center gap-3 px-2 text-left';
                return onSelect ? (
                    <button
                        key={`${item.name}-${i}`}
                        type="button"
                        style={{ borderRadius: MARK_RADII[radius] }}
                        onClick={() => onSelect(item)}
                        className={cx(
                            rowClass,
                            'outline-none transition-colors duration-fast ease-theme hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring',
                        )}
                    >
                        {body}
                    </button>
                ) : (
                    <div key={`${item.name}-${i}`} className={rowClass}>
                        {body}
                    </div>
                );
            })}
        </div>
    );
}
