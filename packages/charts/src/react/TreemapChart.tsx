import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { CHART_SLOTS, resolveColor } from '../color';
import { toNumber } from '../data';
import { formatCompact, formatNumber, formatPercent } from '../format';
import { computeTreemap, type TreemapTile } from '../layout/treemap';
import type { ChartColor, ChartRow, Formatter, MarkRadius } from '../types';
import { ChartLegend } from './ChartLegend';
import { ChartSkeleton } from './ChartSkeleton';
import { ChartTooltip, TooltipContent } from './ChartTooltip';
import { cx, MARK_RADII, useElementWidth, useReveal } from './utils';

export interface TreemapChartProps {
    data: ChartRow[];
    /** Column naming each tile. Default `name`. */
    index?: string;
    /** Column with the tile's value. Default `value`. */
    category?: string;
    /** Column grouping tiles into blocks (a tenant, a folder); each group takes a slot. */
    groupBy?: string;
    /** Group colours by name or by position (first-seen order). Unlisted groups take the next slot. */
    colors?: Record<string, ChartColor> | ChartColor[];
    /** The colour of a flat treemap. Default slot 1. */
    color?: ChartColor;
    /** Default 280. */
    height?: number;
    /** Fixed width in px. Default: fill the container. */
    width?: number;
    valueFormatter?: Formatter;
    /** Tiles drawn; the smallest items of each group fold into "Other". Default 150. */
    maxTiles?: number;
    /** Groups drawn; the smallest fold into "Other". Default 8. */
    maxGroups?: number;
    /** Default: on when grouped. */
    showLegend?: boolean;
    onTileClick?: (tile: TreemapTile) => void;
    /** Corner radius of the tiles: `none` 0, `sm` 2px, `md` 4px, `lg` 8px. Default `sm`. */
    radius?: MarkRadius;
    animate?: boolean;
    loading?: boolean;
    title?: string;
    emptyText?: ReactNode;
    className?: string;
}

// ponytail: label fit by character count. 11px sans ≈ 6.4px a glyph.
const NAME_W = 6.4;
const fit = (text: string, width: number) => {
    const n = Math.floor((width - 12) / NAME_W);
    return n <= 1 ? '' : text.length <= n ? text : `${text.slice(0, n - 1)}…`;
};

/** Part of a whole when the parts are many: storage by tenant and bucket, spend by team and service. */
export function TreemapChart({
    data,
    index = 'name',
    category = 'value',
    groupBy,
    colors,
    color,
    height = 280,
    width: fixedWidth,
    valueFormatter = formatCompact,
    maxTiles,
    maxGroups,
    showLegend,
    onTileClick,
    radius = 'sm',
    animate = true,
    loading = false,
    title,
    emptyText = 'No data',
    className,
}: TreemapChartProps) {
    const [ref, measured] = useElementWidth<HTMLDivElement>(fixedWidth);
    const [active, setActive] = useState<number | null>(null);
    const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
    const revealed = useReveal(animate);

    const items = useMemo(
        () =>
            data.map((row) => ({
                name: String(row[index] ?? ''),
                value: toNumber(row[category]) ?? 0,
                group: groupBy ? String(row[groupBy] ?? '') : undefined,
            })),
        [data, index, category, groupBy],
    );
    // A group's slot follows its first appearance, so filtering the data never recolours the rest.
    const slotOf = useMemo(() => {
        const slots = new Map<string, number>();
        for (const item of items)
            if (item.group !== undefined && !slots.has(item.group)) slots.set(item.group, slots.size);
        return slots;
    }, [items]);
    const layout = useMemo(() => {
        if (measured <= 0) return null;
        return computeTreemap({
            items,
            width: measured,
            height,
            maxTiles,
            maxGroups,
            colorOf: (group) => {
                if (group === null) return resolveColor(color, 1);
                const slot = slotOf.get(group);
                // The folded "Other" group, or a group past the slots, is the neutral slot.
                if (slot === undefined) return resolveColor(undefined, CHART_SLOTS);
                const explicit = Array.isArray(colors) ? colors[slot] : colors?.[group];
                return resolveColor(explicit, Math.min(slot + 1, CHART_SLOTS));
            },
        });
    }, [items, measured, height, maxTiles, maxGroups, color, colors, slotOf]);

    const empty = !layout ? data.length === 0 : layout.total === 0;
    const focus = layout && active !== null ? layout.tiles[active] : undefined;
    const legend = showLegend ?? Boolean(groupBy);
    const rx = MARK_RADII[radius];

    const body = useMemo(() => {
        if (!layout) return null;
        return (
            <>
                {layout.groups.map((g) => (
                    <g key={`g-${g.name}`} data-slot="treemap-group">
                        <rect
                            x={g.x}
                            y={g.y}
                            width={g.width}
                            height={g.height}
                            rx={rx}
                            style={{ fill: g.color }}
                            opacity={0.1}
                        />
                        {g.header && (
                            <text
                                x={g.x + 6}
                                y={g.y + 13}
                                className="pointer-events-none fill-foreground text-[11px] font-medium"
                            >
                                {fit(g.name, g.width - 56)}
                                <tspan dx={6} className="fill-muted-foreground font-mono text-[10px] font-normal">
                                    {valueFormatter(g.value)}
                                </tspan>
                            </text>
                        )}
                    </g>
                ))}
                {layout.tiles.map((t) => {
                    const name = t.width >= 40 && t.height >= 20 ? fit(t.name, t.width) : '';
                    // A folded tile is a sum of many: lighter, so it never reads as one big item.
                    const ink = t.folded ? 'fill-foreground' : 'fill-background';
                    return (
                        <g key={t.index} data-slot="treemap-tile" onPointerEnter={() => setActive(t.index)}>
                            <rect
                                x={t.x}
                                y={t.y}
                                width={t.width}
                                height={t.height}
                                rx={Math.min(rx, t.width / 2, t.height / 2)}
                                style={{ fill: t.color }}
                                opacity={t.folded ? 0.45 : 1}
                            />
                            {name && (
                                <text
                                    x={t.x + 6}
                                    y={t.y + 14}
                                    className={cx('pointer-events-none text-[11px] font-medium', ink)}
                                >
                                    {name}
                                </text>
                            )}
                            {name && t.height >= 36 && (
                                <text
                                    x={t.x + 6}
                                    y={t.y + 28}
                                    className={cx('pointer-events-none font-mono text-[10px]', ink)}
                                    opacity={0.8}
                                >
                                    {valueFormatter(t.value)}
                                </text>
                            )}
                        </g>
                    );
                })}
            </>
        );
    }, [layout, rx, valueFormatter]);

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        const n = layout?.tiles.length ?? 0;
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
        else if ((e.key === 'Enter' || e.key === ' ') && focus && onTileClick) {
            e.preventDefault();
            onTileClick(focus);
        }
    };

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
                        className={cx('block select-none', onTileClick && 'cursor-pointer')}
                        style={{
                            opacity: revealed || !animate ? 1 : 0,
                            transition: 'opacity var(--duration-slow, 360ms) var(--ease, ease-out)',
                        }}
                        onPointerMove={(e) => {
                            const box = e.currentTarget.getBoundingClientRect();
                            setPointer({ x: e.clientX - box.left, y: e.clientY - box.top });
                        }}
                        onPointerLeave={() => {
                            setActive(null);
                            setPointer(null);
                        }}
                        onClick={() => focus && onTileClick?.(focus)}
                    >
                        {body}
                        {focus && (
                            <rect
                                x={focus.x - 1}
                                y={focus.y - 1}
                                width={focus.width + 2}
                                height={focus.height + 2}
                                rx={rx + 1}
                                fill="none"
                                strokeWidth={2}
                                className="pointer-events-none stroke-foreground"
                            />
                        )}
                    </svg>
                ) : null}

                {focus && layout && (
                    <ChartTooltip
                        anchor={pointer ?? { x: focus.x + focus.width / 2, y: focus.y + focus.height / 2 }}
                        bounds={{ width: measured, height }}
                    >
                        <TooltipContent
                            title={focus.folded ? `${focus.name} · ${formatNumber(focus.folded)} items` : focus.name}
                            items={[
                                ...(focus.group !== null
                                    ? [
                                          {
                                              key: 'group',
                                              label: focus.group,
                                              color: focus.color,
                                              value: formatPercent(focus.groupShare),
                                          },
                                      ]
                                    : []),
                                {
                                    key: 'value',
                                    label: category,
                                    color: focus.group === null ? focus.color : undefined,
                                    value: valueFormatter(focus.value),
                                },
                            ]}
                            footer={{ key: 'share', label: 'Of total', value: formatPercent(focus.share) }}
                        />
                    </ChartTooltip>
                )}
            </div>
            {legend && layout && layout.groups.length > 0 && !loading && (
                <ChartLegend
                    items={layout.groups.map((g) => ({
                        key: g.name,
                        label: g.name,
                        color: g.color,
                        value: valueFormatter(g.value),
                    }))}
                    onHover={(key) => {
                        const first = key === null ? -1 : (layout.tiles.find((t) => t.group === key)?.index ?? -1);
                        setActive(first >= 0 ? first : null);
                        setPointer(null);
                    }}
                />
            )}

            <table className="sr-only">
                {title && <caption className="sr-only">{title}</caption>}
                <thead>
                    <tr>
                        {groupBy && <th scope="col">{groupBy}</th>}
                        <th scope="col">{index}</th>
                        <th scope="col">{category}</th>
                        <th scope="col">Share</th>
                    </tr>
                </thead>
                <tbody>
                    {layout?.tiles.map((t) => (
                        <tr key={t.index}>
                            {groupBy && <td>{t.group}</td>}
                            <th scope="row">{t.folded ? `${t.name} (${t.folded} items)` : t.name}</th>
                            <td>{valueFormatter(t.value)}</td>
                            <td>{formatPercent(t.share)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
