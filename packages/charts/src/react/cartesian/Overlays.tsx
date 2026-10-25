import { CHART_CHROME, resolveColor } from '../../color';
import type { ChartColor } from '../../types';
import { TICK_CLASS } from '../utils';
import { markTransform, pt, type Frame } from './frame';

export interface ReferenceLine {
    value: number;
    label?: string;
    /** Default: the axis colour. A target or SLO usually takes a tone. */
    color?: ChartColor;
    /** Which y axis the value belongs to. Default `left`. */
    axis?: 'left' | 'right';
}

export interface ReferenceArea {
    /** First row of the band: a row index, or the index column's value. */
    from: number | string;
    /** Last row, inclusive. */
    to: number | string;
    label?: string;
    /** Default: the neutral slot. */
    color?: ChartColor;
}

export interface Annotation {
    /** The row to mark: a row index, or the index column's value. */
    index: number | string;
    label: string;
    /** Default: the label colour. */
    color?: ChartColor;
}

export type ResolvedReferenceArea = ReferenceArea & { fromIndex: number; toIndex: number };
export type ResolvedAnnotation = Annotation & { rowIndex: number };

export interface BandsProps {
    frame: Frame;
    /** Resolved to row indexes already; out-of-range entries dropped. */
    referenceAreas: ResolvedReferenceArea[];
    /** Selected row range, inclusive, in any order. */
    selection: [number, number] | null;
    /** Hovered row. */
    active: number | null;
    hasBars: boolean;
    showCursor: boolean;
}

export interface OverlayLinesProps extends Omit<BandsProps, 'selection'> {
    referenceLines: ReferenceLine[];
    annotations: ResolvedAnnotation[];
}

/** Behind the marks: reference bands, the hovered band and the range selection. */
export function Bands({ frame, referenceAreas, selection, active, hasBars, showCursor }: BandsProps) {
    const { layout } = frame;
    const { plot, x } = layout;
    const half = x.step / 2;
    const bandOf = (a: number, b: number): [number, number] => {
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        return [(x.centers[lo] ?? plot.x) - half, (x.centers[hi] ?? plot.x) + half];
    };

    return (
        <>
            <g data-slot="chart-bands" transform={markTransform(frame)}>
                {referenceAreas.map((a, i) => {
                    const [x0, x1] = bandOf(a.fromIndex, a.toIndex);
                    return (
                        <rect
                            key={`area-${i}`}
                            x={x0}
                            y={plot.y}
                            width={Math.max(0, x1 - x0)}
                            height={plot.height}
                            style={{ fill: resolveColor(a.color, 8) }}
                            opacity={0.1}
                        />
                    );
                })}
                {showCursor && hasBars && active !== null && (
                    <rect
                        x={(x.centers[active] ?? 0) - half}
                        y={plot.y}
                        width={x.step}
                        height={plot.height}
                        className="fill-muted"
                        opacity={0.6}
                    />
                )}
                {selection && (
                    <rect
                        x={bandOf(...selection)[0]}
                        y={plot.y}
                        width={Math.max(0, bandOf(...selection)[1] - bandOf(...selection)[0])}
                        height={plot.height}
                        className="fill-primary stroke-primary"
                        strokeWidth={1}
                        opacity={0.12}
                    />
                )}
            </g>
        </>
    );
}

/** Drawn above the marks: reference lines, annotation lines, the line-chart cursor and their labels. */
export function OverlayLines({
    frame,
    referenceLines,
    referenceAreas,
    annotations,
    active,
    hasBars,
    showCursor,
}: OverlayLinesProps) {
    const { layout, transposed } = frame;
    const { plot, x } = layout;
    return (
        <g data-slot="chart-overlays">
            {showCursor &&
                !hasBars &&
                active !== null &&
                (() => {
                    const cxp = x.centers[active] ?? 0;
                    const [x1, y1] = pt(frame, cxp, plot.y);
                    const [x2, y2] = pt(frame, cxp, plot.y + plot.height);
                    return (
                        <line
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke={CHART_CHROME.axis}
                            strokeWidth={1}
                            shapeRendering="crispEdges"
                        />
                    );
                })()}

            {referenceLines.map((r, i) => {
                const scale = r.axis === 'right' && layout.y2 ? layout.y2 : layout.y;
                const yv = scale(r.value);
                const color = r.color === undefined ? CHART_CHROME.axis : resolveColor(r.color, 8);
                const [x1, y1] = pt(frame, plot.x, yv);
                const [x2, y2] = pt(frame, plot.x + plot.width, yv);
                return (
                    <g key={`ref-${i}`}>
                        <line
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            style={{ stroke: color }}
                            strokeWidth={1}
                            strokeDasharray="4 3"
                        />
                        {r.label &&
                            (transposed ? (
                                <text
                                    x={x1}
                                    y={plot.x - 3}
                                    textAnchor="middle"
                                    className={TICK_CLASS}
                                    style={{ fill: color }}
                                >
                                    {r.label}
                                </text>
                            ) : (
                                <text x={x2} y={y2 - 4} textAnchor="end" className={TICK_CLASS} style={{ fill: color }}>
                                    {r.label}
                                </text>
                            ))}
                    </g>
                );
            })}

            {referenceAreas.map((a, i) => {
                if (!a.label) return null;
                const lo = Math.min(a.fromIndex, a.toIndex);
                const [lx, ly] = pt(frame, (x.centers[lo] ?? plot.x) - x.step / 2 + 4, plot.y + 10);
                return (
                    <text key={`area-label-${i}`} x={lx} y={ly} className={TICK_CLASS}>
                        {a.label}
                    </text>
                );
            })}

            {annotations.map((a, i) => {
                const cxp = x.centers[a.rowIndex] ?? 0;
                const color = a.color === undefined ? CHART_CHROME.label : resolveColor(a.color, 8);
                const [x1, y1] = pt(frame, cxp, plot.y);
                const [x2, y2] = pt(frame, cxp, plot.y + plot.height);
                return (
                    <g key={`ann-${i}`}>
                        <line
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            style={{ stroke: color }}
                            strokeWidth={1}
                            strokeDasharray="2 3"
                        />
                        <circle cx={x1} cy={y1} r={2.5} style={{ fill: color }} />
                        {transposed ? (
                            <text
                                x={x1 + 4}
                                y={y1 + 3}
                                dominantBaseline="hanging"
                                className={TICK_CLASS}
                                style={{ fill: color }}
                            >
                                {a.label}
                            </text>
                        ) : (
                            <text
                                x={x1 + 5}
                                y={y1 + 3}
                                dominantBaseline="middle"
                                className={TICK_CLASS}
                                style={{ fill: color }}
                            >
                                {a.label}
                            </text>
                        )}
                    </g>
                );
            })}
        </g>
    );
}
