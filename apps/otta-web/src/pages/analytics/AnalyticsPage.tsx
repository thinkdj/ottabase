import { PACKAGES_ENABLED } from '@/ottabase/config';
import { useApiQuery } from '@ottabase/ottaorm/client';
import { LoadingState } from '@ottabase/ui-components';
import {
    Alert,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@ottabase/ui-shadcn';
import { IconChartBar, IconLink, IconLoader2, IconRefresh, IconUsers } from '@tabler/icons-react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

export interface AnalyticsRow {
    dimension: string;
    clicks?: number;
    value?: number;
}

export interface AnalyticsResponse {
    data: AnalyticsRow[];
    meta: {
        groupBy: string;
        days: number;
        shortCode?: string | null;
        referralCode?: string | null;
        event?: string | null;
    };
}

type Tab = 'core' | 'shortlinks' | 'referrals';

interface GroupByOption {
    value: string;
    label: string;
    /** The results card description while this grouping is active */
    results: string;
}

/** Everything that differs between the three analytics tabs. */
interface SectionConfig {
    key: Tab;
    endpoint: string;
    binding: string;
    description: string;
    filter: { label: string; param: string };
    groupBy: GroupByOption[];
    /** Where a grouped code links to */
    linkTo: string;
    valueLabel: string;
}

const SECTIONS: Record<Tab, SectionConfig> = {
    core: {
        key: 'core',
        endpoint: '/api/analytics/core',
        binding: 'OBCF_ANALYTICS_CORE',
        description: 'Core event analytics (page_view, button_click, etc.)',
        filter: { label: 'Event', param: 'event' },
        groupBy: [
            { value: 'event', label: 'Event', results: 'Events by type' },
            { value: 'country', label: 'Country', results: 'Events by country' },
            { value: 'day', label: 'Day', results: 'Events over time' },
        ],
        linkTo: '/analytics',
        valueLabel: 'Events',
    },
    shortlinks: {
        key: 'shortlinks',
        endpoint: '/api/shortlinks/analytics',
        binding: 'OBCF_ANALYTICS_SHORTLINKS',
        description: 'Shortlink clicks',
        filter: { label: 'Short code', param: 'shortCode' },
        groupBy: [
            { value: 'country', label: 'Country', results: 'Clicks by country' },
            { value: 'shortCode', label: 'Short code', results: 'Clicks by short code' },
            { value: 'day', label: 'Day', results: 'Clicks over time' },
        ],
        linkTo: '/shortlinks',
        valueLabel: 'Clicks',
    },
    referrals: {
        key: 'referrals',
        endpoint: '/api/referrals/analytics',
        binding: 'OBCF_ANALYTICS_REFERRALS',
        description: 'Referral link clicks',
        filter: { label: 'Referral code', param: 'referralCode' },
        groupBy: [
            { value: 'country', label: 'Country', results: 'Clicks by country' },
            { value: 'referralCode', label: 'Referral code', results: 'Clicks by referral code' },
            { value: 'day', label: 'Day', results: 'Clicks over time' },
        ],
        linkTo: '/referrals',
        valueLabel: 'Clicks',
    },
};

const PERIODS = ['1', '7', '14', '30', '90'];
const headingClass = 'text-[0.9375rem] font-semibold';
const thClass = 'text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground';

const rowValue = (row: AnalyticsRow) => Math.round(row.clicks ?? row.value ?? 0);

/** Day buckets read as dates; other dimensions show as the API returned them. */
function formatDimension(groupBy: string, dimension: string): string {
    if (groupBy === 'day' && /^\d{4}-\d{2}-\d{2}/.test(dimension)) {
        return new Date(dimension).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return dimension || 'Unknown';
}

/** Detect dev: Vite dev mode or viewing from localhost */
function isDevEnvironment(): boolean {
    if (typeof window === 'undefined') return false;
    if (import.meta.env?.DEV) return true;
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
}

export function AnalyticsPage() {
    const navigate = useNavigate();
    const search = useSearch({ strict: false }) as { tab?: string; code?: string };
    const shortlinksEnabled = PACKAGES_ENABLED.shortlinks;
    const referralsEnabled = PACKAGES_ENABLED.referrals;

    // Resolve valid tab from URL; fallback to core if package disabled
    const resolveTab = (): Tab => {
        if (search?.tab === 'referrals' && referralsEnabled) return 'referrals';
        if (search?.tab === 'shortlinks' && shortlinksEnabled) return 'shortlinks';
        return 'core';
    };
    const [tab, setTab] = useState<Tab>(resolveTab);

    // Sync tab from URL on mount/navigation
    useEffect(() => {
        if (search?.tab === 'referrals' && referralsEnabled) setTab('referrals');
        else if (search?.tab === 'shortlinks' && shortlinksEnabled) setTab('shortlinks');
        else if (search?.tab === 'core') setTab('core');
    }, [search?.tab, shortlinksEnabled, referralsEnabled]);

    const handleTabChange = (value: string) => {
        setTab(value as Tab);
        void navigate({ to: '/analytics', search: { tab: value as Tab } });
    };

    const tabsList = [
        { value: 'core' as const, label: 'Core' },
        ...(shortlinksEnabled ? [{ value: 'shortlinks' as const, label: 'Shortlinks' }] : []),
        ...(referralsEnabled ? [{ value: 'referrals' as const, label: 'Referrals' }] : []),
    ];

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                        <IconChartBar className="h-7 w-7 text-primary" />
                        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Analytics</h1>
                    </div>
                    <p className="text-muted-foreground">
                        Click data from Cloudflare Analytics Engine (WAE). Data retention: 3 months.
                    </p>
                </div>
                <div className="flex shrink-0 gap-2">
                    {shortlinksEnabled && (
                        <Button variant="outline" asChild>
                            <Link to="/shortlinks">
                                <IconLink className="mr-2 h-4 w-4" />
                                Shortlinks
                            </Link>
                        </Button>
                    )}
                    {referralsEnabled && (
                        <Button variant="outline" asChild>
                            <Link to="/referrals">
                                <IconUsers className="mr-2 h-4 w-4" />
                                Referrals
                            </Link>
                        </Button>
                    )}
                </div>
            </div>

            <Tabs value={tab} onValueChange={handleTabChange}>
                <TabsList>
                    {tabsList.map((t) => (
                        <TabsTrigger key={t.value} value={t.value}>
                            {t.label}
                        </TabsTrigger>
                    ))}
                </TabsList>

                <TabsContent value="core" className="mt-6">
                    <AnalyticsSection config={SECTIONS.core} />
                </TabsContent>
                {shortlinksEnabled && (
                    <TabsContent value="shortlinks" className="mt-6">
                        {/* A code in the URL (from a row on the shortlinks page) seeds the filter */}
                        <AnalyticsSection
                            key={search.code ?? ''}
                            config={SECTIONS.shortlinks}
                            initialFilter={search.code}
                        />
                    </TabsContent>
                )}
                {referralsEnabled && (
                    <TabsContent value="referrals" className="mt-6">
                        <AnalyticsSection config={SECTIONS.referrals} />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}

function AnalyticsSection({ config, initialFilter = '' }: { config: SectionConfig; initialFilter?: string }) {
    const [filter, setFilter] = useState(initialFilter);
    const [days, setDays] = useState('7');
    const [groupBy, setGroupBy] = useState(config.groupBy[0].value);

    const params = new URLSearchParams({ days, groupBy });
    if (filter) params.set(config.filter.param, filter);
    const {
        data: response,
        error,
        isFetching: loading,
        refetch,
    } = useApiQuery<AnalyticsResponse>({
        entity: 'analytics',
        queryKey: [config.key, filter, days, groupBy],
        endpoint: `${config.endpoint}?${params.toString()}`,
        queryOptions: { meta: { errorPresentation: 'local' } },
    });
    const data = error ? [] : (response?.data ?? []);
    const option = config.groupBy.find((g) => g.value === groupBy) ?? config.groupBy[0];

    return (
        <div className="space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className={headingClass}>Filters</CardTitle>
                    <CardDescription>
                        {config.description} · Binding:{' '}
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{config.binding}</code>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="min-w-[160px] space-y-1.5">
                            <Label htmlFor={`${config.key}-filter`}>{config.filter.label}</Label>
                            <Input
                                id={`${config.key}-filter`}
                                placeholder="All"
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="h-9"
                            />
                        </div>
                        <div className="min-w-[140px] space-y-1.5">
                            <Label htmlFor={`${config.key}-days`}>Period</Label>
                            <Select value={days} onValueChange={setDays}>
                                <SelectTrigger id={`${config.key}-days`}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {PERIODS.map((d) => (
                                        <SelectItem key={d} value={d}>
                                            {d === '1' ? 'Last day' : `Last ${d} days`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="min-w-[140px] space-y-1.5">
                            <Label htmlFor={`${config.key}-group`}>Group by</Label>
                            <Select value={groupBy} onValueChange={setGroupBy}>
                                <SelectTrigger id={`${config.key}-group`}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {config.groupBy.map((g) => (
                                        <SelectItem key={g.value} value={g.value}>
                                            {g.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            variant="secondary"
                            size="icon"
                            aria-label="Refresh"
                            onClick={() => void refetch()}
                            disabled={loading}
                        >
                            {loading ? (
                                <IconLoader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <IconRefresh className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {error?.message && <Alert variant="destructive">{error.message}</Alert>}

            <AnalyticsResults
                loading={loading}
                data={data}
                days={Number(days)}
                description={option.results}
                dimensionLabel={option.label}
                groupBy={groupBy}
                linkTo={config.linkTo}
                valueLabel={config.valueLabel}
            />
        </div>
    );
}

function AnalyticsResults({
    loading,
    data,
    days,
    description,
    dimensionLabel,
    groupBy,
    linkTo,
    valueLabel,
}: {
    loading: boolean;
    data: AnalyticsRow[];
    days: number;
    description: string;
    dimensionLabel: string;
    groupBy: string;
    linkTo: string;
    valueLabel: string;
}) {
    const total = data.reduce((sum, row) => sum + rowValue(row), 0);
    const max = Math.max(1, ...data.map(rowValue));
    const showLink = groupBy === 'shortCode' || groupBy === 'referralCode';

    return (
        <Card>
            <CardHeader>
                <CardTitle className={headingClass}>Results</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {loading ? (
                    <LoadingState kind="table" count={5} label="Loading analytics" />
                ) : data.length === 0 ? (
                    <AnalyticsEmptyState />
                ) : (
                    <>
                        <p className="text-sm text-muted-foreground">
                            <span className="text-2xl font-semibold tabular-nums text-foreground">
                                {total.toLocaleString()}
                            </span>{' '}
                            {valueLabel.toLowerCase()} in the last {days === 1 ? 'day' : `${days} days`}
                        </p>
                        <div className="overflow-x-auto rounded-xl bg-background ring-1 ring-border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className={thClass}>{dimensionLabel}</TableHead>
                                        <TableHead className={`${thClass} w-1/2`}>
                                            <span className="sr-only">Share of {valueLabel.toLowerCase()}</span>
                                        </TableHead>
                                        <TableHead className={`${thClass} text-right`}>{valueLabel}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.map((row) => {
                                        const value = rowValue(row);
                                        return (
                                            <TableRow key={row.dimension}>
                                                <TableCell>
                                                    {showLink ? (
                                                        <Link
                                                            to={linkTo}
                                                            className="font-mono text-primary hover:underline"
                                                        >
                                                            {row.dimension}
                                                        </Link>
                                                    ) : (
                                                        <span className="text-sm">
                                                            {formatDimension(groupBy, row.dimension)}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="h-2 rounded-full bg-muted" aria-hidden="true">
                                                        <div
                                                            className="h-2 rounded-full bg-primary"
                                                            style={{ width: `${Math.max(2, (value / max) * 100)}%` }}
                                                        />
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {value.toLocaleString()}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

function AnalyticsEmptyState() {
    return (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-background py-12 ring-1 ring-border">
            <IconChartBar className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No data yet. Data will appear once tracking is active.</p>
            {isDevEnvironment() && (
                <p className="max-w-sm text-center text-xs text-muted-foreground">
                    WAE only works on the edge (worker.dev or custom domain). Localhost clicks are not tracked.
                </p>
            )}
        </div>
    );
}
