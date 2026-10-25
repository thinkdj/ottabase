# @ottabase/charts

Charts for Ottabase apps, drawn to the Design System v1 chart spec: 2px lines, square-ended bars with 2px gaps, a
recessive grid, one y-axis (two when a second unit earns it), series colours by role. No chart library: a small headless
geometry engine computes every coordinate and path, and the `/react` entry draws it as SVG. Colours come from the brand
engine's `--chart-1` … `--chart-8` tokens, so charts follow the active theme and dark mode with no props.

- **Headless root** (`@ottabase/charts`): scales, ticks, path generators, stacking, layouts, formatters, data shaping,
  CSV. No DOM, no React. Safe in a Worker and in React Native.
- **Rendered** (`@ottabase/charts/react`): twelve components, one tooltip system, keyboard and touch support, reveal
  transitions, loading and empty states, PNG/SVG export.
- Zero runtime dependencies. React is an optional peer, needed only for `/react`.

Live demo with code for every example: `/demo/charts` in otta-web.

## Install

```json
{ "dependencies": { "@ottabase/charts": "workspace:*" } }
```

The rendered charts use Tailwind token classes. Add the package to the app's Tailwind sources (otta-web already does):

```css
/* src/styles/globals.css */
@source '../../../../packages/charts/src';
```

## Pick a chart

| Question                   | Component                    | Note                                                       |
| -------------------------- | ---------------------------- | ---------------------------------------------------------- |
| How is it trending?        | `LineChart`, `AreaChart`     | `Sparkline` inside a `Stat` tile when space is tight       |
| How do categories compare? | `BarChart`                   | `orientation="horizontal"` for long labels; `stack` to sum |
| Two units on one timeline? | `ComboChart`                 | `axis: 'right'` on the second unit                         |
| What is the mix?           | `DonutChart`, `CategoryBar`  | Tones for a status breakdown, slots for categories         |
| Where do people drop off?  | `FunnelChart`                | Steps in order, largest first; `variant="flow"` by channel |
| Where does it flow?        | `SankeyChart`                | Nodes and weighted links; sources left, sinks right        |
| What ranks highest?        | `BarList`                    | Reads like a table, compares like a chart                  |
| When is it busy?           | `Heatmap`, `CalendarHeatmap` | Hour × weekday, or one cell a day                          |
| Is it up?                  | `Tracker`                    | One bar per period, a tone per state                       |
| How full is it?            | `ProgressCircle`             | A quota, a goal, storage                                   |
| Did it change?             | `Delta`                      | In a `Stat` foot; `invert` when down is good               |

## Cartesian charts

`LineChart`, `AreaChart`, `BarChart` and `ComboChart` share one API: rows, an `index` column for the x axis, and the
`series` to draw. A series is a key, or a config with a label, colour, (combo only) type and axis.

```tsx
import { dateFormatter } from '@ottabase/charts';
import { LineChart } from '@ottabase/charts/react';

const data = [
    { day: '2026-10-23', requests: 182, jobs: 60 },
    { day: '2026-10-24', requests: 204, jobs: 72 },
    { day: '2026-10-25', requests: 171, jobs: 58 },
];

export function Traffic() {
    return (
        <LineChart
            data={data}
            index="day"
            series={[
                { key: 'requests', label: 'Requests' },
                { key: 'jobs', label: 'Queue jobs' },
            ]}
            indexFormatter={dateFormatter('day')}
            title="Requests and queue jobs"
        />
    );
}
```

### Data and axes

| Prop                                     | Default      | Notes                                                                    |
| ---------------------------------------- | ------------ | ------------------------------------------------------------------------ |
| `height`                                 | `240`        | Width fills the container (ResizeObserver); pass `width` to fix it       |
| `orientation`                            | `'vertical'` | `'horizontal'` runs categories down the left (bars)                      |
| `stack`                                  | `'none'`     | `'stacked'` sums bars/areas, `'percent'` shows each row's mix (0-100%)   |
| `curve`                                  | `'linear'`   | `'monotone'` (smooth, never overshoots) or `'step'`                      |
| `connectNulls`                           | `false`      | Draw across missing values instead of leaving a gap                      |
| `valueFormatter`                         | compact      | `12.4K`. Use `formatNumber`, `formatPercent`, `currencyFormatter('EUR')` |
| `indexFormatter`                         | identity     | x labels and tooltip title; `dateFormatter('day' \| 'hour' \| 'month')`  |
| `rightAxis`                              |              | `{ valueFormatter, title, minValue, maxValue }` for `axis: 'right'`      |
| `xTitle` / `yTitle`                      |              | Axis titles                                                              |
| `minValue` / `maxValue` / `autoMinValue` |              | Pin the y axis, or start lines at the data instead of zero               |
| `yTickCount`                             | `4`          | A hint; ticks land on round numbers                                      |

### Marks and annotations

| Prop             | Default  | Notes                                                                             |
| ---------------- | -------- | --------------------------------------------------------------------------------- |
| `dots`           | `'last'` | Line markers: `'none'`, `'last'` (the latest reading), `'all'`                    |
| `showValues`     | `false`  | `true` labels every bar and point, `'last'` the latest; stacks label their totals |
| `referenceLines` | `[]`     | `[{ value: 200, label: 'Capacity', color: 'danger', axis: 'left' }]`, dashed      |
| `referenceAreas` | `[]`     | `[{ from: '2026-10-24', to: '2026-10-25', label: 'Weekend' }]`, a shaded band     |
| `annotations`    | `[]`     | `[{ index: '2026-10-20', label: 'v2.4 deploy', color: 'info' }]`, a marked row    |
| `animate`        | `true`   | Reveal on mount; collapses to nothing under `prefers-reduced-motion`              |

### Interaction and states

| Prop                                   | Default     | Notes                                                                           |
| -------------------------------------- | ----------- | ------------------------------------------------------------------------------- |
| `showTooltip`                          | `true`      | Pointer, or focus the chart and use ← → Home End; Esc clears                    |
| `renderTooltip`                        |             | `(ctx) => node`; `TooltipContent` keeps the house style                         |
| `showLegend`                           | >1 series   | Keys toggle series, hovering a key emphasises it; the last one cannot be hidden |
| `legendPosition`                       | `'bottom'`  | or `'top'`                                                                      |
| `onValueClick`                         |             | `({ row, index }) => …`, by click or Enter                                      |
| `onRangeSelect`                        |             | Drag across rows, or Shift+arrows then Enter: `({ start, end, rows }) => …`     |
| `range`                                |             | Controlled selection `[start, end]`, `null` to clear                            |
| `loading`                              | `false`     | A skeleton in place of the plot                                                 |
| `radius`                               | `'sm'`      | Bar corners: `none` 0, `sm` 2px, `md` 4px, `lg` 8px                             |
| `emptyText`                            | `'No data'` | Shown when `data` is empty                                                      |
| `title`                                |             | Accessible name; also captions the screen-reader data table                     |
| `showXAxis` / `showYAxis` / `showGrid` | `true`      |                                                                                 |

```tsx
// Stacked by status: a status breakdown takes its tones, not categorical slots.
<BarChart
    data={jobs}
    index="day"
    series={[
        { key: 'succeeded', label: 'Succeeded', color: 'success' },
        { key: 'retried', label: 'Retried', color: 'warning' },
        { key: 'failed', label: 'Failed', color: 'danger' },
    ]}
    stack="stacked"
    referenceLines={[{ value: 200, label: 'Capacity' }]}
    onRangeSelect={({ rows }) => setSelection(rows)}
/>

// Long labels down the side, totals printed.
<BarChart data={tickets} index="area" series={['open', 'closed']} orientation="horizontal" stack="stacked" showValues />

// Two units: signups on the left axis, revenue on the right.
<ComboChart
    data={signups}
    index="day"
    series={['signups', { key: 'revenue', label: 'Revenue', type: 'line', axis: 'right' }]}
    rightAxis={{ valueFormatter: currencyFormatter('USD', true), title: 'Revenue' }}
/>
```

### Colour

`color` is a slot number (`1`-`8`), a tone (`'success'`, `'warning'`, `'danger'`, `'info'`, `'smoke'`, or the
`@ottabase/ui` `Tone` names `'green'`, `'amber'`, `'red'`, `'blue'`, `'neutral'`, `'brand'`) or any CSS colour. Omitted,
a series takes the next slot no other series claimed. Slots are assigned in order and **never cycle**: past eight the
colour stays on slot 8 (the neutral), so fold long tails with `groupOther()` first. Hiding a series in the legend never
recolours the others.

## Composition and progress

```tsx
import { CategoryBar, DonutChart, FunnelChart, ProgressCircle, SankeyChart } from '@ottabase/charts/react';

<DonutChart
    data={[
        { name: 'Active', value: 9 },
        { name: 'Expired', value: 1 },
    ]}
    colors={{ Active: 'success', Expired: 'danger' }}
    label="packages"
/>;
<DonutChart data={plans} variant="half" sort />;

<CategoryBar
    data={[
        { name: 'Images', value: 18 },
        { name: 'Video', value: 11 },
    ]}
    total={50}
    marker={{ value: 45, label: 'Soft limit' }}
/>;

<FunnelChart
    data={[
        { name: 'Visited', value: 12400 },
        { name: 'Signed up', value: 3100 },
        { name: 'Paid', value: 420 },
    ]}
/>;
<FunnelChart
    variant="flow"
    series={[
        { key: 'direct', label: 'Direct' },
        { key: 'ads', label: 'Ads' },
    ]}
    data={[
        { name: 'Impressions', breakdown: { direct: 6000, ads: 4100 } },
        { name: 'Buy', breakdown: { direct: 720, ads: 80 } },
    ]}
/>;

<SankeyChart
    data={{
        nodes: [{ name: 'Search' }, { name: 'Pricing' }, { name: 'Signed up' }],
        links: [
            { source: 'Search', target: 'Pricing', value: 3200 },
            { source: 'Pricing', target: 'Signed up', value: 1900 },
        ],
    }}
/>;

<ProgressCircle value={38} max={50} title="Storage used" />;
```

- **DonutChart**: `index`/`category` default to `name`/`value`; `colors` by name or position; `variant` `donut` | `pie`
  | `half`; `sort`; `maxSlices` (default 8) folds the smallest into "Other"; the centre shows the total, or the hovered
  slice; `renderTooltip`, `onSliceClick`; hovering a legend key highlights its slice.
- **CategoryBar**: one bar split by category; `total` larger than the sum leaves free space; `marker` draws a tick.
- **FunnelChart**: steps largest first; prints each step's count and its conversion from the previous one;
  `onStepClick`. `variant="flow"`: one column per step (count, share of the first step) with bands easing between steps,
  split by `series` from each step's `breakdown`; `height` sets the band area.
- **SankeyChart**: `nodes` and `links` (`source`/`target` by node name); columns by longest path, sinks on the right; a
  link that closes a cycle is dropped. Hover a node to trace its bands, or a band for its value.
- **ProgressCircle**: a `meter`; `variant="half"` for a gauge; children replace the percentage in the centre.

## Rankings and density

```tsx
import { BarList, CalendarHeatmap, Heatmap } from '@ottabase/charts/react';

<BarList labels={['Page', 'Visits']} showPercent data={pages} renderName={(p) => <Link to={p.name}>{p.name}</Link>} />;

<Heatmap data={hourly} x="hour" y="day" xDomain={hours} yDomain={weekdays} onCellClick={(c) => filter(c)} />;

<CalendarHeatmap data={activity} unit="events" onCellClick={(c) => openDay(c.date)} />;
```

- **BarList**: sorted descending; `renderName`, `onSelect`, `limit`, `labels`, `icon` per row, `showPercent`, `maxValue`
  to size bars against a grand total.
- **Heatmap**: long rows (`{ x, y, value }`) to a matrix; `xDomain`/`yDomain` fix the order and fill gaps; `showValues`
  prints the number when the cell is wide enough.
- **CalendarHeatmap**: one cell per UTC day for `weeks` (default 53) ending `end` (default today).

## Status and small multiples

```tsx
import { Delta, Sparkline, Tracker } from '@ottabase/charts/react';
import { Stat } from '@ottabase/ui';

<Tracker
    data={[
        { color: 'success', tooltip: 'Oct 24', detail: '100% up' },
        { color: 'danger', tooltip: 'Oct 25', detail: 'Outage · 42 min' },
    ]}
/>;

<Stat
    label="Requests"
    value="1.2K"
    foot={
        <>
            <Delta current={1240} previous={1100} />
            <Sparkline data={[3, 5, 4, 8, 7, 9]} className="flex-1" height={24} />
        </>
    }
/>;
```

- **Tracker**: one bar per period, coloured by tone, with a two-line tooltip; `onItemClick`.
- **Sparkline**: `data` may be plain numbers; `type` line, area or bar; no axes. Give it a `title` or it is decorative.
- **Delta**: `▲ 12.5%` in the tone of the change; `invert` when down is good (errors, latency).

## Export

```ts
import { toCsv } from '@ottabase/charts';
import { copyText, downloadText, exportChart } from '@ottabase/charts/react';

await exportChart(chartRef.current, { format: 'png', filename: 'signups', scale: 2 }); // or 'svg'
downloadText(toCsv(rows, [{ key: 'day', label: 'Day' }, { key: 'signups' }]), 'signups.csv');
await copyText(toCsv(rows));
```

`exportChart` inlines every computed fill, stroke and font onto a clone of the `<svg>` (the theme's CSS variables do not
travel), adds the page background, and saves a PNG (rasterised at `scale`×) or the SVG itself.

## Shaping data (headless)

Analytics queries return only the buckets that had events. Chart them raw and the quiet days vanish.

```ts
import { fillTimeSeries, groupOther, pivot } from '@ottabase/charts';

// One row per day, zeros for the quiet ones. Zone-less SQL timestamps are read as UTC.
const daily = fillTimeSeries(rows, { index: 'day', step: 'day', fill: { clicks: 0 } });

// Long to wide: { day, country, clicks } → { day, US: 3, DE: 1 }, plus the series keys.
const { data, keys } = pivot(rows, { index: 'day', column: 'country', value: 'clicks' });

// Top 7 plus "Other".
const slices = groupOther(countries, 7);
```

Also exported: `bucketKey`, `bucketStart`, `parseDate`, `toNumber`, `delta`, `formatDelta`, `formatCompact`,
`formatNumber`, `formatPercent`, `formatCurrency`, `currencyFormatter`, `dateFormatter`, `toCsv`.

## Geometry engine (headless)

Everything the React components draw comes from pure functions. Use them for a custom chart, a native renderer
(react-native-svg), or a server-rendered SVG in a Worker.

```ts
import { computeCartesian, resolveSeries } from '@ottabase/charts';

const layout = computeCartesian({
    data: [
        { day: 'Mon', a: 3 },
        { day: 'Tue', a: 5 },
    ],
    index: 'day',
    series: resolveSeries(['a'], 'line'),
    width: 320,
    height: 160,
});
// layout.plot, layout.yTicks, layout.y2Ticks, layout.xTicks (thinned to fit),
// layout.series[0].line (SVG `d`), layout.series[n].bars, layout.x.centers (hit-test with nearestIndex)
```

`computeDonut` (with `startAngle`/`endAngle` for gauges), `computeFunnel`, `computeFlowFunnel`, `computeSankey`,
`computeHeatmap` and `computeCalendar` return the same kind of plain geometry. Lower-level pieces: `niceTicks`,
`linearScale`, `bandLayout`, `pointLayout`, `nearestIndex`, `linePath`, `areaPath`, `arcPath`, `chartColor`,
`toneColor`, `CHART_CHROME`.

## Building blocks (`/react`)

`ChartTooltip` (a panel that stays inside its container), `TooltipContent` (title, swatched rows, footer), `ChartLegend`
(toggles, hover emphasis, row or column), `ChartSkeleton` (the loading placeholder the cartesian charts draw for
`loading`; use it in front of any other chart), `useElementWidth`, `useReveal`.

## Corners

Every chart takes `radius`: `none` (0), `sm` (2px), `md` (4px) or `lg` (8px). It rounds the marks: bars, heatmap and
calendar cells, funnel steps, Sankey nodes, donut slices, ProgressCircle ends, sparkline, tracker and CategoryBar bars.
The default is `sm` everywhere except BarList and FunnelChart, which default to `md` (big bars read square at 2px). The
flow funnel's bands have no corners. `MARK_RADII` holds the scale; use it on custom marks so they match. Legend and
tooltip swatches stay at `sm`, and chrome that is UI rather than data (tooltip panel, focus ring, empty frame) keeps the
app's own radius.

## Accessibility and motion

Each chart is a focusable group with an accessible name (`title`) and a visually hidden data table holding the same
numbers; the SVG is `aria-hidden`. The keyboard drives the tooltip and the range selection. Legend keys are toggle
buttons with `aria-pressed`; `ProgressCircle` is a `meter`. Colour never works alone: every series has a legend key or a
label. All motion runs on the design-system duration tokens, which `prefers-reduced-motion` collapses to zero.

## Testing

```bash
pnpm test --filter @ottabase/charts
```
