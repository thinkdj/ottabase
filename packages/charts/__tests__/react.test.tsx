import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    AreaChart,
    BarChart,
    BarList,
    CategoryBar,
    CalendarHeatmap,
    ComboChart,
    Delta,
    FunnelChart,
    SankeyChart,
    Heatmap,
    DonutChart,
    LineChart,
    ProgressCircle,
    Sparkline,
    Tracker,
    chartToSvg,
} from '../src/react';

const data = [
    { day: 'Mon', requests: 120, jobs: 30 },
    { day: 'Tue', requests: 180, jobs: 45 },
    { day: 'Wed', requests: 150, jobs: 40 },
];

// jsdom has no layout, so every chart gets a fixed width.
const W = 400;

describe('cartesian charts', () => {
    it('draws a line per series, a legend, and a screen-reader table', () => {
        const { container } = render(
            <LineChart data={data} index="day" series={['requests', 'jobs']} width={W} title="Traffic" />,
        );
        expect(container.querySelectorAll('path[fill="none"]')).toHaveLength(2);
        expect(screen.getByRole('button', { name: 'requests' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('table')).toHaveTextContent('Traffic');
        expect(screen.getByRole('group', { name: 'Traffic' })).toBeInTheDocument();
    });

    it('hides a series from the legend, but never the last one', () => {
        const { container } = render(<LineChart data={data} index="day" series={['requests', 'jobs']} width={W} />);
        fireEvent.click(screen.getByRole('button', { name: 'jobs' }));
        expect(container.querySelectorAll('path[fill="none"]')).toHaveLength(1);
        fireEvent.click(screen.getByRole('button', { name: 'requests' }));
        expect(container.querySelectorAll('path[fill="none"]')).toHaveLength(1);
    });

    it('shows a tooltip from the keyboard and reports clicks', () => {
        const onValueClick = vi.fn();
        render(
            <BarChart
                data={data}
                index="day"
                series={['requests']}
                width={W}
                title="Requests"
                onValueClick={onValueClick}
            />,
        );
        const chart = screen.getByRole('group', { name: 'Requests' });
        fireEvent.focus(chart);
        fireEvent.keyDown(chart, { key: 'Home' });
        expect(document.querySelector('[data-slot="chart-tooltip"]')).toHaveTextContent('Mon');
        fireEvent.keyDown(chart, { key: 'ArrowRight' });
        expect(document.querySelector('[data-slot="chart-tooltip"]')).toHaveTextContent('180');
        fireEvent.keyDown(chart, { key: 'Enter' });
        expect(onValueClick).toHaveBeenCalledWith({ row: data[1], index: 1 });
    });

    it('shows a stack total in the tooltip', () => {
        render(<AreaChart data={data} index="day" series={['requests', 'jobs']} stack="stacked" width={W} />);
        const chart = screen.getByRole('group');
        fireEvent.focus(chart);
        fireEvent.keyDown(chart, { key: 'Home' });
        expect(document.querySelector('[data-slot="chart-tooltip"]')).toHaveTextContent('Total150');
    });

    it('mixes bars and lines in a combo chart', () => {
        const { container } = render(
            <ComboChart
                data={data}
                index="day"
                series={['requests', { key: 'jobs', type: 'line' }]}
                referenceLines={[{ value: 100, label: 'Target' }]}
                width={W}
            />,
        );
        expect(container.querySelectorAll('rect').length).toBeGreaterThanOrEqual(3);
        expect(container.querySelectorAll('path[fill="none"]')).toHaveLength(1);
        expect(screen.getByText('Target')).toBeInTheDocument();
    });

    it('renders the empty state', () => {
        render(<LineChart data={[]} index="day" series={['requests']} width={W} emptyText="Nothing yet" />);
        expect(screen.getByText('Nothing yet')).toBeInTheDocument();
    });
});

describe('DonutChart', () => {
    const slices = [
        { name: 'Active', value: 9 },
        { name: 'Expired', value: 1 },
    ];

    it('shows the total, and the hovered slice in the centre', () => {
        const { container } = render(
            <DonutChart data={slices} label="packages" colors={{ Expired: 'danger' }} title="Licenses" />,
        );
        expect(screen.getByText('10')).toBeInTheDocument();
        const paths = container.querySelectorAll('svg path');
        expect(paths).toHaveLength(2);
        expect((paths[1] as SVGPathElement).style.fill).toBe('hsl(var(--destructive))');
        fireEvent.pointerEnter(paths[1] as Element);
        expect(screen.getByText('Expired · 10%')).toBeInTheDocument();
    });

    it('folds slices past maxSlices into Other', () => {
        const many = Array.from({ length: 10 }, (_, i) => ({ name: `s${i}`, value: 10 - i }));
        render(<DonutChart data={many} maxSlices={4} />);
        expect(screen.getAllByText('Other').length).toBeGreaterThan(0);
    });
});

describe('small multiples', () => {
    it('Sparkline accepts plain numbers', () => {
        const { container } = render(<Sparkline data={[1, 4, 2, 8]} width={120} title="Signups" />);
        expect(screen.getByRole('img', { name: 'Signups' })).toBeInTheDocument();
        expect(container.querySelector('path')?.getAttribute('d')).toMatch(/^M/);
    });

    it('BarList sorts descending and selects rows', () => {
        const onSelect = vi.fn();
        render(
            <BarList
                data={[
                    { name: '/pricing', value: 20 },
                    { name: '/', value: 90 },
                ]}
                onSelect={onSelect}
            />,
        );
        const rows = screen.getAllByRole('button');
        expect(rows[0]).toHaveTextContent('/90');
        fireEvent.click(rows[1] as Element);
        expect(onSelect).toHaveBeenCalledWith({ name: '/pricing', value: 20 });
    });

    it('CalendarHeatmap draws one cell per day', () => {
        const { container } = render(
            <CalendarHeatmap data={[{ date: '2026-10-25', value: 3 }]} end="2026-10-25" weeks={2} />,
        );
        expect(container.querySelectorAll('rect')).toHaveLength(14);
        expect(screen.getByText('3 on 2026-10-25')).toBeInTheDocument();
    });

    it('Tracker labels every bar', () => {
        render(<Tracker data={[{ color: 'success', tooltip: 'up' }, { tooltip: 'no data' }]} title="Uptime" />);
        expect(screen.getAllByRole('listitem')).toHaveLength(2);
        expect(screen.getByLabelText('no data')).toBeInTheDocument();
    });

    it('Delta inverts the tone when down is good', () => {
        const { rerender } = render(<Delta current={80} previous={100} />);
        expect(screen.getByText('−20%').closest('[data-slot="delta"]')).toHaveClass('text-destructive-text');
        rerender(<Delta current={80} previous={100} invert />);
        expect(screen.getByText('−20%').closest('[data-slot="delta"]')).toHaveClass('text-success-text');
    });
});

describe('cartesian upgrades', () => {
    it('draws horizontal bars with category labels down the left', () => {
        const { container } = render(
            <BarChart
                data={[
                    { page: '/docs/quickstart', visits: 90 },
                    { page: '/pricing', visits: 40 },
                ]}
                index="page"
                series={['visits']}
                orientation="horizontal"
                width={W}
                animate={false}
            />,
        );
        const labels = [...container.querySelectorAll('text')].map((t) => t.textContent);
        expect(labels).toContain('/docs/quickstart');
        // The marks group is rotated into place.
        expect(container.querySelector('[data-slot="chart-marks"] g[clip-path]')?.getAttribute('transform')).toMatch(
            /rotate\(90\)/,
        );
        expect(container.querySelectorAll('[data-slot="chart-marks"] rect').length).toBeGreaterThanOrEqual(3);
    });

    it('selects a range from the keyboard', () => {
        const onRangeSelect = vi.fn();
        render(<LineChart data={data} index="day" series={['requests']} width={W} onRangeSelect={onRangeSelect} />);
        const chart = screen.getByRole('group');
        fireEvent.focus(chart);
        fireEvent.keyDown(chart, { key: 'Home' });
        fireEvent.keyDown(chart, { key: 'ArrowRight', shiftKey: true });
        fireEvent.keyDown(chart, { key: 'ArrowRight', shiftKey: true });
        fireEvent.keyDown(chart, { key: 'Enter' });
        expect(onRangeSelect).toHaveBeenCalledWith({ start: 0, end: 2, rows: data });
    });

    it('renders a right axis, annotations, reference areas and value labels', () => {
        const { container } = render(
            <ComboChart
                data={data}
                index="day"
                series={['requests', { key: 'jobs', type: 'line', axis: 'right' }]}
                rightAxis={{ valueFormatter: (v) => `${v}j`, title: 'Jobs' }}
                annotations={[{ index: 'Tue', label: 'Deploy' }]}
                referenceAreas={[{ from: 'Mon', to: 'Tue', label: 'Weekend' }]}
                showValues
                width={W}
                animate={false}
            />,
        );
        const texts = [...container.querySelectorAll('text')].map((t) => t.textContent ?? '');
        expect(texts.some((t) => /j$/.test(t))).toBe(true);
        expect(texts).toContain('Deploy');
        expect(texts).toContain('Weekend');
        expect(texts).toContain('Jobs');
        expect(texts).toContain('180'); // the bar label
        expect(container.querySelectorAll('[data-slot="chart-bands"] rect')).toHaveLength(1);
    });

    it('lets a custom tooltip read the context', () => {
        render(
            <BarChart
                data={data}
                index="day"
                series={['requests']}
                width={W}
                renderTooltip={(ctx) => <b>{`${ctx.label}:${ctx.series[0]?.value}`}</b>}
            />,
        );
        const chart = screen.getByRole('group');
        fireEvent.focus(chart);
        fireEvent.keyDown(chart, { key: 'Home' });
        expect(screen.getByRole('tooltip')).toHaveTextContent('Mon:120');
    });

    it('shows a skeleton while loading', () => {
        render(<LineChart data={[]} index="day" series={['requests']} width={W} loading title="Traffic" />);
        expect(screen.getByRole('group', { name: 'Traffic' })).toHaveAttribute('aria-busy', 'true');
        expect(document.querySelector('[data-slot="chart-skeleton"]')).toBeTruthy();
    });
});

describe('radius', () => {
    it('steps none/sm/md/lg map to 0/2/4/8px; charts default to sm, BarList to md', () => {
        const bars = (radius?: 'none' | 'lg') =>
            render(
                <BarChart data={data} index="day" series={['requests']} width={W} animate={false} radius={radius} />,
            ).container.querySelector('svg rect[rx]');
        expect(bars()?.getAttribute('rx')).toBe('2');
        expect(bars('none')?.getAttribute('rx')).toBe('0');
        expect(bars('lg')?.getAttribute('rx')).toBe('8');
        const { container } = render(<BarList data={[{ name: 'a', value: 1 }]} animate={false} />);
        expect(container.querySelector<HTMLElement>('[aria-hidden="true"]')?.style.borderRadius).toBe('4px');
    });
});

describe('new components', () => {
    it('SankeyChart draws a band per link and labels each node', () => {
        const { container } = render(
            <SankeyChart
                data={{
                    nodes: [{ name: 'Ads' }, { name: 'Site' }, { name: 'Buy' }],
                    links: [
                        { source: 'Ads', target: 'Site', value: 30 },
                        { source: 'Site', target: 'Buy', value: 12 },
                    ],
                }}
                width={400}
                animate={false}
            />,
        );
        expect(container.querySelectorAll('svg path')).toHaveLength(2);
        expect(container.querySelectorAll('svg rect')).toHaveLength(3);
        expect(container.querySelector('svg')?.textContent).toContain('Buy');
    });

    it('FunnelChart prints conversion per step', () => {
        const { container } = render(
            <FunnelChart
                data={[
                    { name: 'Visit', value: 1000 },
                    { name: 'Signup', value: 250 },
                ]}
                width={400}
                animate={false}
            />,
        );
        const texts = [...container.querySelectorAll('text')].map((t) => t.textContent);
        expect(texts).toContain('25%');
        expect(texts).toContain('Visit');
    });

    it('FunnelChart flow draws a band per series and the share of the first step', () => {
        const { container, getByText } = render(
            <FunnelChart
                variant="flow"
                series={['direct', 'ads']}
                data={[
                    { name: 'Seen', breakdown: { direct: 600, ads: 400 } },
                    { name: 'Buy', breakdown: { direct: 60, ads: 15 } },
                ]}
                width={400}
                animate={false}
            />,
        );
        expect(container.querySelectorAll('path')).toHaveLength(2);
        expect(getByText('7.5%')).toBeTruthy();
        expect(container.querySelector('[data-slot="chart-legend"]')).toBeTruthy();
    });

    it('Heatmap draws every cell of the matrix', () => {
        const { container } = render(
            <Heatmap
                data={[
                    { h: '9', d: 'Mon', value: 2 },
                    { h: '10', d: 'Tue', value: 5 },
                ]}
                x="h"
                y="d"
                width={300}
                showValues
            />,
        );
        expect(container.querySelectorAll('rect')).toHaveLength(4);
        expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('ProgressCircle is a meter', () => {
        render(<ProgressCircle value={30} max={120} title="Storage" animate={false} />);
        const meter = screen.getByRole('meter', { name: 'Storage' });
        expect(meter).toHaveAttribute('aria-valuenow', '30');
        expect(meter).toHaveTextContent('25%');
    });

    it('CategoryBar legend shows shares of the total', () => {
        render(
            <CategoryBar
                data={[
                    { name: 'Images', value: 30 },
                    { name: 'Video', value: 20 },
                ]}
                total={100}
                animate={false}
            />,
        );
        expect(screen.getByText('30%')).toBeInTheDocument();
        expect(screen.getByText('20%')).toBeInTheDocument();
    });

    it('DonutChart half variant draws a track', () => {
        const { container } = render(
            <DonutChart data={[{ name: 'a', value: 1 }]} variant="half" showLegend={false} animate={false} />,
        );
        expect(container.querySelectorAll('svg path').length).toBe(2);
    });
});

describe('export', () => {
    it('chartToSvg produces a standalone SVG with the chart size and a background', () => {
        const { container } = render(
            <BarChart data={data} index="day" series={['requests']} width={W} height={120} animate={false} />,
        );
        const svg = container.querySelector('svg') as SVGSVGElement;
        const out = chartToSvg(svg, '#ffffff');
        expect(out.startsWith('<svg')).toBe(true);
        expect(out).toContain('xmlns="http://www.w3.org/2000/svg"');
        expect(out).toContain(`width="${W}"`);
        expect(out).toContain('fill="#ffffff"');
        expect(out).not.toContain('class=');
    });
});
