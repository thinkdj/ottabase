import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    BarChart,
    BarList,
    CategoryBar,
    Heatmap,
    LineChart,
    RadarChart,
    ScatterChart,
    Tracker,
    TreemapChart,
    WaterfallChart,
} from '../src/react';

// jsdom has no layout, so every chart gets a fixed width.
const W = 600;

describe('new charts', () => {
    it('WaterfallChart draws a bar a step plus the total, with signed labels and a table', () => {
        const { container } = render(
            <WaterfallChart
                data={[
                    { k: 'Start', v: 100 },
                    { k: 'Churn', v: -30 },
                ]}
                index="k"
                category="v"
                width={W}
                animate={false}
                title="MRR bridge"
            />,
        );
        expect(container.querySelectorAll('[data-slot="chart-marks"] rect')).toHaveLength(3);
        expect(container.querySelector('svg')).toHaveTextContent('−30');
        expect(screen.getByRole('table')).toHaveTextContent('MRR bridge');
        expect(screen.getByRole('table')).toHaveTextContent('70');
        expect(screen.getByText('Decrease')).toBeInTheDocument();
    });

    it('WaterfallChart keyboard focus opens the tooltip with the running total', () => {
        render(
            <WaterfallChart
                data={[
                    { k: 'a', v: 10 },
                    { k: 'b', v: 5 },
                ]}
                index="k"
                category="v"
                width={W}
                animate={false}
                title="Steps"
            />,
        );
        const chart = screen.getByRole('group', { name: 'Steps' });
        fireEvent.focus(chart);
        fireEvent.keyDown(chart, { key: 'ArrowRight' });
        expect(screen.getByRole('tooltip')).toHaveTextContent('Running total');
        expect(screen.getByRole('tooltip')).toHaveTextContent('15');
    });

    it('ScatterChart draws one path per group and a legend', () => {
        const data = [
            { x: 1, y: 2, g: 'eu' },
            { x: 2, y: 3, g: 'us' },
            { x: 3, y: 1, g: 'eu' },
        ];
        const { container } = render(
            <ScatterChart data={data} x="x" y="y" groupBy="g" width={W} animate={false} title="Latency" />,
        );
        expect(container.querySelectorAll('[data-slot="chart-marks"] path')).toHaveLength(2);
        expect(screen.getByRole('button', { name: 'eu' })).toHaveAttribute('aria-pressed', 'true');
        const chart = screen.getByRole('group', { name: 'Latency' });
        fireEvent.focus(chart);
        expect(screen.getByRole('tooltip')).toHaveTextContent('x');
    });

    it('ScatterChart folds groups past eight into Other', () => {
        const data = Array.from({ length: 40 }, (_, i) => ({ x: i, y: i, g: `g${i % 12}` }));
        render(<ScatterChart data={data} x="x" y="y" groupBy="g" width={W} animate={false} />);
        expect(screen.getAllByRole('button')).toHaveLength(8);
        expect(screen.getByRole('button', { name: 'Other' })).toBeInTheDocument();
    });

    it('RadarChart draws rings, an outline per series and axis labels', () => {
        const data = ['Speed', 'Cost', 'Scale', 'Docs'].map((k) => ({ k, a: 3, b: 4 }));
        const { container } = render(
            <RadarChart data={data} index="k" series={['a', 'b']} width={W} animate={false} title="Plans" />,
        );
        expect(container.querySelectorAll('[data-slot="chart-marks"] path')).toHaveLength(2);
        expect(container.querySelector('svg')).toHaveTextContent('Docs');
        const chart = screen.getByRole('group', { name: 'Plans' });
        fireEvent.focus(chart);
        fireEvent.keyDown(chart, { key: 'ArrowRight' });
        expect(screen.getByRole('tooltip')).toHaveTextContent('Cost');
    });

    it('TreemapChart labels the tiles that fit and reports clicks', () => {
        const onTileClick = vi.fn();
        const { container } = render(
            <TreemapChart
                data={[
                    { name: 'images', value: 60 },
                    { name: 'video', value: 30 },
                    { name: 'docs', value: 10 },
                ]}
                width={W}
                height={240}
                animate={false}
                onTileClick={onTileClick}
                title="Storage"
            />,
        );
        expect(container.querySelector('svg')).toHaveTextContent('images');
        const chart = screen.getByRole('group', { name: 'Storage' });
        fireEvent.focus(chart);
        fireEvent.keyDown(chart, { key: 'Enter' });
        expect(onTileClick).toHaveBeenCalledWith(expect.objectContaining({ name: 'images', value: 60 }));
    });
});

describe('50,000 rows', () => {
    const rows = Array.from({ length: 50_000 }, (_, i) => ({ t: String(i), v: (i * 7919) % 1000 }));

    it('a LineChart keeps the DOM small: one path a series and a 500-row table', () => {
        const { container } = render(
            <LineChart data={rows} index="t" series={['v']} width={W} animate={false} title="Big" />,
        );
        expect(container.querySelectorAll('svg path')).toHaveLength(1);
        expect(container.querySelectorAll('tbody tr')).toHaveLength(500);
        expect(screen.getByRole('table')).toHaveTextContent('500 of 50000 rows');
        // Arrows move a pixel column, not a row.
        const chart = screen.getByRole('group', { name: 'Big' });
        fireEvent.focus(chart);
        fireEvent.keyDown(chart, { key: 'Home' });
        fireEvent.keyDown(chart, { key: 'ArrowRight' });
        expect(screen.getByRole('tooltip').textContent).not.toMatch(/^1\b/);
    });

    it('a BarChart draws one path of bars, not a rect each', () => {
        const { container } = render(<BarChart data={rows} index="t" series={['v']} width={W} animate={false} />);
        expect(container.querySelectorAll('[data-slot="chart-marks"] rect')).toHaveLength(1); // the reveal clip
        expect(container.querySelectorAll('[data-slot="chart-marks"] g path')).toHaveLength(1);
    });

    it('a BarList stops at 100 rows and says how many it left out', () => {
        render(<BarList data={rows.map((r) => ({ name: r.t, value: r.v }))} />);
        expect(screen.getByText('49,900 more not shown')).toBeInTheDocument();
    });

    it('a Tracker merges periods into the bars that fit, keeping the worst', () => {
        const data = Array.from({ length: 50_000 }, (_, i) => ({ color: i === 777 ? 'danger' : 'success' }));
        const { container } = render(<Tracker data={data} width={W} />);
        const bars = container.querySelectorAll('[role="listitem"]');
        expect(bars.length).toBe(Math.floor((W + 2) / 4));
        const red = [...bars].filter((b) => (b as HTMLElement).style.backgroundColor.includes('destructive'));
        expect(red).toHaveLength(1);
    });

    it('a Heatmap of many cells draws a path per shade', () => {
        const cells = Array.from({ length: 5_000 }, (_, i) => ({
            x: String(i % 250),
            y: String(i % 20),
            value: i % 9,
        }));
        const { container } = render(<Heatmap data={cells} x="x" y="y" width={W} cellHeight={6} />);
        expect(container.querySelectorAll('svg rect')).toHaveLength(0);
        expect(container.querySelectorAll('svg path').length).toBeLessThanOrEqual(12);
    });

    it('a ScatterChart draws one path a group', () => {
        const data = rows.map((r, i) => ({ x: i % 300, y: r.v, g: i % 3 ? 'a' : 'b' }));
        const { container } = render(<ScatterChart data={data} x="x" y="y" groupBy="g" width={W} animate={false} />);
        expect(container.querySelectorAll('[data-slot="chart-marks"] path')).toHaveLength(2);
        expect(container.querySelectorAll('tbody tr')).toHaveLength(500);
    });

    it('a CategoryBar past eight segments folds the rest into Other', () => {
        render(
            <CategoryBar
                data={Array.from({ length: 20 }, (_, i) => ({ name: `s${i}`, value: 20 - i }))}
                animate={false}
            />,
        );
        expect(screen.getByText('Other')).toBeInTheDocument();
        expect(screen.queryByText('s12')).not.toBeInTheDocument();
    });
});
