import type { ReactNode } from 'react';
import { cx } from './utils';

export interface LegendItem {
    key: string;
    label: ReactNode;
    color: string;
    /** Shown after the label in tabular figures (a donut's slice value). */
    value?: ReactNode;
    /** A swatch shape: a filled square (bars, areas) or a line (line series). Default `square`. */
    shape?: 'square' | 'line' | 'dot';
}

export interface ChartLegendProps {
    items: LegendItem[];
    /** Keys currently hidden; drawn dimmed. */
    hidden?: ReadonlySet<string>;
    /** Makes each entry a toggle button. */
    onToggle?: (key: string) => void;
    /** Called with the hovered key, and null when the pointer leaves: emphasise that series. */
    onHover?: (key: string | null) => void;
    /** Wrap entries horizontally (default) or list them in a column. */
    direction?: 'row' | 'column';
    className?: string;
}

function Swatch({ color, shape = 'square' }: { color: string; shape?: LegendItem['shape'] }) {
    if (shape === 'line') {
        return (
            <span aria-hidden="true" className="h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        );
    }
    return (
        <span
            aria-hidden="true"
            className={cx('size-2.5 shrink-0', shape === 'dot' ? 'rounded-full' : 'rounded-[2px]')}
            style={{ backgroundColor: color }}
        />
    );
}

/** A row of colour keys. Colour never works alone: every swatch carries its label. */
export function ChartLegend({ items, hidden, onToggle, onHover, direction = 'row', className }: ChartLegendProps) {
    return (
        <ul
            data-slot="chart-legend"
            className={cx(
                'flex text-xs',
                direction === 'row' ? 'flex-wrap gap-x-4 gap-y-1' : 'flex-col gap-1',
                className,
            )}
            onPointerLeave={onHover ? () => onHover(null) : undefined}
        >
            {items.map((item) => {
                const off = hidden?.has(item.key) ?? false;
                const body = (
                    <>
                        <Swatch color={item.color} shape={item.shape} />
                        <span className="text-muted-foreground">{item.label}</span>
                        {item.value !== undefined ? (
                            <span className="font-medium tabular-nums text-foreground">{item.value}</span>
                        ) : null}
                    </>
                );
                const hover = onHover ? { onPointerEnter: () => onHover(item.key) } : {};
                return (
                    <li
                        key={item.key}
                        className={cx('transition-opacity duration-fast ease-theme', off && 'opacity-40')}
                        {...hover}
                    >
                        {onToggle ? (
                            <button
                                type="button"
                                aria-pressed={!off}
                                onClick={() => onToggle(item.key)}
                                className="flex items-center gap-1.5 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {body}
                            </button>
                        ) : (
                            <span className="flex items-center gap-1.5">{body}</span>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
