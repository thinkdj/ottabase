import { memo } from 'react';
import { CHART_CHROME } from '../../color';
import type { Tick } from '../../layout/cartesian';
import { TICK_CLASS } from '../utils';
import { categoryAxisX, pt, type AxesLayout, type Frame } from './frame';

export interface AxesProps {
    frame: Frame<AxesLayout>;
    showGrid: boolean;
    showXAxis: boolean;
    showYAxis: boolean;
    xTitle?: string;
    yTitle?: string;
    y2Title?: string;
    /** Category ticks for a horizontal chart (the engine thins labels for vertical ones only). */
    categoryTicks: Tick[];
}

/** Grid lines, tick labels and axis titles. Everything here is recessive chrome. */
function AxesView({ frame, showGrid, showXAxis, showYAxis, xTitle, yTitle, y2Title, categoryTicks }: AxesProps) {
    const { layout, transposed, width, height } = frame;
    const { plot } = layout;
    return (
        <g data-slot="chart-axes">
            {showGrid &&
                layout.yTicks.map((t) => {
                    const [x1, y1] = pt(frame, plot.x, t.position);
                    const [x2, y2] = pt(frame, plot.x + plot.width, t.position);
                    return (
                        <line
                            key={t.value}
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke={t.value === 0 ? CHART_CHROME.axis : CHART_CHROME.grid}
                            strokeWidth={1}
                            shapeRendering="crispEdges"
                        />
                    );
                })}

            {/* Value ticks: left of the plot, or along the bottom when transposed. */}
            {showYAxis &&
                layout.yTicks.map((t) =>
                    transposed ? (
                        <text
                            key={t.value}
                            x={width - t.position}
                            y={height - 6 - (xTitle ? 16 : 0)}
                            textAnchor="middle"
                            className={TICK_CLASS}
                        >
                            {t.label}
                        </text>
                    ) : (
                        <text
                            key={t.value}
                            x={plot.x - 8}
                            y={t.position}
                            textAnchor="end"
                            dominantBaseline="middle"
                            className={TICK_CLASS}
                        >
                            {t.label}
                        </text>
                    ),
                )}

            {showYAxis &&
                !transposed &&
                layout.y2Ticks.map((t) => (
                    <text
                        key={`r-${t.value}`}
                        x={plot.x + plot.width + 8}
                        y={t.position}
                        textAnchor="start"
                        dominantBaseline="middle"
                        className={TICK_CLASS}
                    >
                        {t.label}
                    </text>
                ))}

            {/* Category ticks: under the plot, or down the left side when transposed. */}
            {showXAxis &&
                (transposed ? categoryTicks : layout.xTicks).map((t) =>
                    transposed ? (
                        <text
                            key={t.value}
                            x={categoryAxisX(frame)}
                            y={t.position}
                            textAnchor="end"
                            dominantBaseline="middle"
                            className={TICK_CLASS}
                        >
                            {t.label}
                        </text>
                    ) : (
                        <text
                            key={t.value}
                            x={t.position}
                            y={plot.y + plot.height + 16}
                            textAnchor="middle"
                            className={TICK_CLASS}
                        >
                            {t.label}
                        </text>
                    ),
                )}

            {xTitle && (
                <text
                    x={transposed ? width - plot.y - plot.height / 2 : plot.x + plot.width / 2}
                    y={height - 4}
                    textAnchor="middle"
                    className={TICK_CLASS}
                >
                    {xTitle}
                </text>
            )}
            {yTitle && !transposed && (
                <text
                    transform={`translate(10 ${plot.y + plot.height / 2}) rotate(-90)`}
                    textAnchor="middle"
                    className={TICK_CLASS}
                >
                    {yTitle}
                </text>
            )}
            {y2Title && !transposed && (
                <text
                    transform={`translate(${width - 6} ${plot.y + plot.height / 2}) rotate(90)`}
                    textAnchor="middle"
                    className={TICK_CLASS}
                >
                    {y2Title}
                </text>
            )}
        </g>
    );
}

export const Axes = memo(AxesView);
