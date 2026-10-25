import { useMemo, useState } from 'react';
import { resolveColor } from '../color';
import { formatCompact } from '../format';
import { computeSankey, type SankeyLink, type SankeyNode } from '../layout/sankey';
import type { ChartColor, Formatter, MarkRadius } from '../types';
import { ChartTooltip, TooltipContent } from './ChartTooltip';
import { cx, MARK_RADII, useElementWidth, useReveal, VALUE_LABEL_CLASS } from './utils';

export interface SankeyChartProps {
    data: {
        /** Unlisted colours take the slot of the node's position (1-8). */
        nodes: { name: string; color?: ChartColor }[];
        /** `source` and `target` are node names. */
        links: { source: string; target: string; value: number }[];
    };
    /** Default 300. */
    height?: number;
    /** Fixed width in px. Default: fill the container. */
    width?: number;
    /** Node bar width, px. Default 10. */
    nodeWidth?: number;
    /** Vertical gap between nodes in a column, px. Default 12. */
    nodePadding?: number;
    valueFormatter?: Formatter;
    /** Print each node's value after its name. Default on. */
    showValues?: boolean;
    animate?: boolean;
    /** Corner radius of the marks: `none` 0, `sm` 2px, `md` 4px, `lg` 8px. Default `sm`. */
    radius?: MarkRadius;
    title?: string;
    className?: string;
}

type Focus = { kind: 'node'; node: SankeyNode } | { kind: 'link'; link: SankeyLink };

/** Flow between stages: where traffic comes from, where budget goes, how users move between plans. */
export function SankeyChart({
    data,
    height = 300,
    width: fixedWidth,
    nodeWidth = 10,
    nodePadding = 12,
    valueFormatter = formatCompact,
    showValues = true,
    animate = true,
    radius = 'sm',
    title,
    className,
}: SankeyChartProps) {
    const [ref, measured] = useElementWidth<HTMLDivElement>(fixedWidth);
    const [focus, setFocus] = useState<Focus | null>(null);
    const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
    const revealed = useReveal(animate);
    const layout = useMemo(
        () =>
            computeSankey({
                nodes: data.nodes.map((n, i) => ({ name: n.name, color: resolveColor(n.color, i + 1) })),
                links: data.links,
                width: measured,
                height,
                nodeWidth,
                nodePadding,
            }),
        [data, measured, height, nodeWidth, nodePadding],
    );

    // A focused node lights its own bands; a focused link lights itself and its two ends.
    const linkLit = (l: SankeyLink) =>
        !focus ||
        (focus.kind === 'link'
            ? focus.link.index === l.index
            : l.source.index === focus.node.index || l.target.index === focus.node.index);
    const nodeLit = (n: SankeyNode) =>
        !focus ||
        (focus.kind === 'node'
            ? focus.node.index === n.index ||
              layout.links.some(
                  (l) =>
                      (l.source.index === focus.node.index && l.target.index === n.index) ||
                      (l.target.index === focus.node.index && l.source.index === n.index),
              )
            : focus.link.source.index === n.index || focus.link.target.index === n.index);

    return (
        <div
            ref={ref}
            data-slot="sankey"
            className={cx('relative w-full min-w-0', className)}
            style={{ height }}
            onPointerMove={(e) => {
                const box = e.currentTarget.getBoundingClientRect();
                setPointer({ x: e.clientX - box.left, y: e.clientY - box.top });
            }}
            onPointerLeave={() => {
                setFocus(null);
                setPointer(null);
            }}
        >
            {measured > 0 && (
                <svg
                    width={measured}
                    height={height}
                    aria-hidden="true"
                    className="block overflow-visible transition-opacity duration-slow ease-theme"
                    style={{ opacity: revealed || !animate ? 1 : 0 }}
                >
                    {layout.links.map((l) => (
                        <path
                            key={l.index}
                            d={l.path}
                            fill="none"
                            style={{ stroke: l.source.color }}
                            strokeWidth={Math.max(1, l.width)}
                            strokeOpacity={focus ? (linkLit(l) ? 0.55 : 0.08) : 0.3}
                            className="transition-[stroke-opacity] duration-fast ease-theme"
                            onPointerEnter={() => setFocus({ kind: 'link', link: l })}
                            onPointerLeave={() => setFocus(null)}
                        />
                    ))}
                    {layout.nodes.map((n) => {
                        // Labels point into the chart: right of the node, or left in the second half.
                        const right = n.x + n.width / 2 < measured / 2;
                        return (
                            <g
                                key={n.index}
                                opacity={nodeLit(n) ? 1 : 0.35}
                                className="transition-opacity duration-fast ease-theme"
                                onPointerEnter={() => setFocus({ kind: 'node', node: n })}
                                onPointerLeave={() => setFocus(null)}
                            >
                                <rect
                                    x={n.x}
                                    y={n.y}
                                    width={n.width}
                                    height={Math.max(1, n.height)}
                                    rx={MARK_RADII[radius]}
                                    style={{ fill: n.color }}
                                />
                                <text
                                    x={right ? n.x + n.width + 6 : n.x - 6}
                                    y={n.y + n.height / 2}
                                    textAnchor={right ? 'start' : 'end'}
                                    dominantBaseline="middle"
                                    className="pointer-events-none fill-foreground text-xs"
                                >
                                    {n.name}
                                    {showValues && (
                                        <tspan dx={6} className={VALUE_LABEL_CLASS}>
                                            {valueFormatter(n.value)}
                                        </tspan>
                                    )}
                                </text>
                            </g>
                        );
                    })}
                </svg>
            )}
            {focus && pointer && (
                <ChartTooltip anchor={pointer} bounds={{ width: measured, height }}>
                    {focus.kind === 'link' ? (
                        <TooltipContent
                            title={`${focus.link.source.name} → ${focus.link.target.name}`}
                            items={[
                                {
                                    key: 'value',
                                    label: 'Flow',
                                    color: focus.link.source.color,
                                    value: valueFormatter(focus.link.value),
                                },
                            ]}
                        />
                    ) : (
                        <TooltipContent
                            title={focus.node.name}
                            items={[
                                ...(focus.node.valueIn > 0
                                    ? [{ key: 'in', label: 'In', value: valueFormatter(focus.node.valueIn) }]
                                    : []),
                                ...(focus.node.valueOut > 0
                                    ? [{ key: 'out', label: 'Out', value: valueFormatter(focus.node.valueOut) }]
                                    : []),
                            ]}
                        />
                    )}
                </ChartTooltip>
            )}

            <table className="sr-only">
                {/* A caption renders outside the table box, so the table's sr-only clip misses it. */}
                {title && <caption className="sr-only">{title}</caption>}
                <thead>
                    <tr>
                        <th scope="col">From</th>
                        <th scope="col">To</th>
                        <th scope="col">Value</th>
                    </tr>
                </thead>
                <tbody>
                    {layout.links.map((l) => (
                        <tr key={l.index}>
                            <td>{l.source.name}</td>
                            <td>{l.target.name}</td>
                            <td>{valueFormatter(l.value)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
