/**
 * @ottabase/charts — headless entry. Pure geometry, data shaping and formatting:
 * no DOM, no React, safe in a Worker and in React Native. The rendered charts live
 * in `@ottabase/charts/react`.
 */
export type {
    ChartColor,
    ChartRow,
    ChartTone,
    Curve,
    Formatter,
    MarkRadius,
    ResolvedSeries,
    SeriesConfig,
    SeriesInput,
    SeriesType,
    StackMode,
} from './types';

export { CHART_CHROME, CHART_SLOTS, chartColor, resolveColor, resolveSeries, toneColor } from './color';

export {
    currencyFormatter,
    dateFormatter,
    delta,
    formatCompact,
    formatCurrency,
    formatDelta,
    formatNumber,
    formatPercent,
    type Delta,
} from './format';

export {
    bucketKey,
    bucketStart,
    fillTimeSeries,
    groupOther,
    parseDate,
    pivot,
    toNumber,
    type CategoryItem,
    type FillTimeSeriesOptions,
    type PivotOptions,
    type TimeStep,
} from './data';

export {
    bandLayout,
    linearScale,
    nearestIndex,
    niceTicks,
    pointLayout,
    type BandLayout,
    type LinearScale,
} from './scale';

export { arcPath, areaPath, linePath, MARK_RADII, segments, type AreaPoint, type Point } from './shape';

export {
    BAR_GAP,
    computeCartesian,
    type AxisOptions,
    type BarRect,
    type CartesianLayout,
    type CartesianOptions,
    type Insets,
    type SeriesGeometry,
    type Tick,
} from './layout/cartesian';

export { computeDonut, type DonutItem, type DonutLayout, type DonutOptions, type DonutSegment } from './layout/donut';

export { computeCalendar, type CalendarCell, type CalendarLayout, type CalendarOptions } from './layout/calendar';

export {
    computeFlowFunnel,
    computeFunnel,
    type FlowFunnelBand,
    type FlowFunnelColumn,
    type FlowFunnelLayout,
    type FlowFunnelOptions,
    type FunnelItem,
    type FunnelLayout,
    type FunnelOptions,
    type FunnelStep,
} from './layout/funnel';

export {
    computeSankey,
    type SankeyLayout,
    type SankeyLink,
    type SankeyLinkInput,
    type SankeyNode,
    type SankeyNodeInput,
    type SankeyOptions,
} from './layout/sankey';

export { computeHeatmap, type HeatmapCell, type HeatmapLayout, type HeatmapOptions } from './layout/heatmap';

export {
    computeTreemap,
    squarify,
    type TreemapGroup,
    type TreemapItem,
    type TreemapLayout,
    type TreemapOptions,
    type TreemapTile,
} from './layout/treemap';

export {
    computeRadar,
    radarAxisAt,
    type RadarAxis,
    type RadarLayout,
    type RadarOptions,
    type RadarRing,
    type RadarSeries,
} from './layout/radar';

export { computeWaterfall, type WaterfallLayout, type WaterfallOptions, type WaterfallStep } from './layout/waterfall';

export {
    computeScatter,
    scatterIndex,
    type ScatterGroup,
    type ScatterLayout,
    type ScatterOptions,
    type ScatterPoint,
    type ScatterSeries,
} from './layout/scatter';

export { sampleIndices, spreadIndices } from './sample';

export { toCsv } from './export';
