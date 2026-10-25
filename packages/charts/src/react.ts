/**
 * @ottabase/charts/react — rendered SVG charts on the brand-engine chart tokens.
 * Styled with Tailwind token classes: the app's CSS must `@source` this package.
 */

// Trends and comparisons
export {
    AreaChart,
    BarChart,
    ComboChart,
    LineChart,
    type Annotation,
    type CartesianChartProps,
    type RangeSelectPayload,
    type ReferenceArea,
    type ReferenceLine,
    type TooltipContext,
    type TooltipSeriesValue,
    type ValueClickPayload,
} from './react/CartesianChart';
export { WaterfallChart, type WaterfallChartProps } from './react/WaterfallChart';

// Relationships and profiles
export {
    ScatterChart,
    type ScatterChartProps,
    type ScatterGroupConfig,
    type ScatterPointPayload,
} from './react/ScatterChart';
export { RadarChart, type RadarChartProps } from './react/RadarChart';

// Composition and progress
export { DonutChart, type DonutChartProps } from './react/DonutChart';
export { CategoryBar, type CategoryBarItem, type CategoryBarProps } from './react/CategoryBar';
export { FunnelChart, type FunnelChartProps, type FunnelStepInput } from './react/FunnelChart';
export { SankeyChart, type SankeyChartProps } from './react/SankeyChart';
export { TreemapChart, type TreemapChartProps } from './react/TreemapChart';
export { ProgressCircle, type ProgressCircleProps } from './react/ProgressCircle';

// Rankings and density
export { BarList, type BarListItem, type BarListProps } from './react/BarList';
export { Heatmap, type HeatmapProps } from './react/Heatmap';
export { CalendarHeatmap, type CalendarHeatmapProps } from './react/CalendarHeatmap';

// Status and small multiples
export { Tracker, type TrackerItem, type TrackerProps } from './react/Tracker';
export { Sparkline, type SparklineProps } from './react/Sparkline';
export { Delta, type DeltaProps } from './react/Delta';

// Building blocks
export { ChartLegend, type ChartLegendProps, type LegendItem } from './react/ChartLegend';
export { ChartSkeleton, type ChartSkeletonProps } from './react/ChartSkeleton';
export {
    ChartTooltip,
    TooltipContent,
    type ChartTooltipProps,
    type TooltipContentProps,
    type TooltipItem,
} from './react/ChartTooltip';
export { useElementWidth, useReveal } from './react/utils';

// Export
export { chartToSvg, copyText, downloadText, exportChart, type ExportChartOptions } from './react/export';
