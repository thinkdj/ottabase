import { memo } from 'react';
import type { SeriesGeometry } from '../../layout/cartesian';
import type { Formatter } from '../../types';
import { VALUE_LABEL_CLASS } from '../utils';
import { markTransform, pt, type Frame } from './frame';

export type ValueLabels = 'none' | 'all' | 'last';

export interface MarksProps {
    frame: Frame;
    clipId: string;
    gradientPrefix: string;
    /** Hovered row, which dims the other bars. */
    active: number | null;
    /** Series emphasised from the legend; the others fade. */
    emphasis: string | null;
    stacked: boolean;
    dots: 'none' | 'last' | 'all';
    showValues: ValueLabels;
    formatOf: (s: SeriesGeometry) => Formatter;
    /** Whether the reveal transition has run; marks start collapsed. */
    revealed: boolean;
    animate: boolean;
    /** Bar corner radius, px. */
    radius: number;
}

const DIM = 0.45;
const FADE = 0.2;

const r = (n: number) => Math.round(n * 100) / 100;

/** Every bar of a series as one path of rectangles. */
function barsPath(bars: SeriesGeometry['bars']): string {
    return bars.map((b) => `M${r(b.x)} ${r(b.y)}h${r(b.width)}v${r(b.height)}h${r(-b.width)}Z`).join('');
}

export function lastValueIndex(values: (number | null)[]): number {
    for (let i = values.length - 1; i >= 0; i--) if (values[i] !== null) return i;
    return -1;
}

/** Bars, area fills, lines and their dots, all in computed space. */
function MarksView({
    frame,
    clipId,
    gradientPrefix,
    active,
    emphasis,
    stacked,
    formatOf,
    revealed,
    animate,
    radius,
    showValues: valuesProp,
    dots: dotsProp,
}: MarksProps) {
    const { layout, transposed } = frame;
    const { plot } = layout;
    const hasBars = layout.series.some((s) => s.type === 'bar');
    // A sampled chart has a mark per pixel column: a dot or label on each would be a smear.
    const dots = layout.sampled && dotsProp === 'all' ? 'last' : dotsProp;
    const showValues = layout.sampled && valuesProp === 'all' ? 'last' : valuesProp;
    // Past a few hundred bars, one path per series draws the same pixels as a rect each.
    const batched = layout.sampled || layout.x.bandwidth < 2;
    const seriesOpacity = (key: string) => (emphasis !== null && emphasis !== key ? FADE : 1);
    // Stack totals label the top of each stack once, not every segment, where a label fits.
    const stackTotals: { x: number; y: number; total: number; format: Formatter }[] = [];
    if (showValues !== 'none' && stacked && hasBars && layout.x.bandwidth >= 18) {
        const bars = layout.series.filter((s) => s.type === 'bar');
        const rows = layout.series[0]?.values.length ?? 0;
        for (let ri = 0; ri < rows; ri++) {
            const segs = bars.map((s) => s.bars.find((b) => b.index === ri)).filter((b) => b !== undefined);
            if (!segs.length) continue;
            const total = segs.reduce((sum, b) => sum + b.value, 0);
            const top = Math.min(...segs.map((b) => b.y));
            const first = segs[0];
            if (first) stackTotals.push({ x: first.x + first.width / 2, y: top, total, format: formatOf(bars[0]!) });
        }
    }

    return (
        <g data-slot="chart-marks">
            <defs>
                <clipPath id={clipId}>
                    {/* 3px of slack keeps 2px strokes and end dots on the edge whole. The rect scales
                        up from nothing on mount: bars grow from the baseline, lines sweep in. */}
                    <rect
                        x={plot.x - 3}
                        y={plot.y - 3}
                        width={plot.width + 6}
                        height={plot.height + 6}
                        style={
                            animate
                                ? {
                                      transformBox: 'fill-box',
                                      transformOrigin: hasBars ? 'bottom' : 'left',
                                      transform: revealed ? 'scale(1, 1)' : hasBars ? 'scale(1, 0)' : 'scale(0, 1)',
                                      transition: 'transform var(--duration-slow, 360ms) var(--ease, ease-out)',
                                  }
                                : undefined
                        }
                    />
                </clipPath>
                {/* Ids by position: a series key ("social media") is not a safe url(#…) fragment. */}
                {layout.series.map((s, i) =>
                    s.type === 'area' && !stacked ? (
                        <linearGradient key={s.key} id={`${gradientPrefix}-${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={s.color} stopOpacity={0.32} />
                            <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
                        </linearGradient>
                    ) : null,
                )}
            </defs>

            <g clipPath={`url(#${clipId})`} transform={markTransform(frame)}>
                {layout.series.map((s, i) =>
                    s.type === 'bar' ? (
                        <g
                            key={s.key}
                            style={{ fill: s.color }}
                            opacity={seriesOpacity(s.key)}
                            className="transition-opacity duration-fast ease-theme"
                        >
                            {batched ? (
                                <path d={barsPath(s.bars)} />
                            ) : (
                                s.bars.map((b) => (
                                    <rect
                                        key={b.index}
                                        x={b.x}
                                        y={b.y}
                                        width={b.width}
                                        height={b.height}
                                        rx={radius}
                                        opacity={active !== null && active !== b.index ? DIM : 1}
                                        className="transition-all duration-normal ease-theme"
                                    />
                                ))
                            )}
                        </g>
                    ) : (
                        <g
                            key={s.key}
                            opacity={seriesOpacity(s.key)}
                            className="transition-opacity duration-fast ease-theme"
                        >
                            {s.type === 'area' && (
                                <path
                                    d={s.area}
                                    fill={stacked ? s.color : `url(#${gradientPrefix}-${i})`}
                                    opacity={stacked ? 0.28 : 1}
                                />
                            )}
                            <path
                                d={s.line}
                                fill="none"
                                style={{ stroke: s.color }}
                                strokeWidth={2}
                                strokeLinejoin="round"
                                strokeLinecap="round"
                            />
                            {dots === 'all' &&
                                s.points.map((p, i) =>
                                    p ? <circle key={i} cx={p.x} cy={p.y} r={3} style={{ fill: s.color }} /> : null,
                                )}
                            {dots === 'last' &&
                                (() => {
                                    const p = s.points[lastValueIndex(s.values)];
                                    return p ? <circle cx={p.x} cy={p.y} r={3} style={{ fill: s.color }} /> : null;
                                })()}
                        </g>
                    ),
                )}
            </g>

            {/* Data labels live outside the rotated group so the text stays upright. */}
            {showValues !== 'none' && (
                <g
                    data-slot="chart-values"
                    opacity={revealed || !animate ? 1 : 0}
                    className="transition-opacity duration-slow ease-theme"
                >
                    {stackTotals.map((t, i) => {
                        const [x, y] = pt(frame, t.x, t.y);
                        return transposed ? (
                            <text key={i} x={x + 4} y={y} dominantBaseline="middle" className={VALUE_LABEL_CLASS}>
                                {t.format(t.total)}
                            </text>
                        ) : (
                            <text key={i} x={x} y={y - 4} textAnchor="middle" className={VALUE_LABEL_CLASS}>
                                {t.format(t.total)}
                            </text>
                        );
                    })}
                    {!stacked &&
                        layout.series
                            .filter((s) => s.type === 'bar')
                            .map((s) => {
                                const lastIndex = lastValueIndex(s.values);
                                return s.bars.map((b) => {
                                    if (showValues === 'last' && b.index !== lastIndex) return null;
                                    // Narrow grouped bars have no room for a label each.
                                    if (b.width < 18) return null;
                                    const end = b.value >= 0 ? b.y : b.y + b.height;
                                    const [x, y] = pt(frame, b.x + b.width / 2, end);
                                    const label = formatOf(s)(b.value);
                                    return transposed ? (
                                        <text
                                            key={`${s.key}-${b.index}`}
                                            x={b.value >= 0 ? x + 4 : x - 4}
                                            y={y}
                                            textAnchor={b.value >= 0 ? 'start' : 'end'}
                                            dominantBaseline="middle"
                                            className={VALUE_LABEL_CLASS}
                                        >
                                            {label}
                                        </text>
                                    ) : (
                                        <text
                                            key={`${s.key}-${b.index}`}
                                            x={x}
                                            y={b.value >= 0 ? y - 4 : y + 12}
                                            textAnchor="middle"
                                            className={VALUE_LABEL_CLASS}
                                        >
                                            {label}
                                        </text>
                                    );
                                });
                            })}
                    {layout.series
                        .filter((s) => s.type !== 'bar')
                        .map((s) => {
                            const i = lastValueIndex(s.values);
                            const p = s.points[i];
                            const v = s.values[i];
                            if (!p || v === null || v === undefined) return null;
                            if (showValues === 'all') {
                                return s.points.map((q, qi) => {
                                    const qv = s.values[qi];
                                    if (!q || qv === null || qv === undefined) return null;
                                    const [x, y] = pt(frame, q.x, q.y);
                                    return (
                                        <text
                                            key={`${s.key}-${qi}`}
                                            x={x}
                                            y={y - 7}
                                            textAnchor="middle"
                                            className={VALUE_LABEL_CLASS}
                                        >
                                            {formatOf(s)(qv)}
                                        </text>
                                    );
                                });
                            }
                            // Direct label at the line's end: the series name and its latest value.
                            const [x, y] = pt(frame, p.x, p.y);
                            return (
                                <text
                                    key={s.key}
                                    x={x + 6}
                                    y={y}
                                    dominantBaseline="middle"
                                    className={VALUE_LABEL_CLASS}
                                    style={{ fill: s.color }}
                                >
                                    {formatOf(s)(v)}
                                </text>
                            );
                        })}
                </g>
            )}
        </g>
    );
}

export const Marks = memo(MarksView);
