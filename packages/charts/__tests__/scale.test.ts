import { describe, expect, it } from 'vitest';
import {
    computeCartesian,
    computeHeatmap,
    computeRadar,
    computeSankey,
    computeScatter,
    computeTreemap,
    computeWaterfall,
    radarAxisAt,
    resolveSeries,
    sampleIndices,
    scatterIndex,
    spreadIndices,
    squarify,
} from '../src';

describe('large data', () => {
    const big = (n: number) =>
        Array.from({ length: n }, (_, i) => ({ t: String(i), v: i === 31_337 ? 9_999 : Math.sin(i / 50) * 100 }));

    it('sampleIndices keeps every column extreme and returns small inputs whole', () => {
        const col = [5, 1, 9, 3, 7, 2, 8, 4, null, 6, 0, 10];
        expect(sampleIndices([col], col.length, 3)).toHaveLength(col.length);
        const idx = sampleIndices([col], col.length, 2);
        // Per bucket: first, last, min, max, and the first gap.
        for (const i of [0, 5, 1, 2, 6, 11, 8, 10]) expect(idx).toContain(i);
        expect(idx).toEqual([...idx].sort((a, b) => a - b));
    });

    it('spreadIndices spans first to last', () => {
        expect(spreadIndices(10, 3)).toEqual([0, 5, 9]);
        expect(spreadIndices(2, 5)).toEqual([0, 1]);
    });

    it('a 50,000-row line keeps its spike and draws a fraction of the rows', () => {
        const data = big(50_000);
        const t0 = performance.now();
        const layout = computeCartesian({
            data,
            index: 't',
            series: resolveSeries(['v'], 'line'),
            width: 800,
            height: 240,
        });
        const ms = performance.now() - t0;
        expect(layout.sampled).toBe(true);
        expect(layout.drawn).toBeLessThan(5_000);
        expect(layout.series[0]?.points).toHaveLength(50_000);
        // The one 9,999 reading sets the axis, and the line reaches it.
        expect(layout.yTicks[layout.yTicks.length - 1]?.value).toBeGreaterThanOrEqual(9_999);
        const spike = layout.series[0]?.points[31_337];
        expect(layout.series[0]?.line).toContain(
            `${Math.round(spike!.x * 100) / 100} ${Math.round(spike!.y * 100) / 100}`,
        );
        expect(layout.xTicks.length).toBeLessThan(40);
        expect(ms).toBeLessThan(1_000);
    });

    it('50,000 bars become pixel columns', () => {
        const layout = computeCartesian({
            data: big(50_000),
            index: 't',
            series: resolveSeries(['v'], 'bar'),
            width: 800,
            height: 240,
        });
        const bars = layout.series[0]?.bars ?? [];
        expect(bars.length).toBeLessThan(5_000);
        expect(bars.every((b) => b.width >= 1)).toBe(true);
    });

    it('a small chart is not sampled', () => {
        const layout = computeCartesian({
            data: big(100),
            index: 't',
            series: resolveSeries(['v'], 'line'),
            width: 800,
            height: 240,
        });
        expect(layout.sampled).toBe(false);
        expect(layout.drawn).toBe(100);
    });

    it('sankey merges duplicate links and survives a long chain', () => {
        const nodes = Array.from({ length: 20_000 }, (_, i) => ({ name: `n${i}`, color: 'red' }));
        const links = nodes.slice(1).map((n, i) => ({ source: `n${i}`, target: n.name, value: 1 }));
        expect(computeSankey({ nodes, links, width: 800, height: 300 }).columns).toBe(20_000);
        const dup = computeSankey({
            nodes: [
                { name: 'a', color: 'red' },
                { name: 'b', color: 'red' },
            ],
            links: Array.from({ length: 50_000 }, () => ({ source: 'a', target: 'b', value: 2 })),
            width: 800,
            height: 300,
        });
        expect(dup.links).toHaveLength(1);
        expect(dup.links[0]?.value).toBe(100_000);
    });

    it('heatmap domains come out in first-seen order', () => {
        const rows = Array.from({ length: 50_000 }, (_, i) => ({ x: String(i % 200), y: String(i % 7), value: 1 }));
        const layout = computeHeatmap({ data: rows, x: 'x', y: 'y' });
        expect(layout.xDomain).toHaveLength(200);
        expect(layout.xDomain[0]).toBe('0');
        expect(layout.cells).toHaveLength(1_400);
    });
});

describe('treemap', () => {
    const colorOf = (g: string | null, i: number) => `c${g ?? ''}${i}`;

    it('squarify fills the rectangle with near-square tiles', () => {
        const rects = squarify([6, 6, 4, 3, 2, 2, 1], { x: 0, y: 0, w: 600, h: 400 });
        expect(rects.reduce((s, r) => s + r.w * r.h, 0)).toBeCloseTo(240_000, 0);
        for (const r of rects) {
            expect(r.x).toBeGreaterThanOrEqual(-1e-6);
            expect(r.x + r.w).toBeLessThanOrEqual(600 + 1e-6);
            expect(r.y + r.h).toBeLessThanOrEqual(400 + 1e-6);
        }
        expect(Math.max(...rects.map((r) => Math.max(r.w / r.h, r.h / r.w)))).toBeLessThan(4);
    });

    it('areas follow values; zero and negative values are left out', () => {
        const layout = computeTreemap({
            items: [
                { name: 'a', value: 3 },
                { name: 'b', value: 1 },
                { name: 'z', value: 0 },
                { name: 'n', value: -5 },
            ],
            width: 400,
            height: 200,
            colorOf,
            gap: 0,
        });
        expect(layout.tiles.map((t) => t.name)).toEqual(['a', 'b']);
        const [a, b] = layout.tiles;
        expect((a!.width * a!.height) / (b!.width * b!.height)).toBeCloseTo(3, 5);
        expect(a!.share).toBeCloseTo(0.75);
    });

    it('groups lay out as blocks and 50,000 items fold into Other tiles that keep the total', () => {
        const items = Array.from({ length: 50_000 }, (_, i) => ({
            name: `file${i}`,
            value: 1 + (i % 97),
            group: `tenant${i % 5}`,
        }));
        const layout = computeTreemap({ items, width: 800, height: 400, colorOf, maxTiles: 100 });
        expect(layout.groups).toHaveLength(5);
        expect(layout.tiles.length).toBeLessThanOrEqual(105);
        expect(layout.folded).toBe(50_000 - 100);
        expect(layout.tiles.reduce((s, t) => s + t.value, 0)).toBe(layout.total);
        for (const t of layout.tiles) {
            const g = layout.groups.find((x) => x.name === t.group)!;
            expect(t.x).toBeGreaterThanOrEqual(g.x - 1e-6);
            expect(t.x + t.width).toBeLessThanOrEqual(g.x + g.width + 1e-6);
        }
    });

    it('groups past maxGroups fold into one Other group', () => {
        const items = Array.from({ length: 30 }, (_, i) => ({ name: `i${i}`, value: 30 - i, group: `g${i}` }));
        const layout = computeTreemap({ items, width: 400, height: 300, colorOf, maxGroups: 4 });
        expect(layout.groups).toHaveLength(5);
        expect(layout.groups.map((g) => g.name)).toContain('Other');
    });
});

describe('radar', () => {
    const series = resolveSeries(['a', 'b'], 'area');
    const data = ['Speed', 'Cost', 'Scale', 'Docs', 'Support'].map((k, i) => ({ k, a: 20 * (i + 1), b: 50 }));

    it('spokes start at 12 o’clock and values scale from the centre', () => {
        const layout = computeRadar({ data, index: 'k', series, width: 400, height: 300, maxValue: 100 });
        expect(layout.axes).toHaveLength(5);
        expect(layout.axes[0]?.x).toBeCloseTo(layout.cx);
        expect(layout.axes[0]?.y).toBeLessThan(layout.cy);
        const pts = layout.series[0]!.points;
        const dist = (p: { x: number; y: number }) => Math.hypot(p.x - layout.cx, p.y - layout.cy);
        expect(dist(pts[4]!)).toBeCloseTo(layout.radius);
        expect(dist(pts[0]!)).toBeCloseTo(layout.radius / 5);
        expect(layout.series[0]?.path.endsWith('Z')).toBe(true);
        expect(layout.rings.map((r) => r.value)).toContain(100);
        expect(layout.sparse).toBe(true);
    });

    it('radarAxisAt finds the spoke under the pointer', () => {
        const layout = computeRadar({ data, index: 'k', series, width: 400, height: 300 });
        expect(radarAxisAt(layout, layout.cx, layout.cy - 50)).toBe(0);
        const a2 = layout.axes[2]!;
        expect(radarAxisAt(layout, a2.x, a2.y)).toBe(2);
    });

    it('thousands of axes thin labels and sample the outline', () => {
        const many = Array.from({ length: 5_000 }, (_, i) => ({ k: String(i), a: i % 10, b: 5 }));
        const layout = computeRadar({ data: many, index: 'k', series, width: 400, height: 300 });
        expect(layout.sparse).toBe(false);
        expect(layout.sampled).toBe(true);
        expect(layout.axes.filter((a) => a.showLabel).length).toBeLessThan(100);
    });
});

describe('waterfall', () => {
    it('floats each change from the running total and appends the total', () => {
        const layout = computeWaterfall({
            data: [
                { k: 'Start', v: 100 },
                { k: 'New', v: 40 },
                { k: 'Churn', v: -25 },
                { k: 'Expansion', v: 10 },
            ],
            index: 'k',
            category: 'v',
            width: 400,
            height: 240,
        });
        expect(layout.steps.map((s) => [s.kind, s.start, s.end])).toEqual([
            ['increase', 0, 100],
            ['increase', 100, 140],
            ['decrease', 140, 115],
            ['increase', 115, 125],
            ['total', 0, 125],
        ]);
        const churn = layout.steps[2]!;
        expect(churn.y).toBeCloseTo(layout.y(140));
        expect(churn.y + churn.height).toBeCloseTo(layout.y(115));
        expect(layout.connectors).toHaveLength(4);
        expect(layout.connectors[1]?.y).toBeCloseTo(layout.y(140));
    });

    it('a total row stands on zero with everything so far', () => {
        const layout = computeWaterfall({
            data: [
                { k: 'a', v: 10 },
                { k: 'b', v: 5 },
                { k: 'Subtotal', v: 999, total: true },
                { k: 'c', v: -3 },
            ],
            index: 'k',
            category: 'v',
            totalKey: 'total',
            showTotal: false,
            width: 400,
            height: 240,
        });
        expect(layout.steps[2]).toMatchObject({ kind: 'total', start: 0, end: 15, value: 15 });
        expect(layout.steps[3]).toMatchObject({ kind: 'decrease', start: 15, end: 12 });
    });

    it('a leading total with a value is the opening balance', () => {
        const layout = computeWaterfall({
            data: [
                { k: 'Oct MRR', v: 48_000, total: true },
                { k: 'New', v: 6_000 },
                { k: 'Churn', v: -2_000 },
            ],
            index: 'k',
            category: 'v',
            totalKey: 'total',
            width: 400,
            height: 240,
        });
        expect(layout.steps.map((s) => [s.kind, s.start, s.end])).toEqual([
            ['total', 0, 48_000],
            ['increase', 48_000, 54_000],
            ['decrease', 54_000, 52_000],
            ['total', 0, 52_000],
        ]);
    });

    it('50,000 changes are bucketed exactly, with a whisker for the swing inside', () => {
        const data = Array.from({ length: 50_000 }, (_, i) => ({ k: String(i), v: i % 2 ? -1 : 2 }));
        const layout = computeWaterfall({ data, index: 'k', category: 'v', width: 800, height: 240 });
        expect(layout.bucketed).toBe(true);
        expect(layout.steps.length).toBeLessThanOrEqual(201);
        const total = layout.steps[layout.steps.length - 1]!;
        expect(total).toMatchObject({ kind: 'total', value: 25_000 });
        const changes = layout.steps.filter((s) => s.kind !== 'total');
        expect(changes.reduce((s, c) => s + c.value, 0)).toBe(25_000);
        expect(changes[0]?.range).toBeDefined();
        expect(changes[0]?.rows[0]).toBe(0);
    });
});

describe('scatter', () => {
    const one = [{ key: '', label: 'all', color: 'red' }];

    it('places points on linear axes and sizes bubbles by area', () => {
        const layout = computeScatter({
            data: [
                { x: 0, y: 0, s: 1 },
                { x: 10, y: 100, s: 4 },
                { x: 5, y: null, s: 9 },
            ],
            x: 'x',
            y: 'y',
            size: 's',
            groups: one,
            width: 400,
            height: 300,
            sizeRange: [2, 20],
        });
        expect(layout.points).toHaveLength(2);
        const [big, small] = layout.points;
        expect(big!.r).toBeCloseTo(20);
        expect(small!.r).toBeCloseTo(10);
        expect(big!.x).toBeGreaterThan(small!.x);
        expect(big!.y).toBeLessThan(small!.y);
        expect(layout.series[0]?.path.match(/M/g)).toHaveLength(2);
    });

    it('rows outside a pinned axis are left out', () => {
        const layout = computeScatter({
            data: [
                { x: 1, y: 1 },
                { x: 50, y: 1 },
                { x: 2, y: 999 },
            ],
            x: 'x',
            y: 'y',
            groups: one,
            xMaxValue: 10,
            maxValue: 10,
            width: 400,
            height: 300,
        });
        expect(layout.points.map((p) => p.row)).toEqual([0]);
    });

    it('50,000 points draw as one path a group, skip repeat pixels, and hover finds the nearest', () => {
        const data = Array.from({ length: 50_000 }, (_, i) => ({
            x: i % 100,
            y: Math.floor(i / 100) % 50,
            g: i % 2 ? 'a' : 'b',
        }));
        const t0 = performance.now();
        const layout = computeScatter({
            data,
            x: 'x',
            y: 'y',
            groupBy: 'g',
            groups: [
                { key: 'a', label: 'a', color: 'red' },
                { key: 'b', label: 'b', color: 'blue' },
            ],
            width: 600,
            height: 300,
        });
        expect(layout.points).toHaveLength(50_000);
        expect(layout.series).toHaveLength(2);
        // 100 × 50 distinct positions: ten times fewer circles than rows.
        expect(layout.drawn).toBeLessThanOrEqual(5_000);
        const index = scatterIndex(layout.points);
        const target = layout.points[123]!;
        const hit = layout.points[index.nearest(target.x + 1, target.y)]!;
        expect([hit.xValue, hit.yValue]).toEqual([target.xValue, target.yValue]);
        expect(index.nearest(-500, -500)).toBe(-1);
        expect(performance.now() - t0).toBeLessThan(1_500);
    });
});
