import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { CHART_CHROME, resolveColor } from '../color';
import { groupOther, toNumber } from '../data';
import { formatCompact, formatPercent } from '../format';
import { computeDonut, type DonutSegment } from '../layout/donut';
import type { ChartColor, ChartRow, Formatter, MarkRadius } from '../types';
import { ChartLegend } from './ChartLegend';
import { ChartTooltip, TooltipContent } from './ChartTooltip';
import { cx, MARK_RADII, useReveal } from './utils';

export interface DonutChartProps {
    data: ChartRow[];
    /** Column with the slice name. Default `name`. */
    index?: string;
    /** Column with the slice value. Default `value`. */
    category?: string;
    /**
     * Slice colours: by name (`{ Failed: 'danger' }`, the way a status breakdown takes
     * its tones) or by position. Unlisted slices take the next categorical slot.
     */
    colors?: Record<string, ChartColor> | ChartColor[];
    /** `pie` fills the centre; `half` draws the top half (a gauge-like breakdown). Default `donut`. */
    variant?: 'donut' | 'pie' | 'half';
    /** Square size in px. Default 160. */
    size?: number;
    /** Ring width in px. */
    thickness?: number;
    valueFormatter?: Formatter;
    /** Under the total in the centre ("packages", "visits"). */
    label?: ReactNode;
    /** Replaces the centre total. */
    centerValue?: ReactNode;
    /** Most slices drawn; the smallest fold into "Other". Default 8, the slot count. */
    maxSlices?: number;
    /** Sort slices largest first. Default: keep the given order. */
    sort?: boolean;
    showLegend?: boolean;
    /** Legend placement. Default `bottom`. */
    legendPosition?: 'bottom' | 'right';
    /** Floating tooltip on hover, in addition to the centre readout. Default on. */
    showTooltip?: boolean;
    /** Replace the tooltip body. */
    renderTooltip?: (slice: { name: string; value: number; share: number; color: string }) => ReactNode;
    onSliceClick?: (slice: { name: string; value: number }) => void;
    animate?: boolean;
    /** Corner radius of the marks: `none` 0, `sm` 2px, `md` 4px, `lg` 8px. Default `sm`. */
    radius?: MarkRadius;
    title?: string;
    emptyText?: ReactNode;
    className?: string;
}

/** Part of a whole. The centre shows the total, or the hovered slice. */
export function DonutChart({
    data,
    index = 'name',
    category = 'value',
    colors,
    variant = 'donut',
    size = 160,
    thickness,
    valueFormatter = formatCompact,
    label,
    centerValue,
    maxSlices = 8,
    sort = false,
    showLegend = true,
    legendPosition = 'bottom',
    showTooltip = true,
    renderTooltip,
    onSliceClick,
    animate = true,
    radius = 'sm',
    title,
    emptyText = 'No data',
    className,
}: DonutChartProps) {
    const [active, setActive] = useState<number | null>(null);
    const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
    const revealed = useReveal(animate);

    const items = useMemo(() => {
        const raw = data.map((row) => ({ name: String(row[index] ?? ''), value: toNumber(row[category]) ?? 0 }));
        const sorted = sort ? [...raw].sort((a, b) => b.value - a.value) : raw;
        const sliced = raw.length > maxSlices ? groupOther(sorted, maxSlices - 1) : sorted;
        return sliced.map((item, i) => {
            const explicit = Array.isArray(colors) ? colors[i] : colors?.[item.name];
            // "Other" is the neutral slot when nothing claims it.
            const fallback = raw.length > maxSlices && i === sliced.length - 1 ? 8 : i + 1;
            return { ...item, color: resolveColor(explicit, fallback) };
        });
    }, [data, index, category, colors, maxSlices, sort]);

    const layout = useMemo(
        () =>
            computeDonut({
                items,
                size,
                thickness: variant === 'pie' ? size / 2 : thickness,
                cornerRadius: MARK_RADII[radius],
                startAngle: variant === 'half' ? -90 : 0,
                endAngle: variant === 'half' ? 90 : undefined,
            }),
        [items, size, thickness, variant, radius],
    );

    const focus: DonutSegment | undefined = active !== null ? layout.segments[active] : undefined;
    const empty = layout.total === 0;
    const boxHeight = layout.height;

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        const n = layout.segments.length;
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
        else if ((e.key === 'Enter' || e.key === ' ') && focus && onSliceClick) {
            e.preventDefault();
            onSliceClick({ name: focus.name, value: focus.value });
        }
    };

    const anchor = pointer ?? (focus ? focus.centroid : { x: 0, y: 0 });

    return (
        <div
            data-slot="chart"
            className={cx(
                'flex gap-4',
                legendPosition === 'right' ? 'flex-row flex-wrap items-center' : 'flex-col items-center',
                className,
            )}
        >
            <div
                role="group"
                aria-roledescription="chart"
                aria-label={title}
                tabIndex={empty ? undefined : 0}
                onKeyDown={onKeyDown}
                onBlur={() => setActive(null)}
                className="relative shrink-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{ width: size, height: boxHeight }}
            >
                <svg
                    width={size}
                    height={boxHeight}
                    aria-hidden="true"
                    className="block overflow-visible"
                    onPointerMove={(e) => {
                        const box = e.currentTarget.getBoundingClientRect();
                        setPointer({ x: e.clientX - box.left, y: e.clientY - box.top });
                    }}
                    onPointerLeave={() => {
                        setActive(null);
                        setPointer(null);
                    }}
                >
                    {(empty || variant === 'half') && (
                        <path d={layout.track} fill={CHART_CHROME.grid} opacity={variant === 'half' ? 0.6 : 1} />
                    )}
                    <g
                        style={{
                            transformBox: 'fill-box',
                            transformOrigin: 'center',
                            transform: revealed || !animate ? 'scale(1)' : 'scale(0.6)',
                            opacity: revealed || !animate ? 1 : 0,
                            transition:
                                'transform var(--duration-slow, 360ms) var(--ease-enter, ease-out), opacity var(--duration-slow, 360ms) ease',
                        }}
                    >
                        {layout.segments.map((s, i) => (
                            <path
                                key={s.name}
                                d={s.path}
                                style={{
                                    fill: s.color,
                                    transformBox: 'fill-box',
                                    transformOrigin: `${layout.cx}px ${layout.cy}px`,
                                }}
                                opacity={active !== null && active !== i ? 0.35 : 1}
                                className={cx(
                                    'transition-[opacity,transform] duration-fast ease-theme',
                                    active === i && 'scale-[1.03]',
                                    onSliceClick && 'cursor-pointer',
                                )}
                                onPointerEnter={() => setActive(i)}
                                onClick={() => onSliceClick?.({ name: s.name, value: s.value })}
                            />
                        ))}
                    </g>
                </svg>
                {variant !== 'pie' && (
                    <div
                        className={cx(
                            'pointer-events-none absolute inset-x-0 flex flex-col items-center text-center',
                            variant === 'half' ? 'bottom-0 justify-end' : 'inset-y-0 justify-center',
                        )}
                    >
                        {empty ? (
                            <span className="text-sm text-muted-foreground">{emptyText}</span>
                        ) : (
                            <>
                                <span className="text-2xl font-semibold leading-none tracking-[-0.02em] tabular-nums">
                                    {focus
                                        ? valueFormatter(focus.value)
                                        : (centerValue ?? valueFormatter(layout.total))}
                                </span>
                                <span className="mt-1.5 max-w-[70%] truncate text-xs text-muted-foreground">
                                    {focus ? `${focus.name} · ${formatPercent(focus.share, 0)}` : label}
                                </span>
                            </>
                        )}
                    </div>
                )}
                {showTooltip && focus && (
                    <ChartTooltip anchor={anchor} bounds={{ width: size, height: boxHeight }}>
                        {renderTooltip ? (
                            renderTooltip({
                                name: focus.name,
                                value: focus.value,
                                share: focus.share,
                                color: focus.color,
                            })
                        ) : (
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
                        )}
                    </ChartTooltip>
                )}
            </div>

            {showLegend && !empty && (
                <ChartLegend
                    direction={legendPosition === 'right' ? 'column' : 'row'}
                    className={legendPosition === 'right' ? undefined : 'justify-center'}
                    items={layout.segments.map((s) => ({
                        key: s.name,
                        label: s.name,
                        color: s.color,
                        value: valueFormatter(s.value),
                    }))}
                    onHover={(key) => setActive(key === null ? null : layout.segments.findIndex((s) => s.name === key))}
                />
            )}

            <table className="sr-only">
                {/* A caption renders outside the table box, so the table's sr-only clip misses it. */}
                {title && <caption className="sr-only">{title}</caption>}
                <tbody>
                    {layout.segments.map((s) => (
                        <tr key={s.name}>
                            <th scope="row">{s.name}</th>
                            <td>{valueFormatter(s.value)}</td>
                            <td>{formatPercent(s.share)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
