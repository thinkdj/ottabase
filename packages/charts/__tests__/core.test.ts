import { describe, expect, it } from 'vitest';
import * as root from '../src';
import {
    arcPath,
    bucketKey,
    chartColor,
    computeCalendar,
    computeCartesian,
    computeFlowFunnel,
    computeFunnel,
    computeSankey,
    computeHeatmap,
    computeDonut,
    dateFormatter,
    delta,
    fillTimeSeries,
    formatCompact,
    formatDelta,
    formatPercent,
    groupOther,
    linearScale,
    linePath,
    nearestIndex,
    niceTicks,
    parseDate,
    pivot,
    resolveSeries,
    toNumber,
    toneColor,
    toCsv,
} from '../src';

describe('headless boundary', () => {
    it('root entry exports no rendered UI', () => {
        // Mobile and Workers import the root; a component here would drag React DOM in.
        for (const name of ['LineChart', 'BarChart', 'AreaChart', 'DonutChart', 'Sparkline', 'BarList']) {
            expect(root).not.toHaveProperty(name);
        }
    });
});

describe('colour', () => {
    it('maps slots to brand tokens and never cycles past 8', () => {
        expect(chartColor(1)).toBe('hsl(var(--chart-1))');
        expect(chartColor(12)).toBe('hsl(var(--chart-8))');
        expect(toneColor('danger')).toBe('hsl(var(--destructive))');
        expect(toneColor('red')).toBe(toneColor('danger')); // @ottabase/ui Tone names work too
    });

    it('assigns free slots in order, skipping explicitly claimed ones', () => {
        const s = resolveSeries([{ key: 'a', color: 1 }, 'b', { key: 'c', color: 'success' }, 'd'], 'line');
        expect(s.map((x) => x.color)).toEqual([
            'hsl(var(--chart-1))',
            'hsl(var(--chart-2))',
            'hsl(var(--success))',
            'hsl(var(--chart-3))',
        ]);
        expect(s[1]?.label).toBe('b');
    });
});

describe('scales', () => {
    it('niceTicks covers the data with round steps', () => {
        expect(niceTicks(0, 240, 4)).toEqual([0, 50, 100, 150, 200, 250]); // same as d3.ticks
        expect(niceTicks(0, 240, 2)).toEqual([0, 100, 200, 300]);
        expect(niceTicks(0, 0.3, 3)).toEqual([0, 0.1, 0.2, 0.3]);
        expect(niceTicks(-12, 38, 5)).toEqual([-20, -10, 0, 10, 20, 30, 40]);
        expect(niceTicks(0, 0)).toEqual([0, 1]);
        const flat = niceTicks(50, 50);
        expect(flat[0]).toBeLessThan(50);
        expect(flat[flat.length - 1]).toBeGreaterThan(50);
    });

    it('linearScale maps and inverts', () => {
        const s = linearScale([0, 100], [200, 0]);
        expect(s(25)).toBe(150);
        expect(s.invert(150)).toBe(25);
    });

    it('nearestIndex finds the closest position', () => {
        expect(nearestIndex([0, 10, 20, 30], 14)).toBe(1);
        expect(nearestIndex([0, 10, 20, 30], 16)).toBe(2);
        expect(nearestIndex([0, 10], -5)).toBe(0);
        expect(nearestIndex([], 5)).toBe(-1);
    });
});

describe('shapes', () => {
    it('breaks lines at nulls instead of dropping to zero', () => {
        const d = linePath([{ x: 0, y: 0 }, { x: 10, y: 5 }, null, { x: 30, y: 5 }, { x: 40, y: 0 }]);
        expect(d).toBe('M0 0L10 5M30 5L40 0');
    });

    it('monotone curves never overshoot the data', () => {
        const pts = [
            { x: 0, y: 0 },
            { x: 10, y: 100 },
            { x: 20, y: 100 },
            { x: 30, y: 0 },
        ];
        const d = linePath(pts, 'monotone');
        const ys = [...d.matchAll(/-?\d+(\.\d+)?/g)].map((m) => Number(m[0])).filter((_, i) => i % 2 === 1);
        expect(Math.max(...ys)).toBeLessThanOrEqual(100);
        expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    });

    it('draws a full ring as two arcs', () => {
        const d = arcPath(50, 50, 40, 30, 0, Math.PI * 2);
        expect(d.match(/M/g)).toHaveLength(2);
    });
});

describe('format', () => {
    it('formats compact numbers and ratios', () => {
        expect(formatCompact(12_400)).toBe('12.4K');
        expect(formatPercent(0.125)).toBe('12.5%');
    });

    it('computes deltas, with no ratio against a zero baseline', () => {
        expect(delta(120, 100)).toEqual({ change: 20, ratio: 0.2, direction: 'up' });
        expect(formatDelta(delta(80, 100), 0)).toBe('−20%');
        expect(formatDelta(delta(5, 0))).toBe('New');
        expect(formatDelta(delta(0, 0))).toBe('0%');
    });

    it('formats date labels in UTC', () => {
        expect(dateFormatter('day', { locale: 'en-US' })('2026-10-25')).toBe('Oct 25');
        expect(dateFormatter('day')('not a date')).toBe('not a date');
    });
});

describe('data shaping', () => {
    it('toNumber treats blanks and junk as gaps', () => {
        expect(toNumber('12')).toBe(12);
        expect(toNumber('')).toBeNull();
        expect(toNumber(null)).toBeNull();
        expect(toNumber(Number.NaN)).toBeNull();
    });

    it('reads zone-less SQL timestamps as UTC', () => {
        expect(parseDate('2026-10-25 23:30:00').toISOString()).toBe('2026-10-25T23:30:00.000Z');
        expect(bucketKey('2026-10-25 23:30:00', 'day')).toBe('2026-10-25');
        expect(bucketKey('2026-10-29', 'week')).toBe('2026-10-26'); // Thursday → Monday
        expect(bucketKey('2026-10-25T14:59:00Z', 'hour')).toBe('2026-10-25T14:00Z');
    });

    it('fillTimeSeries fills quiet days and merges duplicates', () => {
        const out = fillTimeSeries(
            [
                { day: '2026-10-01', clicks: 3 },
                { day: '2026-10-01 18:00', clicks: 2 },
                { day: '2026-10-04', clicks: 1 },
            ],
            { index: 'day', step: 'day', fill: { clicks: 0 } },
        );
        expect(out).toEqual([
            { day: '2026-10-01', clicks: 5 },
            { day: '2026-10-02', clicks: 0 },
            { day: '2026-10-03', clicks: 0 },
            { day: '2026-10-04', clicks: 1 },
        ]);
        expect(fillTimeSeries([], { index: 'day', step: 'day' })).toEqual([]);
        expect(
            fillTimeSeries([], { index: 'm', step: 'month', start: '2026-01-15', end: '2026-03-01' }).map((r) => r.m),
        ).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
    });

    it('pivot turns long rows wide', () => {
        const { data, keys } = pivot(
            [
                { day: 'Mon', country: 'US', n: 3 },
                { day: 'Mon', country: 'DE', n: 1 },
                { day: 'Tue', country: 'US', n: 2 },
                { day: 'Tue', country: 'US', n: 1 },
            ],
            { index: 'day', column: 'country', value: 'n' },
        );
        expect(keys).toEqual(['US', 'DE']);
        expect(data).toEqual([
            { day: 'Mon', US: 3, DE: 1 },
            { day: 'Tue', US: 3, DE: 0 },
        ]);
    });

    it('groupOther folds the tail', () => {
        const items = [1, 9, 3, 7, 5].map((value, i) => ({ name: `n${i}`, value }));
        expect(groupOther(items, 2)).toEqual([
            { name: 'n1', value: 9 },
            { name: 'n3', value: 7 },
            { name: 'Other', value: 9 },
        ]);
        // One item past the limit is shown, not folded into an "Other" of one.
        expect(groupOther(items, 4)).toHaveLength(5);
    });
});

describe('computeCartesian', () => {
    const data = [
        { d: 'Mon', a: 10, b: 30 },
        { d: 'Tue', a: 20, b: 20 },
        { d: 'Wed', a: null, b: 10 },
    ];

    it('lays out lines edge to edge and keeps gaps', () => {
        const l = computeCartesian({
            data,
            index: 'd',
            series: resolveSeries(['a', 'b'], 'line'),
            width: 300,
            height: 150,
        });
        expect(l.x.centers[0]).toBe(l.plot.x);
        expect(l.x.centers[2]).toBe(l.plot.x + l.plot.width);
        expect(l.series[0]?.points[2]).toBeNull();
        expect(l.series[0]?.line).not.toContain('NaN');
        expect(l.yTicks[0]?.value).toBe(0);
    });

    it('stacks bars with a 2px gap and a domain that fits the totals', () => {
        const l = computeCartesian({
            data,
            index: 'd',
            series: resolveSeries(['a', 'b'], 'bar'),
            width: 300,
            height: 150,
            stack: 'stacked',
        });
        expect(l.y.domain[1]).toBeGreaterThanOrEqual(40);
        const [a, b] = [l.series[0]?.bars[0], l.series[1]?.bars[0]];
        // b sits on a, 2px above it.
        expect(Math.round((a?.y ?? 0) - ((b?.y ?? 0) + (b?.height ?? 0)))).toBe(2);
        expect(a?.width).toBe(b?.width);
    });

    it('groups bars side by side when not stacked', () => {
        const l = computeCartesian({
            data,
            index: 'd',
            series: resolveSeries(['a', 'b'], 'bar'),
            width: 300,
            height: 150,
        });
        const [a, b] = [l.series[0]?.bars[0], l.series[1]?.bars[0]];
        expect((b?.x ?? 0) - ((a?.x ?? 0) + (a?.width ?? 0))).toBeCloseTo(2);
    });

    it('percent stacks to shares of the row total', () => {
        const l = computeCartesian({
            data,
            index: 'd',
            series: resolveSeries(['a', 'b'], 'area'),
            width: 300,
            height: 150,
            stack: 'percent',
        });
        expect(l.series[0]?.values[0]).toBeCloseTo(0.25);
        expect(l.series[1]?.values[0]).toBeCloseTo(0.75);
        expect(l.y.domain).toEqual([0, 1]);
        expect(l.yTicks[l.yTicks.length - 1]?.label).toBe('100%');
    });

    it('draws negative bars down from zero', () => {
        const l = computeCartesian({
            data: [{ d: 'x', v: -5 }],
            index: 'd',
            series: resolveSeries(['v'], 'bar'),
            width: 100,
            height: 100,
        });
        const bar = l.series[0]?.bars[0];
        expect(bar?.y).toBeCloseTo(l.y(0));
        expect(l.y.domain[0]).toBeLessThan(0);
    });

    it('thins x labels to fit and honours pinned bounds', () => {
        const many = Array.from({ length: 60 }, (_, i) => ({ d: `2026-10-${i}`, v: i }));
        const l = computeCartesian({
            data: many,
            index: 'd',
            series: resolveSeries(['v'], 'line'),
            width: 320,
            height: 150,
            maxValue: 75,
        });
        expect(l.xTicks.length).toBeLessThan(many.length);
        expect(l.xTicks.length).toBeGreaterThan(1);
        expect(l.y.domain[1]).toBe(75);
    });
});

describe('computeDonut', () => {
    it('splits the turn by share and skips empty slices', () => {
        const l = computeDonut({
            items: [
                { name: 'a', value: 3, color: 'red' },
                { name: 'b', value: 1, color: 'blue' },
                { name: 'c', value: 0, color: 'green' },
            ],
            size: 100,
        });
        expect(l.total).toBe(4);
        expect(l.segments).toHaveLength(2);
        expect(l.segments[0]?.share).toBe(0.75);
        // Gap between segments: a ends before b starts.
        expect(l.segments[0]?.endAngle).toBeLessThan(l.segments[1]?.startAngle ?? 0);
    });
});

describe('computeCalendar', () => {
    it('lays out whole weeks ending on the given day', () => {
        const l = computeCalendar({
            data: [
                { date: '2026-10-25', value: 8 },
                { date: '2026-10-24', value: 2 },
            ],
            end: '2026-10-25',
            weeks: 4,
        });
        const last = l.cells[l.cells.length - 1];
        expect(last?.date).toBe('2026-10-25');
        expect(last?.level).toBe(4);
        expect(l.cells.find((c) => c.date === '2026-10-24')?.level).toBe(1);
        expect(l.columns).toBe(4);
        expect(l.cells[0]?.row).toBe(0);
    });

    it('never prints two month labels on top of each other', () => {
        const l = computeCalendar({ data: [], end: '2026-10-25', weeks: 53 });
        for (let i = 1; i < l.months.length; i++) {
            expect((l.months[i]?.col ?? 0) - (l.months[i - 1]?.col ?? 0)).toBeGreaterThanOrEqual(3);
        }
        expect(l.months.length).toBeGreaterThanOrEqual(11);
    });
});

describe('dual axis and gaps', () => {
    const data = [
        { d: 'Mon', signups: 40, revenue: 1200 },
        { d: 'Tue', signups: null, revenue: 1800 },
        { d: 'Wed', signups: 55, revenue: 1500 },
    ];

    it('scales a right-axis series on its own domain', () => {
        const l = computeCartesian({
            data,
            index: 'd',
            series: resolveSeries(['signups', { key: 'revenue', type: 'line', axis: 'right' }], 'bar'),
            width: 320,
            height: 160,
            rightAxis: { valueFormatter: (v) => `$${v}` },
        });
        expect(l.y2).toBeDefined();
        expect(l.y2?.domain[1]).toBeGreaterThanOrEqual(1800);
        expect(l.y.domain[1]).toBeLessThan(1000);
        expect(l.y2Ticks[l.y2Ticks.length - 1]?.label).toMatch(/^\$/);
        // The right axis labels take space on the right.
        expect(l.plot.x + l.plot.width).toBeLessThan(320 - 20);
    });

    it('connectNulls bridges a gap, and a plain line keeps it', () => {
        const series = resolveSeries(['signups'], 'line');
        const gap = computeCartesian({ data, index: 'd', series, width: 300, height: 150 });
        const joined = computeCartesian({ data, index: 'd', series, width: 300, height: 150, connectNulls: true });
        expect(gap.series[0]?.line.match(/M/g)).toHaveLength(2);
        expect(joined.series[0]?.line.match(/M/g)).toHaveLength(1);
    });
});

describe('computeFunnel', () => {
    it('narrows by share and reports conversion per step', () => {
        const l = computeFunnel({
            items: [
                { name: 'Visit', value: 1000, color: 'a' },
                { name: 'Signup', value: 250, color: 'a' },
                { name: 'Pay', value: 50, color: 'a' },
            ],
            width: 400,
        });
        expect(l.steps[0]?.width).toBe(400);
        expect(l.steps[1]?.width).toBe(100);
        expect(l.steps[1]?.conversion).toBe(0.25);
        expect(l.steps[2]?.conversion).toBe(0.2);
        expect(l.steps[2]?.dropOff).toBeCloseTo(0.8);
        expect(l.steps[2]?.share).toBe(0.05);
        // Bars are centred.
        expect(l.steps[1]?.x).toBe(150);
    });
});

describe('computeFlowFunnel', () => {
    it('stacks series per column and shares are of the first step', () => {
        const l = computeFlowFunnel({
            steps: [
                { name: 'Seen', values: [60, 40] },
                { name: 'Cart', values: [20, 5] },
                { name: 'Buy', values: [4, 1] },
            ],
            series: [
                { key: 'a', color: 'red' },
                { key: 'b', color: 'blue' },
            ],
            width: 300,
            height: 100,
        });
        expect(l.columns.map((c) => c.x)).toEqual([0, 100, 200]);
        expect(l.columns[1]?.value).toBe(25);
        expect(l.columns[1]?.share).toBe(0.25);
        expect(l.columns[2]?.conversion).toBe(0.2);
        // The first step fills the height: series a spans 0-60, b 60-100, centred.
        expect(l.bands[0]?.path.startsWith('M0,0C')).toBe(true);
        expect(l.bands[1]?.path).toMatch(/^M0,60C/);
        expect(l.bands[1]?.path).toMatch(/Z$/);
    });
});

describe('computeSankey', () => {
    const color = 'red';
    const l = computeSankey({
        nodes: ['Ads', 'Search', 'Site', 'Bounce', 'Buy'].map((name) => ({ name, color })),
        links: [
            { source: 'Ads', target: 'Site', value: 30 },
            { source: 'Search', target: 'Site', value: 70 },
            { source: 'Site', target: 'Bounce', value: 60 },
            { source: 'Site', target: 'Buy', value: 40 },
            { source: 'Search', target: 'Buy', value: 10 },
            { source: 'Buy', target: 'Ads', value: 5 },
        ],
        width: 400,
        height: 100,
        nodePadding: 0,
    });
    const node = (name: string) => l.nodes.find((n) => n.name === name)!;

    it('columns by longest path, sinks on the right, cycles dropped', () => {
        expect(l.columns).toBe(3);
        expect(['Ads', 'Search', 'Site', 'Bounce', 'Buy'].map((n) => node(n).depth)).toEqual([0, 0, 1, 2, 2]);
        expect(node('Bounce').x).toBe(390);
        expect(l.links).toHaveLength(5);
    });

    it('sizes nodes by their larger side on one scale', () => {
        expect(node('Search').value).toBe(80);
        expect(node('Buy').value).toBe(50);
        // The first column (110 units) fills 100px; every column uses the same px per unit.
        expect(node('Ads').height + node('Search').height).toBeCloseTo(100);
        expect(node('Site').height).toBeCloseTo((100 / 110) * 100);
    });
});

describe('computeHeatmap', () => {
    it('fills the matrix and scales intensity between min and max', () => {
        const l = computeHeatmap({
            data: [
                { h: '9', d: 'Mon', value: 2 },
                { h: '10', d: 'Mon', value: 10 },
                { h: '9', d: 'Tue', value: 6 },
            ],
            x: 'h',
            y: 'd',
            levels: 4,
        });
        expect(l.xDomain).toEqual(['9', '10']);
        expect(l.yDomain).toEqual(['Mon', 'Tue']);
        expect(l.cells).toHaveLength(4);
        const missing = l.cells.find((c) => c.x === '10' && c.y === 'Tue');
        expect(missing?.value).toBeNull();
        expect(l.cells.find((c) => c.x === '10' && c.y === 'Mon')?.intensity).toBe(1);
        expect(l.cells.find((c) => c.x === '9' && c.y === 'Mon')?.level).toBe(1); // the minimum still shows
    });
});

describe('half donut and csv', () => {
    it('sweeps a half donut over the top half only', () => {
        const l = computeDonut({
            items: [
                { name: 'a', value: 1, color: 'x' },
                { name: 'b', value: 1, color: 'y' },
            ],
            size: 100,
            startAngle: -90,
            endAngle: 90,
        });
        expect(l.height).toBeLessThan(100);
        expect(l.segments[1]?.endAngle).toBeCloseTo(Math.PI / 2, 1);
        expect(l.track).toMatch(/^M/);
    });

    it('toCsv quotes what needs quoting', () => {
        const csv = toCsv(
            [
                { day: '2026-10-25', page: '/a,b', n: 3 },
                { day: '2026-10-26', page: 'say "hi"', n: null },
            ],
            [{ key: 'day', label: 'Day' }, { key: 'page' }, { key: 'n' }],
        );
        expect(csv.split('\r\n')).toEqual(['Day,page,n', '2026-10-25,"/a,b",3', '2026-10-26,"say ""hi""",']);
    });

    it('toCsv defuses spreadsheet formulas but keeps signed numbers', () => {
        const csv = toCsv([{ a: '=HYPERLINK("x")', b: '@sum', c: -5, d: '-5', e: '+1 555' }]);
        expect(csv.split('\r\n')[1]).toBe(`"'=HYPERLINK(""x"")",'@sum,-5,-5,'+1 555`);
    });
});

describe('bad values', () => {
    it('funnels and flows treat NaN, Infinity and negatives as zero', () => {
        const color = 'red';
        const f = computeFunnel({
            items: [
                { name: 'a', value: 100, color },
                { name: 'b', value: Number.NaN, color },
                { name: 'c', value: 400, color },
            ],
            width: 100,
        });
        expect(f.steps.map((s) => s.width)).toEqual([100, 0, 100]);
        const flow = computeFlowFunnel({
            steps: [{ name: 'a', values: [Number.POSITIVE_INFINITY, 10] }],
            series: [
                { key: 'x', color },
                { key: 'y', color },
            ],
            width: 100,
            height: 50,
        });
        expect(flow.columns[0]?.value).toBe(10);
        expect(flow.bands.every((b) => !b.path.includes('NaN'))).toBe(true);
        const s = computeSankey({
            nodes: [
                { name: 'a', color },
                { name: 'b', color },
            ],
            links: [
                { source: 'a', target: 'b', value: Number.NaN },
                { source: 'a', target: 'zz', value: 5 },
            ],
            width: 100,
            height: 50,
        });
        expect(s.links).toHaveLength(0);
    });
});
