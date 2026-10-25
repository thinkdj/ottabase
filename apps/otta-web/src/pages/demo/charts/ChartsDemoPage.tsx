/**
 * Charts Demo Page
 *
 * Every @ottabase/charts component on seeded sample data, grouped by the question a
 * chart answers (trend, comparison, relationship, composition, ranking, density,
 * status), plus every chart at 5k-100k rows. Each section carries its code. The data
 * is deterministic (seeded PRNG) so the page looks the same on every load.
 */

import {
    bucketKey,
    currencyFormatter,
    dateFormatter,
    formatCompact,
    formatNumber,
    toCsv,
    type ChartRow,
    type Curve,
    type StackMode,
} from '@ottabase/charts';
import {
    AreaChart,
    BarChart,
    BarList,
    CalendarHeatmap,
    CategoryBar,
    ChartSkeleton,
    ComboChart,
    Delta,
    DonutChart,
    FunnelChart,
    Heatmap,
    LineChart,
    ProgressCircle,
    RadarChart,
    SankeyChart,
    ScatterChart,
    Sparkline,
    TooltipContent,
    Tracker,
    TreemapChart,
    WaterfallChart,
    copyText,
    downloadText,
    exportChart,
    type RangeSelectPayload,
    type TrackerItem,
} from '@ottabase/charts/react';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    cn,
    Stat,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    ToggleGroup,
    ToggleGroupItem,
} from '@ottabase/ui';
import { CodeBlock } from '@ottabase/ui-code-highlight';
import { Profiler, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DemoPageHeader } from '../DemoPageHeader';

const DAY = 86_400_000;
const DAY_LABEL = dateFormatter('day');
const USD = currencyFormatter('USD', true);
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const REGIONS = ['Europe', 'Americas', 'Asia'];
const TENANTS = ['northwind', 'contoso', 'fabrikam', 'tailspin', 'litware', 'adatum'];

const SANKEY = {
    nodes: [
        { name: 'Search' },
        { name: 'Social' },
        { name: 'Email' },
        { name: 'Pricing' },
        { name: 'Blog' },
        { name: 'Signed up' },
        { name: 'Left' },
    ],
    links: [
        { source: 'Search', target: 'Pricing', value: 3200 },
        { source: 'Search', target: 'Blog', value: 1400 },
        { source: 'Social', target: 'Blog', value: 2600 },
        { source: 'Social', target: 'Pricing', value: 500 },
        { source: 'Email', target: 'Pricing', value: 1100 },
        { source: 'Pricing', target: 'Signed up', value: 1900 },
        { source: 'Pricing', target: 'Left', value: 2900 },
        { source: 'Blog', target: 'Signed up', value: 600 },
        { source: 'Blog', target: 'Left', value: 3400 },
    ],
};

/** Mulberry32: a tiny seeded PRNG, so the sample data is stable across renders and reloads. */
function seeded(seed: number) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function useSampleData() {
    return useMemo(() => {
        const rand = seeded(42);
        const today = Date.now();
        const days = (n: number) => Array.from({ length: n }, (_, i) => bucketKey(today - (n - 1 - i) * DAY, 'day'));

        const traffic = days(30).map((day, i) => {
            const weekly = Math.sin((i / 7) * Math.PI * 2) * 30;
            return {
                day,
                // Two gaps: a day the collector was down.
                requests: i === 11 || i === 12 ? null : Math.round(400 + i * 6 + weekly + rand() * 60),
                jobs: Math.round(120 + i * 2 + weekly / 2 + rand() * 30),
            };
        });
        const deployDay = traffic[20]?.day ?? '';
        const weekend: [string, string] = [traffic[5]?.day ?? '', traffic[6]?.day ?? ''];

        const channels = days(14).map((day) => ({
            day,
            organic: Math.round(80 + rand() * 60),
            referral: Math.round(30 + rand() * 30),
            paid: Math.round(20 + rand() * 40),
        }));

        const jobs = WEEKDAYS.map((d) => ({
            d,
            succeeded: Math.round(140 + rand() * 40),
            retried: Math.round(10 + rand() * 25),
            failed: Math.round(rand() * 10),
        }));

        const tickets = ['Billing', 'Onboarding', 'API & webhooks', 'Mobile app', 'Data export'].map((area) => ({
            area,
            open: Math.round(5 + rand() * 30),
            closed: Math.round(20 + rand() * 60),
        }));

        const signups = days(21).map((day, i) => ({
            day,
            signups: Math.round(20 + i + rand() * 25),
            revenue: Math.round(900 + i * 40 + rand() * 400),
        }));

        const activity = days(365).map((date) => ({ date, value: rand() < 0.3 ? 0 : Math.round(rand() ** 2 * 12) }));

        const hourly: ChartRow[] = [];
        WEEKDAYS.forEach((d, di) => {
            for (let h = 0; h < 24; h++) {
                const office = h >= 8 && h <= 18 && di < 5 ? 1 : 0.25;
                hourly.push({ hour: String(h), day: d, value: Math.round(rand() * 40 * office + (h === 10 ? 20 : 0)) });
            }
        });

        const uptime: TrackerItem[] = days(90).map((day) => {
            const r = rand();
            const tone = r > 0.97 ? 'danger' : r > 0.92 ? 'warning' : 'success';
            const label =
                tone === 'danger' ? 'Outage · 42 min' : tone === 'warning' ? 'Degraded · p95 1.8s' : '100% up';
            return { color: tone, tooltip: DAY_LABEL(day), detail: label };
        });

        const revenue = Array.from({ length: 12 }, () => 800 + rand() * 600);

        // Latency against payload size, per region: bigger payloads are slower, Asia most of all.
        const requestsByRegion = REGIONS.flatMap((region, ri) =>
            Array.from({ length: 80 }, () => {
                const kb = Math.round(4 + rand() ** 2 * 900);
                return { region, kb, ms: Math.round(40 + ri * 35 + kb * (0.12 + ri * 0.05) + rand() * 120) };
            }),
        );

        const accounts = ['Acme', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Stark', 'Wayne', 'Wonka', 'Tyrell']
            .flatMap((name) => ['Starter', 'Pro', 'Team'].map((plan) => ({ name: `${name} ${plan}`, plan })))
            .map((a, i) => {
                const seats = Math.round((a.plan === 'Team' ? 60 : a.plan === 'Pro' ? 20 : 4) * (0.4 + rand() * 1.6));
                return {
                    ...a,
                    seats,
                    mrr: Math.round(
                        seats * (a.plan === 'Team' ? 32 : a.plan === 'Pro' ? 24 : 12) * (0.8 + rand() * 0.5),
                    ),
                    usage: Math.round(seats * (200 + rand() * 900) + i),
                };
            });

        const plans = ['API calls', 'Seats', 'Storage', 'Support', 'SSO & audit', 'Integrations'].map((feature) => ({
            feature,
            starter: Math.round(15 + rand() * 30),
            pro: Math.round(45 + rand() * 30),
            team: Math.round(70 + rand() * 30),
        }));
        const health = [
            'Latency',
            'Errors',
            'Saturation',
            'Traffic',
            'Availability',
            'Freshness',
            'Cost',
            'Coverage',
        ].map((signal) => ({ signal, score: Math.round(55 + rand() * 45) }));

        const storage = TENANTS.flatMap((tenant, ti) =>
            ['uploads', 'backups', 'exports', 'avatars', 'logs', 'media', 'cache'].map((bucket) => ({
                tenant,
                bucket,
                gb: Math.round((rand() ** 2 * 120 + 2) * (TENANTS.length - ti)),
            })),
        );
        const bundle = [
            ['react-dom', 132],
            ['@ottabase/ui', 96],
            ['@tanstack/router', 54],
            ['@ottabase/charts', 31],
            ['zod', 28],
            ['@tanstack/query', 24],
            ['date-fns', 19],
            ['app routes', 64],
            ['lucide-react', 17],
            ['tw-animate-css', 6],
            ['clsx', 1],
        ].map(([name, kb]) => ({ name, kb }));

        const mrr = [
            { step: 'Oct 1 MRR', value: 48_200, total: true },
            { step: 'New', value: 6_400 },
            { step: 'Expansion', value: 2_150 },
            { step: 'Reactivation', value: 380 },
            { step: 'Contraction', value: -920 },
            { step: 'Churn', value: -2_640 },
        ];
        const cash: ChartRow[] = [];
        ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'].forEach((month, i) => {
            cash.push({ month, net: Math.round((rand() - 0.38) * 40_000) });
            if (i % 3 === 2) cash.push({ month: `Q${(i + 1) / 3}`, net: 0, subtotal: true });
        });

        return {
            traffic,
            deployDay,
            weekend,
            channels,
            jobs,
            tickets,
            signups,
            activity,
            hourly,
            uptime,
            revenue,
            requestsByRegion,
            accounts,
            plans,
            health,
            storage,
            bundle,
            mrr,
            cash,
        };
    }, []);
}

const MINUTE = 60_000;
const MINUTE_LABEL = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
});
const minuteLabel = (v: string) => MINUTE_LABEL.format(new Date(`${v}Z`));

/** `n` rows of every shape the large-data section draws: minute metrics, points, files, a ledger, checks. */
function largeData(n: number) {
    const rand = seeded(7);
    const start = Date.UTC(2026, 8, 1);
    const metrics: ChartRow[] = new Array(n);
    let level = 120;
    for (let i = 0; i < n; i++) {
        level = Math.min(400, Math.max(40, level + (rand() - 0.5) * 6));
        // A rare incident: one minute in a few thousand spikes p95 several times over.
        const spike = rand() < 0.0003 ? level * (3 + rand() * 4) : 0;
        metrics[i] = {
            t: new Date(start + i * MINUTE).toISOString().slice(0, 16),
            p50: Math.round(level),
            p95: Math.round(level * 1.9 + rand() * 30 + spike),
        };
    }
    const points: ChartRow[] = new Array(n);
    for (let i = 0; i < n; i++) {
        const ri = Math.floor(rand() * REGIONS.length);
        const kb = Math.round(1 + rand() ** 3 * 2000);
        points[i] = {
            region: REGIONS[ri],
            kb,
            ms: Math.round(30 + ri * 30 + kb * (0.1 + ri * 0.04) + rand() ** 2 * 400),
        };
    }
    const files: ChartRow[] = new Array(n);
    for (let i = 0; i < n; i++) {
        files[i] = {
            name: `file-${i.toString(36)}`,
            // Heavy-tailed, like real storage: a few huge files hold most of the bytes.
            mb: Math.min(80_000, Math.round(0.5 / (rand() || 1e-9) ** 1.4)),
            tenant: TENANTS[Math.floor(rand() ** 1.5 * TENANTS.length)],
        };
    }
    const ledger: ChartRow[] = new Array(n);
    // Entries that net out over a season: the running total swings rather than climbs.
    for (let i = 0; i < n; i++) {
        ledger[i] = {
            entry: `#${i + 1}`,
            amount: Math.round((rand() - 0.5) * 200 + 6 * Math.sin((i / n) * Math.PI * 6)),
        };
    }
    const checks: TrackerItem[] = new Array(n);
    for (let i = 0; i < n; i++) {
        const r = rand();
        const color = r > 0.99995 ? 'danger' : r > 0.9997 ? 'warning' : 'success';
        checks[i] = {
            color,
            tooltip: minuteLabel(new Date(start + i * MINUTE).toISOString().slice(0, 16)),
            detail: color === 'danger' ? 'Down' : color === 'warning' ? 'Slow' : 'Up',
        };
    }
    return { metrics, points, files, ledger, checks };
}

// ── Page scaffolding ──────────────────────────────────────────

const SECTIONS = [
    { id: 'glance', label: 'At a glance' },
    { id: 'trends', label: 'Trends' },
    { id: 'comparison', label: 'Comparison' },
    { id: 'relationships', label: 'Relationships' },
    { id: 'composition', label: 'Composition' },
    { id: 'rankings', label: 'Rankings' },
    { id: 'density', label: 'Density' },
    { id: 'status', label: 'Status' },
    { id: 'states', label: 'States & interaction' },
    { id: 'export', label: 'Export' },
    { id: 'large', label: 'Large data' },
] as const;

const CHOOSER: [string, string, string][] = [
    ['How is it trending?', 'LineChart, AreaChart', 'Sparkline inside a Stat tile when space is tight'],
    ['How do categories compare?', 'BarChart', 'orientation="horizontal" for long labels; stack to sum'],
    ['Two units on one timeline?', 'ComboChart', 'axis: "right" on the second unit'],
    ['Do two measures move together?', 'ScatterChart', 'groupBy for colour; size makes it a bubble chart'],
    ['How do a few things score across many measures?', 'RadarChart', '3–12 axes, one outline per thing'],
    ['What is the mix?', 'DonutChart, CategoryBar', 'Tones for a status breakdown, slots for categories'],
    ['What is the mix, when the parts are many?', 'TreemapChart', 'groupBy for blocks; the tail folds into Other'],
    ['How did we get from start to end?', 'WaterfallChart', 'Changes float; totalKey rows are subtotals'],
    ['Where do people drop off?', 'FunnelChart', 'Steps in order, largest first; variant="flow" splits by channel'],
    ['Where does it flow?', 'SankeyChart', 'Nodes and weighted links; sources left, sinks right'],
    ['What ranks highest?', 'BarList', 'Reads like a table, compares like a chart'],
    ['When is it busy?', 'Heatmap, CalendarHeatmap', 'Hour × weekday, or one cell a day'],
    ['Is it up?', 'Tracker', 'One bar per period, tone per state'],
    ['How full is it?', 'ProgressCircle', 'A quota, a goal, storage'],
    ['Did it change?', 'Delta', 'In a Stat foot; invert when down is good'],
];

function Section({
    id,
    className,
    title,
    description,
    actions,
    code,
    children,
}: {
    id?: string;
    className?: string;
    title: string;
    description: string;
    actions?: ReactNode;
    code?: string;
    children: ReactNode;
}) {
    return (
        <Card id={id} className={cn('scroll-mt-32', className)}>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                <div className="space-y-1.5">
                    <CardTitle className="text-[0.9375rem] font-semibold">{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </div>
                {actions}
            </CardHeader>
            <CardContent className="space-y-4">
                {children}
                {code && (
                    <details className="group">
                        <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground hover:text-foreground">
                            <span className="group-open:hidden">Show code</span>
                            <span className="hidden group-open:inline">Hide code</span>
                        </summary>
                        <CodeBlock code={code.trim()} language="typescript" hideHeader className="mt-2 text-xs" />
                    </details>
                )}
            </CardContent>
        </Card>
    );
}

function Choice<T extends string>({
    value,
    onChange,
    options,
    label,
}: {
    value: T;
    onChange: (v: T) => void;
    options: T[];
    label: string;
}) {
    return (
        <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={value}
            aria-label={label}
            onValueChange={(v) => v && onChange(v as T)}
        >
            {options.map((o) => (
                <ToggleGroupItem key={o} value={o} className="px-2.5 text-xs capitalize">
                    {o}
                </ToggleGroupItem>
            ))}
        </ToggleGroup>
    );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
            {label}
        </label>
    );
}

function Jump({ children }: { children: ReactNode }) {
    return <h2 className="text-lg font-semibold tracking-[-0.01em]">{children}</h2>;
}

function Code({ children }: { children: ReactNode }) {
    return <span className="rounded-sm bg-muted px-1 font-mono text-[10px] text-muted-foreground">{children}</span>;
}

// ── Large data ────────────────────────────────────────────────

// Module constants, not inline literals: a new array or function each render would make
// every chart recompute its layout whenever this section re-renders.
const LATENCY_SERIES = [
    { key: 'p50', label: 'p50' },
    { key: 'p95', label: 'p95', color: 'warning' },
];
const P95_SERIES = [{ key: 'p95', label: 'p95', color: 'warning' }];
const MS = (v: number) => `${formatCompact(v)} ms`;
const KB = (v: number) => `${formatCompact(v)} KB`;
const MB = (v: number) => (v >= 1000 ? `${formatCompact(v / 1000)} GB` : `${formatCompact(v)} MB`);

const SIZES = ['5k', '10k', '50k', '100k'] as const;
const SIZE_ROWS: Record<(typeof SIZES)[number], number> = {
    '5k': 5_000,
    '10k': 10_000,
    '50k': 50_000,
    '100k': 100_000,
};

/**
 * Every chart kind at 5k-100k rows, starting at 5k. Mounted when scrolled near, so the rest of the
 * page never waits for it. The timing is React's own render time for the charts (the
 * geometry is computed while rendering), summed over the renders a size change causes;
 * production builds do not collect it, so there it is hidden.
 */
function LargeDataSection() {
    const ref = useRef<HTMLDivElement>(null);
    const [near, setNear] = useState(false);
    const [size, setSize] = useState<(typeof SIZES)[number]>('5k');
    const [ms, setMs] = useState<number | null>(null);
    const n = SIZE_ROWS[size];
    const data = useMemo(() => (near ? largeData(n) : null), [near, n]);
    const timing = useRef({ total: 0, on: true, timer: 0 });
    const onRender = (_id: string, _phase: string, actual: number) => {
        const t = timing.current;
        if (!t.on) return;
        t.total += actual;
        window.clearTimeout(t.timer);
        // Charts render twice (measure, then draw); report once they settle.
        t.timer = window.setTimeout(() => {
            t.on = false;
            setMs(t.total > 0 ? Math.round(t.total) : null);
        }, 300);
    };

    useEffect(() => {
        const el = ref.current;
        if (!el || typeof IntersectionObserver === 'undefined') {
            setNear(true);
            return;
        }
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((e) => e.isIntersecting)) {
                    setNear(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '400px' },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const rows = formatNumber(n);
    return (
        <div id="large" ref={ref} className="scroll-mt-32 space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="space-y-1">
                    <Jump>{rows} rows</Jump>
                    <p className="max-w-3xl text-sm text-muted-foreground">
                        A chart has a few hundred pixels; past that, more rows only cost time. Lines and bars draw the
                        rows that hold each pixel column&apos;s first, last, lowest and highest value, so every spike
                        survives and the shape is exactly the full one. Hover still reads every row. Points draw as one
                        path a colour, treemaps fold their tail into Other, waterfalls sum runs of changes, trackers
                        keep the worst status a bar. Nothing is averaged away.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {ms !== null && (
                        <span className="text-xs tabular-nums text-muted-foreground">
                            Render and layout, all six charts:{' '}
                            <span className="font-medium text-foreground">{ms} ms</span>
                        </span>
                    )}
                    <Choice
                        label="Rows"
                        value={size}
                        options={[...SIZES]}
                        onChange={(v) => {
                            timing.current = { total: 0, on: true, timer: 0 };
                            setMs(null);
                            setSize(v);
                        }}
                    />
                </div>
            </div>
            {data ? (
                <div className="grid gap-6 lg:grid-cols-2">
                    <Section
                        className="lg:col-span-2"
                        title={`LineChart, ${rows} minutes`}
                        description="p50 and p95 latency a minute. The rare one-minute incidents stay as sharp as they are in the data; hover to read any minute, or focus and use the arrows (a press moves one pixel column)."
                        code={`<LineChart data={metrics} index="t" series={['p50', 'p95']} indexFormatter={minuteLabel} />`}
                    >
                        <Profiler id="LineChart" onRender={onRender}>
                            <LineChart
                                data={data.metrics}
                                index="t"
                                series={LATENCY_SERIES}
                                indexFormatter={minuteLabel}
                                valueFormatter={MS}
                                dots="none"
                                animate={false}
                                title={`Latency a minute, ${rows} minutes`}
                            />
                        </Profiler>
                    </Section>
                    <Section
                        title={`BarChart, ${rows} rows`}
                        description="Bars thinner than a pixel become pixel columns, one path a series."
                        code={`<BarChart data={metrics} index="t" series={['p95']} />`}
                    >
                        <Profiler id="BarChart" onRender={onRender}>
                            <BarChart
                                data={data.metrics}
                                index="t"
                                series={P95_SERIES}
                                indexFormatter={minuteLabel}
                                valueFormatter={MS}
                                animate={false}
                                height={200}
                                title={`p95 a minute, ${rows} minutes`}
                            />
                        </Profiler>
                    </Section>
                    <Section
                        title={`ScatterChart, ${rows} points`}
                        description="One path a region; a point on a pixel its region already covers adds nothing. Hover finds the nearest of all of them through a grid index."
                        code={`<ScatterChart data={points} x="kb" y="ms" groupBy="region" pointRadius={2} />`}
                    >
                        <Profiler id="ScatterChart" onRender={onRender}>
                            <ScatterChart
                                data={data.points}
                                x="kb"
                                y="ms"
                                groupBy="region"
                                pointRadius={2}
                                xFormatter={KB}
                                valueFormatter={MS}
                                animate={false}
                                height={200}
                                title={`Latency by payload, ${rows} requests`}
                            />
                        </Profiler>
                    </Section>
                    <Section
                        title={`TreemapChart, ${rows} files`}
                        description="The 150 largest files keep a tile; each tenant's rest folds into one Other tile that keeps their total."
                        code={`<TreemapChart data={files} category="mb" groupBy="tenant" />`}
                    >
                        <Profiler id="TreemapChart" onRender={onRender}>
                            <TreemapChart
                                data={data.files}
                                category="mb"
                                groupBy="tenant"
                                valueFormatter={MB}
                                animate={false}
                                height={240}
                                title={`Storage, ${rows} files`}
                            />
                        </Profiler>
                    </Section>
                    <Section
                        title={`WaterfallChart, ${rows} entries`}
                        description="Runs of entries are summed into one bar each, which is exact for a running total; the whisker shows how far the total swung inside a bar."
                        code={`<WaterfallChart data={ledger} index="entry" category="amount" />`}
                    >
                        <Profiler id="WaterfallChart" onRender={onRender}>
                            <WaterfallChart
                                data={data.ledger}
                                index="entry"
                                category="amount"
                                animate={false}
                                showLegend={false}
                                height={240}
                                title={`Ledger, ${rows} entries`}
                            />
                        </Profiler>
                    </Section>
                    <Section
                        className="lg:col-span-2"
                        title={`Tracker, ${rows} checks`}
                        description="A check a minute. Periods that share a bar take the worst status among them, so an outage never hides behind a good minute."
                        code={`<Tracker data={checks} />`}
                    >
                        <Profiler id="Tracker" onRender={onRender}>
                            <Tracker data={data.checks} height={28} title={`Uptime, ${rows} checks`} />
                        </Profiler>
                    </Section>
                </div>
            ) : (
                <ChartSkeleton height={240} />
            )}
        </div>
    );
}

// ── Page ──────────────────────────────────────────────────────

export function ChartsDemoPage() {
    const sample = useSampleData();
    const [curve, setCurve] = useState<Curve>('monotone');
    const [connect, setConnect] = useState(false);
    const [stack, setStack] = useState<StackMode>('stacked');
    const [clicked, setClicked] = useState<string | null>(null);
    const [range, setRange] = useState<RangeSelectPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [cell, setCell] = useState<string | null>(null);
    const exportRef = useRef<HTMLDivElement>(null);
    const [copied, setCopied] = useState(false);

    const last = sample.traffic[sample.traffic.length - 1];
    const prev = sample.traffic[sample.traffic.length - 8];
    const requests = sample.traffic.map((r) => r.requests ?? 0);
    const jobs = sample.traffic.map((r) => r.jobs);
    const signups = sample.signups.map((r) => r.signups);
    const errors = sample.jobs.map((r) => r.failed);

    const exportCsv = () => downloadText(toCsv(sample.signups), 'signups.csv');
    const copyCsv = async () => {
        setCopied(await copyText(toCsv(sample.signups)));
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className="space-y-8">
            <DemoPageHeader
                title="Charts"
                description="@ottabase/charts: zero-dependency SVG charts from a headless geometry engine, coloured by the brand engine's chart tokens. Switch the theme or dark mode and every chart follows. Hover, drag, or focus a chart and use the arrow keys."
            />

            <nav
                aria-label="Sections"
                className="sticky top-14 z-20 -mx-1 flex flex-wrap gap-1 rounded-lg border bg-background/90 p-1 backdrop-blur"
            >
                {SECTIONS.map((s) => (
                    <a
                        key={s.id}
                        href={`#${s.id}`}
                        className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors duration-fast ease-theme hover:bg-muted hover:text-foreground"
                    >
                        {s.label}
                    </a>
                ))}
            </nav>

            <Section
                title="Pick a chart"
                description="Start from the question. Every component below is one import from @ottabase/charts/react."
            >
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Question</TableHead>
                            <TableHead>Component</TableHead>
                            <TableHead>Note</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {CHOOSER.map(([q, c, n]) => (
                            <TableRow key={q}>
                                <TableCell className="font-medium">{q}</TableCell>
                                <TableCell className="font-mono text-xs">{c}</TableCell>
                                <TableCell className="text-muted-foreground">{n}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Section>

            {/* ── At a glance ───────────────────────────────── */}
            <div id="glance" className="scroll-mt-32 space-y-4">
                <Jump>At a glance</Jump>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Stat
                        label="Requests today"
                        value={formatCompact(last?.requests ?? 0)}
                        foot={
                            <span className="flex w-full items-center gap-3">
                                <Delta current={last?.requests ?? 0} previous={prev?.requests ?? 0} />
                                <Sparkline data={requests} className="flex-1" height={24} title="Requests, 30 days" />
                            </span>
                        }
                    />
                    <Stat
                        label="Queue jobs"
                        value={formatCompact(last?.jobs ?? 0)}
                        foot={
                            <span className="flex w-full items-center gap-3">
                                <Delta current={last?.jobs ?? 0} previous={prev?.jobs ?? 0} />
                                <Sparkline data={jobs} type="area" color={2} className="flex-1" height={24} />
                            </span>
                        }
                    />
                    <Stat
                        label="Signups (21d)"
                        value={signups.reduce((a, b) => a + b, 0)}
                        foot={
                            <span className="flex w-full items-center gap-3">
                                <Delta current={signups[signups.length - 1] ?? 0} previous={signups[0] ?? 0} />
                                <Sparkline data={signups} type="bar" color={4} className="flex-1" height={24} />
                            </span>
                        }
                    />
                    <Stat
                        label="Failed jobs (7d)"
                        value={errors.reduce((a, b) => a + b, 0)}
                        tone="red"
                        foot={
                            <span className="flex w-full items-center gap-3">
                                <Delta current={errors[errors.length - 1] ?? 0} previous={errors[0] ?? 0} invert />
                                <Sparkline data={errors} color="danger" className="flex-1" height={24} />
                            </span>
                        }
                    />
                </div>
                <div className="grid gap-6 lg:grid-cols-2">
                    <Section
                        title="ProgressCircle"
                        description="One value against its maximum. A quota near its limit takes a tone."
                        code={`<ProgressCircle value={38} max={50} title="Storage used" />
<ProgressCircle value={92} max={100} color="warning" variant="half" />`}
                    >
                        <div className="flex flex-wrap items-end gap-8">
                            <div className="flex flex-col items-center gap-2">
                                <ProgressCircle value={38} max={50} title="Storage used">
                                    <span className="text-lg font-semibold tabular-nums">38</span>
                                    <span className="text-[10px] text-muted-foreground">of 50 GB</span>
                                </ProgressCircle>
                                <span className="text-xs text-muted-foreground">Storage</span>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <ProgressCircle value={92} color="warning" size={96} title="API quota" />
                                <span className="text-xs text-muted-foreground">API quota</span>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <ProgressCircle value={64} variant="half" size={120} color={2} title="Goal" />
                                <span className="text-xs text-muted-foreground">Quarter goal</span>
                            </div>
                        </div>
                    </Section>
                    <Section
                        title="CategoryBar"
                        description="One bar split by category, with a quota marker. Hover a segment; the legend keys follow."
                        code={`<CategoryBar
    data={[
        { name: 'Images', value: 18.2 },
        { name: 'Video', value: 11.4, color: 2 },
        { name: 'Documents', value: 4.9, color: 3 },
        { name: 'Backups', value: 3.5, color: 'smoke' },
    ]}
    total={50}
    marker={{ value: 45, label: 'Soft limit' }}
    valueFormatter={(v) => \`\${v} GB\`}
/>`}
                    >
                        <CategoryBar
                            data={[
                                { name: 'Images', value: 18.2 },
                                { name: 'Video', value: 11.4, color: 2 },
                                { name: 'Documents', value: 4.9, color: 3 },
                                { name: 'Backups', value: 3.5, color: 'smoke' },
                            ]}
                            total={50}
                            marker={{ value: 45, label: 'Soft limit' }}
                            valueFormatter={(v) => `${v} GB`}
                            title="Storage by type"
                        />
                    </Section>
                </div>
            </div>

            {/* ── Trends ────────────────────────────────────── */}
            <div id="trends" className="scroll-mt-32 space-y-4">
                <Jump>Trends</Jump>
                <div className="grid gap-6 lg:grid-cols-2">
                    <Section
                        title="LineChart"
                        description="Two series with a gap (the collector was down), a weekend band, a deploy marker and direct end labels. Hover a legend key to emphasise a series."
                        actions={
                            <div className="flex flex-wrap items-center gap-3">
                                <Toggle label="Connect gaps" checked={connect} onChange={setConnect} />
                                <Choice
                                    label="Curve"
                                    value={curve}
                                    onChange={setCurve}
                                    options={['linear', 'monotone', 'step']}
                                />
                            </div>
                        }
                        code={`<LineChart
    data={traffic}
    index="day"
    series={[
        { key: 'requests', label: 'Requests' },
        { key: 'jobs', label: 'Queue jobs' },
    ]}
    curve="monotone"
    indexFormatter={dateFormatter('day')}
    referenceAreas={[{ from: weekend[0], to: weekend[1], label: 'Weekend' }]}
    annotations={[{ index: deployDay, label: 'v2.4 deploy', color: 'info' }]}
    showValues="last"
    title="Requests and queue jobs, last 30 days"
/>`}
                    >
                        <LineChart
                            data={sample.traffic}
                            index="day"
                            series={[
                                { key: 'requests', label: 'Requests' },
                                { key: 'jobs', label: 'Queue jobs' },
                            ]}
                            curve={curve}
                            connectNulls={connect}
                            indexFormatter={DAY_LABEL}
                            referenceAreas={[{ from: sample.weekend[0], to: sample.weekend[1], label: 'Weekend' }]}
                            annotations={[{ index: sample.deployDay, label: 'v2.4 deploy', color: 'info' }]}
                            showValues="last"
                            title="Requests and queue jobs, last 30 days"
                        />
                    </Section>

                    <Section
                        title="AreaChart"
                        description="Traffic by channel on a gradient fill. Stacked sums the series; percent shows each day's mix."
                        actions={
                            <Choice
                                label="Stack"
                                value={stack}
                                onChange={setStack}
                                options={['none', 'stacked', 'percent']}
                            />
                        }
                        code={`<AreaChart
    data={channels}
    index="day"
    series={['organic', 'referral', 'paid']}
    stack="stacked"   // 'none' | 'stacked' | 'percent'
    curve="monotone"
    indexFormatter={dateFormatter('day')}
/>`}
                    >
                        <AreaChart
                            data={sample.channels}
                            index="day"
                            series={[
                                { key: 'organic', label: 'Organic' },
                                { key: 'referral', label: 'Referral' },
                                { key: 'paid', label: 'Paid' },
                            ]}
                            stack={stack}
                            curve="monotone"
                            indexFormatter={DAY_LABEL}
                            title="Visits by channel, last 14 days"
                        />
                    </Section>
                </div>
            </div>

            {/* ── Comparison ────────────────────────────────── */}
            <div id="comparison" className="scroll-mt-32 space-y-4">
                <Jump>Comparison</Jump>
                <div className="grid gap-6 lg:grid-cols-2">
                    <Section
                        title="BarChart, stacked by status"
                        description="A status breakdown takes its tones. Drag across days to select a range; click a bar to drill in."
                        code={`<BarChart
    data={jobs}
    index="d"
    series={[
        { key: 'succeeded', label: 'Succeeded', color: 'success' },
        { key: 'retried', label: 'Retried', color: 'warning' },
        { key: 'failed', label: 'Failed', color: 'danger' },
    ]}
    stack="stacked"
    referenceLines={[{ value: 200, label: 'Capacity' }]}
    onValueClick={({ row }) => drillInto(row.d)}
    onRangeSelect={({ start, end, rows }) => setRange(rows)}
/>`}
                    >
                        <BarChart
                            data={sample.jobs}
                            index="d"
                            series={[
                                { key: 'succeeded', label: 'Succeeded', color: 'success' },
                                { key: 'retried', label: 'Retried', color: 'warning' },
                                { key: 'failed', label: 'Failed', color: 'danger' },
                            ]}
                            stack="stacked"
                            referenceLines={[{ value: 200, label: 'Capacity' }]}
                            onValueClick={({ row }) => setClicked(String(row.d))}
                            onRangeSelect={setRange}
                            title="Queue jobs by status, this week"
                        />
                        <p className="text-xs text-muted-foreground">
                            {range
                                ? `Selected ${range.rows[0]?.d}–${range.rows[range.rows.length - 1]?.d}: ${formatNumber(
                                      range.rows.reduce(
                                          (s, r) => s + Number(r.succeeded) + Number(r.retried) + Number(r.failed),
                                          0,
                                      ),
                                  )} jobs.`
                                : clicked
                                  ? `Clicked ${clicked}.`
                                  : 'Drag to select days, or Shift+→ from the keyboard.'}
                        </p>
                    </Section>

                    <Section
                        title="BarChart, horizontal"
                        description="Long category labels read better down the side. Stacked, with totals labelled."
                        code={`<BarChart
    data={tickets}
    index="area"
    series={[
        { key: 'open', label: 'Open', color: 'warning' },
        { key: 'closed', label: 'Closed', color: 'success' },
    ]}
    orientation="horizontal"
    stack="stacked"
    showValues
    height={220}
/>`}
                    >
                        <BarChart
                            data={sample.tickets}
                            index="area"
                            series={[
                                { key: 'open', label: 'Open', color: 'warning' },
                                { key: 'closed', label: 'Closed', color: 'success' },
                            ]}
                            orientation="horizontal"
                            stack="stacked"
                            showValues
                            height={220}
                            title="Support tickets by product area"
                        />
                    </Section>

                    <Section
                        title="ComboChart, two axes"
                        description="Daily signups as bars on the left axis, revenue as a line on the right. Each axis keeps its own unit."
                        code={`<ComboChart
    data={signups}
    index="day"
    series={[
        { key: 'signups', label: 'Signups' },
        { key: 'revenue', label: 'Revenue', type: 'line', axis: 'right', color: 5 },
    ]}
    rightAxis={{ valueFormatter: currencyFormatter('USD', true), title: 'Revenue' }}
    yTitle="Signups"
    indexFormatter={dateFormatter('day')}
/>`}
                    >
                        <ComboChart
                            data={sample.signups}
                            index="day"
                            series={[
                                { key: 'signups', label: 'Signups' },
                                { key: 'revenue', label: 'Revenue', type: 'line', axis: 'right', color: 5 },
                            ]}
                            rightAxis={{ valueFormatter: USD, title: 'Revenue' }}
                            yTitle="Signups"
                            indexFormatter={DAY_LABEL}
                            title="Signups and revenue"
                        />
                    </Section>

                    <Section
                        title="BarChart, grouped with labels"
                        description="Side-by-side bars with a value on each, and the legend on top."
                        code={`<BarChart
    data={tickets}
    index="area"
    series={['open', 'closed']}
    showValues
    legendPosition="top"
    indexFormatter={(v) => v.split(' ')[0]}
/>`}
                    >
                        <BarChart
                            data={sample.tickets}
                            index="area"
                            series={[
                                { key: 'open', label: 'Open' },
                                { key: 'closed', label: 'Closed' },
                            ]}
                            showValues
                            legendPosition="top"
                            indexFormatter={(v) => v.split(' ')[0] ?? v}
                            title="Tickets by area, grouped"
                        />
                    </Section>
                </div>
            </div>

            {/* ── Relationships ─────────────────────────────── */}
            <div id="relationships" className="scroll-mt-32 space-y-4">
                <Jump>Relationships</Jump>
                <div className="grid gap-6 lg:grid-cols-2">
                    <Section
                        title="ScatterChart"
                        description="Latency against payload size, one colour a region. Hover a point for its values; the dashed guides read it off both axes. Toggle a region in the legend."
                        code={`<ScatterChart
    data={requests}            // { region, kb, ms } rows
    x="kb"
    y="ms"
    groupBy="region"
    xTitle="Payload (KB)"
    yTitle="Latency (ms)"
    valueFormatter={(v) => \`\${v} ms\`}
/>`}
                    >
                        <ScatterChart
                            data={sample.requestsByRegion}
                            x="kb"
                            y="ms"
                            groupBy="region"
                            xTitle="Payload (KB)"
                            yTitle="Latency (ms)"
                            xFormatter={(v) => `${formatCompact(v)} KB`}
                            valueFormatter={(v) => `${formatCompact(v)} ms`}
                            onPointClick={({ row }) => setClicked(`${row.region} · ${row.kb} KB · ${row.ms} ms`)}
                            title="Latency by payload size"
                        />
                    </Section>
                    <Section
                        title="ScatterChart, bubbles"
                        description="Add size and it becomes a bubble chart: seats against MRR, each bubble's area its monthly usage. Small bubbles draw over big ones so every account stays reachable."
                        code={`<ScatterChart
    data={accounts}            // { name, plan, seats, mrr, usage }
    x="seats"
    y="mrr"
    size="usage"
    groupBy="plan"
    label="name"
    groups={[{ key: 'Starter' }, { key: 'Pro' }, { key: 'Team' }]}
    valueFormatter={currencyFormatter('USD', true)}
/>`}
                    >
                        <ScatterChart
                            data={sample.accounts}
                            x="seats"
                            y="mrr"
                            size="usage"
                            groupBy="plan"
                            label="name"
                            groups={[{ key: 'Starter' }, { key: 'Pro' }, { key: 'Team' }]}
                            xTitle="Seats"
                            yTitle="MRR"
                            sizeTitle="API calls"
                            valueFormatter={USD}
                            title="Accounts by seats and MRR"
                        />
                    </Section>
                    <Section
                        title="RadarChart"
                        description="A few things scored on the same measures. Hover or arrow round the spokes; hover a legend key to bring one plan forward."
                        code={`<RadarChart
    data={plans}               // { feature, starter, pro, team }
    index="feature"
    series={[
        { key: 'starter', label: 'Starter' },
        { key: 'pro', label: 'Pro' },
        { key: 'team', label: 'Team' },
    ]}
    maxValue={100}
/>`}
                    >
                        <RadarChart
                            data={sample.plans}
                            index="feature"
                            series={[
                                { key: 'starter', label: 'Starter' },
                                { key: 'pro', label: 'Pro' },
                                { key: 'team', label: 'Team' },
                            ]}
                            maxValue={100}
                            title="Plans by feature"
                        />
                    </Section>
                    <Section
                        title="RadarChart, one series"
                        description="Round rings and a single outline: a service's health across eight signals, scored out of 100."
                        code={`<RadarChart data={health} index="signal" series={[{ key: 'score', color: 'success' }]} grid="circle" maxValue={100} />`}
                    >
                        <RadarChart
                            data={sample.health}
                            index="signal"
                            series={[{ key: 'score', label: 'Score', color: 'success' }]}
                            grid="circle"
                            maxValue={100}
                            levels={5}
                            title="Service health"
                        />
                    </Section>
                </div>
                {clicked && <p className="text-xs text-muted-foreground">Last clicked: {clicked}</p>}
            </div>

            {/* ── Composition ───────────────────────────────── */}
            <div id="composition" className="scroll-mt-32 space-y-4">
                <Jump>Composition</Jump>
                <div className="grid gap-6 lg:grid-cols-2">
                    <Section
                        title="DonutChart"
                        description="Part of a whole. Hover a slice or a legend key; the centre and the tooltip follow. A half donut suits a gauge-like breakdown."
                        code={`<DonutChart
    data={[{ name: 'Active', value: 9 }, { name: 'In grace', value: 1 }, { name: 'Expired', value: 1 }, { name: 'Unlicensed', value: 3 }]}
    colors={{ Active: 'success', 'In grace': 'warning', Expired: 'danger', Unlicensed: 'smoke' }}
    label="packages"
/>
<DonutChart data={plans} variant="half" sort size={180} />
<DonutChart data={revenue} variant="pie" valueFormatter={currencyFormatter('USD', true)} legendPosition="right" />`}
                    >
                        <div className="flex flex-wrap items-start justify-around gap-6">
                            <DonutChart
                                data={[
                                    { name: 'Active', value: 9 },
                                    { name: 'In grace', value: 1 },
                                    { name: 'Expired', value: 1 },
                                    { name: 'Unlicensed', value: 3 },
                                ]}
                                colors={{
                                    Active: 'success',
                                    'In grace': 'warning',
                                    Expired: 'danger',
                                    Unlicensed: 'smoke',
                                }}
                                label="packages"
                                title="Package licenses"
                            />
                            <DonutChart
                                data={[
                                    { name: 'Starter', value: 410 },
                                    { name: 'Pro', value: 260 },
                                    { name: 'Team', value: 95 },
                                ]}
                                variant="half"
                                sort
                                size={180}
                                label="accounts"
                                title="Accounts by plan"
                            />
                            <DonutChart
                                data={[
                                    { name: 'Pro', value: 4200 },
                                    { name: 'Team', value: 2600 },
                                    { name: 'Starter', value: 1100 },
                                ]}
                                variant="pie"
                                size={140}
                                valueFormatter={USD}
                                legendPosition="right"
                                title="Revenue by plan"
                            />
                        </div>
                    </Section>

                    <Section
                        title="FunnelChart"
                        description="Conversion through ordered steps, with the rate from each step to the next."
                        code={`<FunnelChart
    data={[
        { name: 'Visited', value: 12400 },
        { name: 'Signed up', value: 3100 },
        { name: 'Activated', value: 1900 },
        { name: 'Paid', value: 420 },
    ]}
    onStepClick={(step) => openSegment(step.name)}
/>`}
                    >
                        <FunnelChart
                            data={[
                                { name: 'Visited', value: 12400 },
                                { name: 'Signed up', value: 3100 },
                                { name: 'Activated', value: 1900 },
                                { name: 'Paid', value: 420 },
                            ]}
                            onStepClick={(step) => setClicked(step.name)}
                            title="Signup funnel"
                        />
                    </Section>

                    <Section
                        className="lg:col-span-2"
                        title="FunnelChart, flow"
                        description="One column per step with the count and its share of the first step on top. Bands ease between steps, split by channel. Hover a legend key to emphasise a channel."
                        code={`<FunnelChart
    variant="flow"
    series={[
        { key: 'direct', label: 'Direct' },
        { key: 'social', label: 'Social media' },
        { key: 'ads', label: 'Ads' },
    ]}
    data={[
        { name: 'Impressions', breakdown: { direct: 6000, social: 2400, ads: 4100 } },
        { name: 'Add to cart', breakdown: { direct: 3800, social: 1100, ads: 800 } },
        { name: 'Buy', breakdown: { direct: 720, social: 130, ads: 80 } },
    ]}
    valueFormatter={formatNumber}
/>`}
                    >
                        <FunnelChart
                            variant="flow"
                            series={[
                                { key: 'direct', label: 'Direct' },
                                { key: 'social', label: 'Social media' },
                                { key: 'ads', label: 'Ads' },
                            ]}
                            data={[
                                { name: 'Impressions', breakdown: { direct: 6000, social: 2400, ads: 4100 } },
                                { name: 'Add to cart', breakdown: { direct: 3800, social: 1100, ads: 800 } },
                                { name: 'Buy', breakdown: { direct: 720, social: 130, ads: 80 } },
                            ]}
                            valueFormatter={formatNumber}
                            onStepClick={(step) => setClicked(step.name)}
                            title="Checkout funnel by channel"
                        />
                    </Section>

                    <Section
                        className="lg:col-span-2"
                        title="SankeyChart"
                        description="Where traffic goes: sources on the left, outcomes on the right, each band as thick as its flow. Hover a node to trace it, or a band for its value."
                        code={`<SankeyChart
    data={{
        nodes: [{ name: 'Search' }, { name: 'Social' }, { name: 'Email' }, { name: 'Pricing' }, /* … */],
        links: [
            { source: 'Search', target: 'Pricing', value: 3200 },
            { source: 'Social', target: 'Blog', value: 2600 },
            /* … */
        ],
    }}
    height={320}
/>`}
                    >
                        <SankeyChart
                            data={SANKEY}
                            height={320}
                            valueFormatter={formatNumber}
                            title="Traffic from source to outcome"
                        />
                    </Section>

                    <Section
                        className="lg:col-span-2"
                        title="TreemapChart, grouped"
                        description="Area by value in blocks: storage by tenant, then by bucket. A tenant takes a slot; hover a tile for its share of the tenant and of the whole, or a legend key to find a tenant."
                        code={`<TreemapChart
    data={storage}             // { tenant, bucket, gb } rows
    index="bucket"
    category="gb"
    groupBy="tenant"
    valueFormatter={(v) => \`\${v} GB\`}
    height={320}
/>`}
                    >
                        <TreemapChart
                            data={sample.storage}
                            index="bucket"
                            category="gb"
                            groupBy="tenant"
                            valueFormatter={(v) => `${formatCompact(v)} GB`}
                            height={320}
                            onTileClick={(t) => setClicked(`${t.group} / ${t.name} · ${t.value} GB`)}
                            title="Storage by tenant and bucket"
                        />
                    </Section>
                    <Section
                        title="TreemapChart, flat"
                        description="One colour, 2px gaps: what a bundle is made of. Labels appear where a tile has room for them."
                        code={`<TreemapChart data={bundle} category="kb" color={3} valueFormatter={(v) => \`\${v} KB\`} />`}
                    >
                        <TreemapChart
                            data={sample.bundle}
                            category="kb"
                            color={3}
                            height={240}
                            valueFormatter={(v) => `${v} KB`}
                            title="Bundle by module"
                        />
                    </Section>
                    <Section
                        title="WaterfallChart"
                        description="How October's MRR became November's. The first row is a total with a value, the opening balance; each change floats from the running total, and the closing total is added."
                        code={`<WaterfallChart
    data={[
        { step: 'Oct 1 MRR', value: 48200, total: true },
        { step: 'New', value: 6400 },
        { step: 'Expansion', value: 2150 },
        { step: 'Contraction', value: -920 },
        { step: 'Churn', value: -2640 },
    ]}
    index="step"
    totalKey="total"
    totalLabel="Nov 1 MRR"
    valueFormatter={currencyFormatter('USD', true)}
/>`}
                    >
                        <WaterfallChart
                            data={sample.mrr}
                            index="step"
                            totalKey="total"
                            totalLabel="Nov 1 MRR"
                            valueFormatter={USD}
                            height={240}
                            title="MRR bridge"
                        />
                    </Section>
                    <Section
                        className="lg:col-span-2"
                        title="WaterfallChart, subtotals"
                        description="Net cash by month with a subtotal at each quarter end (rows with subtotal: true). colors sets each kind; here calm tones, since the quarters matter more than any one month."
                        code={`<WaterfallChart
    data={cash}                // { month, net } plus { month: 'Q1', subtotal: true }
    index="month"
    category="net"
    totalKey="subtotal"
    showTotal={false}  // Q3 is already the year so far
    colors={{ increase: 'info', decrease: 'warning', total: 'neutral' }}
/>`}
                    >
                        <WaterfallChart
                            data={sample.cash}
                            index="month"
                            category="net"
                            totalKey="subtotal"
                            showTotal={false}
                            colors={{ increase: 'info', decrease: 'warning', total: 'neutral' }}
                            valueFormatter={USD}
                            height={260}
                            title="Net cash by month"
                        />
                    </Section>
                </div>
            </div>

            {/* ── Rankings ──────────────────────────────────── */}
            <div id="rankings" className="scroll-mt-32 space-y-4">
                <Jump>Rankings</Jump>
                <div className="grid gap-6 lg:grid-cols-2">
                    <Section
                        title="BarList"
                        description="Ranked rows with an in-row bar and each row's share. renderName takes a router link."
                        code={`<BarList
    labels={['Page', 'Visits']}
    showPercent
    data={[{ name: '/', value: 9120 }, { name: '/pricing', value: 3480 }, /* … */]}
    renderName={(item) => <Link to={item.name}>{item.name}</Link>}
/>`}
                    >
                        <BarList
                            labels={['Page', 'Visits']}
                            showPercent
                            data={[
                                { name: '/', value: 9120 },
                                { name: '/pricing', value: 3480 },
                                { name: '/docs/quickstart', value: 2210 },
                                { name: '/blog/edge-native-saas', value: 1640 },
                                { name: '/changelog', value: 720 },
                            ]}
                        />
                    </Section>
                    <Section
                        title="BarList with icons"
                        description="An icon or code before the name; rows are buttons when onSelect is set."
                        code={`<BarList
    labels={['Country', 'Clicks']}
    color={2}
    data={[{ name: 'United States', value: 4120, icon: <Code>US</Code> }, /* … */]}
    onSelect={(item) => filterBy(item.name)}
/>`}
                    >
                        <BarList
                            labels={['Country', 'Clicks']}
                            color={2}
                            data={[
                                { name: 'United States', value: 4120, icon: <Code>US</Code> },
                                { name: 'Germany', value: 1860, icon: <Code>DE</Code> },
                                { name: 'India', value: 1540, icon: <Code>IN</Code> },
                                { name: 'United Kingdom', value: 980, icon: <Code>GB</Code> },
                                { name: 'Brazil', value: 610, icon: <Code>BR</Code> },
                            ]}
                            onSelect={(item) => setClicked(item.name)}
                        />
                    </Section>
                </div>
            </div>

            {/* ── Density ───────────────────────────────────── */}
            <div id="density" className="scroll-mt-32 space-y-4">
                <Jump>Density</Jump>
                <Section
                    title="Heatmap"
                    description="Two categories coloured by value: requests by hour and weekday. Click a cell to filter."
                    code={`<Heatmap
    data={hourly}          // { hour, day, value } rows
    x="hour"
    y="day"
    xDomain={Array.from({ length: 24 }, (_, h) => String(h))}
    yDomain={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']}
    xFormatter={(h) => \`\${h}h\`}
    onCellClick={(cell) => filter(cell.y, cell.x)}
/>`}
                >
                    <Heatmap
                        data={sample.hourly}
                        x="hour"
                        y="day"
                        xDomain={Array.from({ length: 24 }, (_, h) => String(h))}
                        yDomain={WEEKDAYS}
                        xFormatter={(h) => `${h}h`}
                        onCellClick={(c) => setCell(`${c.y} ${c.x}:00 · ${c.value ?? 0} requests`)}
                        title="Requests by hour and weekday"
                    />
                    <p className="text-xs text-muted-foreground">{cell ?? 'Click a cell.'}</p>
                </Section>
                <Section
                    title="CalendarHeatmap"
                    description="A year of daily activity, one cell per UTC day."
                    code={`<CalendarHeatmap data={activity} unit="events" onCellClick={(cell) => openDay(cell.date)} />`}
                >
                    <CalendarHeatmap
                        data={sample.activity}
                        unit="events"
                        onCellClick={(c) => setCell(`${c.date} · ${c.value} events`)}
                        title="Daily activity, past year"
                    />
                </Section>
            </div>

            {/* ── Status ────────────────────────────────────── */}
            <div id="status" className="scroll-mt-32 space-y-4">
                <Jump>Status</Jump>
                <Section
                    title="Tracker & Sparkline"
                    description="A status strip per day with a two-line tooltip, and word-sized trends for tables."
                    code={`<Tracker data={days.map((d) => ({ color: d.tone, tooltip: d.label, detail: d.detail }))} />
<Sparkline data={[3, 5, 4, 8, 7, 9]} type="area" color={2} height={40} />`}
                >
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>90 days ago</span>
                                <span>Today</span>
                            </div>
                            <Tracker data={sample.uptime} title="Uptime, last 90 days" />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                            {(['line', 'area', 'bar'] as const).map((type, i) => (
                                <div key={type} className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="capitalize text-muted-foreground">{type}</span>
                                        <span className="font-medium tabular-nums">
                                            {USD(sample.revenue[sample.revenue.length - 1] ?? 0)}
                                        </span>
                                    </div>
                                    <Sparkline data={sample.revenue} type={type} color={i + 1} height={40} />
                                </div>
                            ))}
                        </div>
                    </div>
                </Section>
            </div>

            {/* ── States & interaction ──────────────────────── */}
            <div id="states" className="scroll-mt-32 space-y-4">
                <Jump>States & interaction</Jump>
                <div className="grid gap-6 lg:grid-cols-2">
                    <Section
                        title="Loading and empty"
                        description="A skeleton while the query runs, a dashed frame when it returns nothing. ChartSkeleton is the same placeholder for any other chart."
                        actions={<Toggle label="Loading" checked={loading} onChange={setLoading} />}
                        code={`<LineChart data={data ?? []} loading={isPending} emptyText="No clicks in this range" … />

{isPending ? <ChartSkeleton height={240} /> : <SankeyChart data={data} />}`}
                    >
                        <LineChart
                            data={[]}
                            index="day"
                            series={['requests']}
                            loading={loading}
                            height={160}
                            emptyText="No clicks in this range"
                            title="Empty state"
                        />
                    </Section>
                    <Section
                        title="Custom tooltip"
                        description="renderTooltip gets the row and every series value; TooltipContent keeps the house style."
                        code={`<AreaChart
    …
    renderTooltip={(ctx) => (
        <TooltipContent
            title={ctx.label}
            items={ctx.series.map((s) => ({ key: s.key, label: s.label, color: s.color, value: s.formatted }))}
            footer={{ key: 'share', label: 'Paid share', value: formatPercent(ctx.row.paid / total) }}
        />
    )}
/>`}
                    >
                        <AreaChart
                            data={sample.channels}
                            index="day"
                            series={[
                                { key: 'organic', label: 'Organic' },
                                { key: 'paid', label: 'Paid', color: 3 },
                            ]}
                            curve="monotone"
                            height={160}
                            indexFormatter={DAY_LABEL}
                            renderTooltip={(ctx) => {
                                const organic = Number(ctx.row.organic ?? 0);
                                const paid = Number(ctx.row.paid ?? 0);
                                return (
                                    <TooltipContent
                                        title={ctx.label}
                                        items={ctx.series.map((s) => ({
                                            key: s.key,
                                            label: s.label,
                                            color: s.color,
                                            value: s.formatted,
                                        }))}
                                        footer={{
                                            key: 'share',
                                            label: 'Paid share',
                                            value: `${Math.round((paid / Math.max(1, organic + paid)) * 100)}%`,
                                        }}
                                    />
                                );
                            }}
                            title="Custom tooltip"
                        />
                    </Section>
                </div>
            </div>

            {/* ── Export ────────────────────────────────────── */}
            <div id="export" className="scroll-mt-32 space-y-4">
                <Jump>Export</Jump>
                <Section
                    title="Download and copy"
                    description="exportChart inlines the theme colours and saves PNG or SVG; toCsv turns the rows into a file or the clipboard."
                    actions={
                        <div className="flex flex-wrap gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                    exportRef.current && exportChart(exportRef.current, { filename: 'signups' })
                                }
                            >
                                PNG
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                    exportRef.current &&
                                    exportChart(exportRef.current, { format: 'svg', filename: 'signups' })
                                }
                            >
                                SVG
                            </Button>
                            <Button size="sm" variant="outline" onClick={exportCsv}>
                                CSV
                            </Button>
                            <Button size="sm" variant="outline" onClick={copyCsv}>
                                {copied ? 'Copied' : 'Copy CSV'}
                            </Button>
                        </div>
                    }
                    code={`import { toCsv } from '@ottabase/charts';
import { copyText, downloadText, exportChart } from '@ottabase/charts/react';

await exportChart(chartRef.current, { format: 'png', filename: 'signups' });
downloadText(toCsv(rows), 'signups.csv');
await copyText(toCsv(rows));`}
                >
                    <div ref={exportRef}>
                        <BarChart
                            data={sample.signups}
                            index="day"
                            series={[{ key: 'signups', label: 'Signups' }]}
                            indexFormatter={DAY_LABEL}
                            height={180}
                            animate={false}
                            title="Signups, last 21 days"
                        />
                    </div>
                </Section>
            </div>

            {/* ── Large data: last, so the heavy section never sits between the others ── */}
            <LargeDataSection />
        </div>
    );
}
