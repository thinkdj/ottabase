import { useMemo } from 'react';
import { resolveSeries } from '../color';
import { computeCartesian } from '../layout/cartesian';
import type { ChartColor, ChartRow, Curve, MarkRadius } from '../types';
import { cx, MARK_RADII, useElementWidth } from './utils';

export interface SparklineProps {
    /** Plain numbers, or rows with `index`/`category` columns. */
    data: number[] | ChartRow[];
    /** Value column when `data` is rows. Default `value`. */
    category?: string;
    type?: 'line' | 'area' | 'bar';
    color?: ChartColor;
    curve?: Curve;
    /** Default 32. */
    height?: number;
    /** Fixed width in px. Default: fill the container. */
    width?: number;
    /** Start at the lowest value instead of zero, to show the shape of a series far from zero. Lines only. */
    autoMinValue?: boolean;
    /** Corner radius of the marks: `none` 0, `sm` 2px, `md` 4px, `lg` 8px. Default `sm`. */
    radius?: MarkRadius;
    /** Accessible name, e.g. "Signups, last 14 days". Without one the sparkline is decorative. */
    title?: string;
    className?: string;
}

/** A word-sized trend with no axes, for a `Stat` tile's foot or a table cell. */
export function Sparkline({
    data,
    category = 'value',
    type = 'line',
    color,
    curve = 'linear',
    height = 32,
    width: fixedWidth,
    autoMinValue = type === 'line',
    radius = 'sm',
    title,
    className,
}: SparklineProps) {
    const [ref, measured] = useElementWidth<HTMLDivElement>(fixedWidth);
    const rows = useMemo<ChartRow[]>(
        () =>
            (data as (number | ChartRow)[]).map((d, i) =>
                typeof d === 'number' ? { i: String(i), [category]: d } : d,
            ),
        [data, category],
    );
    const series = useMemo(() => resolveSeries([{ key: category, color }], type), [category, color, type]);
    const layout = useMemo(
        () =>
            measured > 0
                ? computeCartesian({
                      data: rows,
                      index: 'i',
                      series,
                      width: measured,
                      height,
                      curve,
                      autoMinValue,
                      showXAxis: false,
                      showYAxis: false,
                      // Room for half of the 2px stroke and the end dot.
                      inset: type === 'bar' ? {} : { top: 3, right: 3, bottom: 3, left: 1 },
                      barPadding: 0.2,
                  })
                : null,
        [rows, series, measured, height, curve, autoMinValue, type],
    );
    const s = layout?.series[0];
    const last = s ? [...s.points].reverse().find((p) => p !== null) : undefined;

    return (
        <div
            ref={ref}
            data-slot="sparkline"
            role={title ? 'img' : undefined}
            aria-label={title}
            aria-hidden={title ? undefined : true}
            className={cx('w-full min-w-0', className)}
            style={{ height }}
        >
            {layout && s && (
                <svg width={measured} height={height} className="block overflow-visible">
                    {type === 'bar' ? (
                        <g style={{ fill: s.color }}>
                            {s.bars.map((b) => (
                                <rect
                                    key={b.index}
                                    x={b.x}
                                    y={b.y}
                                    width={b.width}
                                    height={b.height}
                                    rx={MARK_RADII[radius]}
                                />
                            ))}
                        </g>
                    ) : (
                        <>
                            {type === 'area' && <path d={s.area} style={{ fill: s.color }} opacity={0.15} />}
                            <path
                                d={s.line}
                                fill="none"
                                style={{ stroke: s.color }}
                                strokeWidth={2}
                                strokeLinejoin="round"
                                strokeLinecap="round"
                            />
                            {last && <circle cx={last.x} cy={last.y} r={2.5} style={{ fill: s.color }} />}
                        </>
                    )}
                </svg>
            )}
        </div>
    );
}
