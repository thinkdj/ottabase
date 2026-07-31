import { PACKAGES_ENABLED } from '@/ottabase/config';
import { useApiQuery } from '@ottabase/ottaorm/client';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
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

/** Card/section title inside analytics tabs (Filters, Results) */
const headingClass = 'text-[0.9375rem] font-semibold';

/** Detect dev: Vite dev mode or viewing from localhost */
function isDevEnvironment(): boolean {
    if (typeof window === 'undefined') return false;
    if (import.meta.env?.DEV) return true;
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
}

function AnalyticsEmptyState() {
    const isDev = isDevEnvironment();
    return (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-background py-12 ring-1 ring-border">
            <IconChartBar className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No data yet. Data will appear once tracking is active.</p>
            {isDev && (
                <p className="max-w-sm text-center text-xs text-muted-foreground">
                    WAE only works on the edge (worker.dev or custom domain). Localhost clicks are not tracked.
                </p>
            )}
        </div>
    );
}

function AnalyticsResultsCard({
    loading,
    data,
    description,
    groupBy,
    formatDimension,
    linkTo,
    dimensionLabel,
    valueLabel = 'Clicks',
}: {
    loading: boolean;
    data: AnalyticsRow[];
    description: string;
    groupBy: string;
    formatDimension: (dim: string) => string;
    linkTo: string;
    dimensionLabel?: string;
    valueLabel?: string;
}) {
    return (
        <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
            <CardHeader>
                <CardTitle className="text-[0.9375rem] font-semibold">Results</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="space-y-2" aria-busy="true">
                        <span className="sr-only">Loading analytics...</span>
                        {Array.from({ length: 5 }, (_, i) => (
                            <div key={i} className="h-11 animate-pulse rounded-lg bg-muted/40" />
                        ))}
                    </div>
                ) : data.length === 0 ? (
                    <AnalyticsEmptyState />
                ) : (
                    <AnalyticsTable
                        data={data}
                        groupBy={groupBy}
                        formatDimension={formatDimension}
                        linkTo={linkTo}
                        dimensionLabel={dimensionLabel}
                        valueLabel={valueLabel}
                    />
                )}
            </CardContent>
        </Card>
    );
}

export function AnalyticsPage() {
    const navigate = useNavigate();
    const search = useSearch({ strict: false }) as { tab?: string };
    const shortlinksEnabled = PACKAGES_ENABLED.shortlinks;
    const referralsEnabled = PACKAGES_ENABLED.referrals;

    // Resolve valid tab from URL; fallback to core if package disabled
    const resolveTab = (): 'shortlinks' | 'referrals' | 'core' => {
        if (search?.tab === 'referrals' && referralsEnabled) return 'referrals';
        if (search?.tab === 'shortlinks' && shortlinksEnabled) return 'shortlinks';
        return 'core';
    };
    const [tab, setTab] = useState<'shortlinks' | 'referrals' | 'core'>(resolveTab);

    // Sync tab from URL on mount/navigation
    useEffect(() => {
        if (search?.tab === 'referrals' && referralsEnabled) setTab('referrals');
        else if (search?.tab === 'shortlinks' && shortlinksEnabled) setTab('shortlinks');
        else if (search?.tab === 'core') setTab('core');
    }, [search?.tab, shortlinksEnabled, referralsEnabled]);

    const handleTabChange = (v: string) => {
        setTab(v as 'shortlinks' | 'referrals' | 'core');
        navigate({ to: '/analytics', search: { tab: v } });
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
                    <CoreAnalyticsTab />
                </TabsContent>
                {shortlinksEnabled && (
                    <TabsContent value="shortlinks" className="mt-6">
                        <ShortlinkAnalyticsTab />
                    </TabsContent>
                )}
                {referralsEnabled && (
                    <TabsContent value="referrals" className="mt-6">
                        <ReferralAnalyticsTab />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}

function ShortlinkAnalyticsTab() {
    const [shortCode, setShortCode] = useState<string>('');
    const [days, setDays] = useState<string>('7');
    const [groupBy, setGroupBy] = useState<string>('country');

    const params = new URLSearchParams({ days, groupBy });
    if (shortCode) params.set('shortCode', shortCode);
    const {
        data: response,
        error,
        isFetching: loading,
        refetch,
    } = useApiQuery<AnalyticsResponse>({
        entity: 'analytics',
        queryKey: ['shortlinks', shortCode, days, groupBy],
        endpoint: `/api/shortlinks/analytics?${params.toString()}`,
        queryOptions: {
            meta: { errorPresentation: 'local' },
        },
    });
    const data = error ? [] : (response?.data ?? []);

    const formatDimension = (dim: string) => {
        if (groupBy === 'day' && /^\d{4}-\d{2}-\d{2}/.test(dim)) {
            return new Date(dim).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            });
        }
        return dim || '—';
    };

    return (
        <div className="space-y-8">
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className={headingClass}>Filters</CardTitle>
                    <CardDescription>
                        Shortlink click analytics · Binding:{' '}
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                            OBCF_ANALYTICS_SHORTLINKS
                        </code>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="min-w-[140px]">
                            <label className="mb-1.5 block text-sm font-medium">Short Code</label>
                            <input
                                type="text"
                                placeholder="All (optional)"
                                value={shortCode}
                                onChange={(e) => setShortCode(e.target.value)}
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>
                        <div className="min-w-[120px]">
                            <label className="mb-1.5 block text-sm font-medium">Period</label>
                            <Select value={days} onValueChange={setDays}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">Last 1 day</SelectItem>
                                    <SelectItem value="7">Last 7 days</SelectItem>
                                    <SelectItem value="14">Last 14 days</SelectItem>
                                    <SelectItem value="30">Last 30 days</SelectItem>
                                    <SelectItem value="90">Last 90 days</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="min-w-[140px]">
                            <label className="mb-1.5 block text-sm font-medium">Group by</label>
                            <Select value={groupBy} onValueChange={setGroupBy}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="country">Country</SelectItem>
                                    <SelectItem value="shortCode">Short Code</SelectItem>
                                    <SelectItem value="day">Day</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button variant="secondary" size="icon" onClick={() => void refetch()} disabled={loading}>
                            {loading ? (
                                <IconLoader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <IconRefresh className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {error?.message && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    {error.message}
                </div>
            )}

            <AnalyticsResultsCard
                loading={loading}
                data={data}
                description={
                    groupBy === 'country'
                        ? 'Clicks by country'
                        : groupBy === 'shortCode'
                          ? 'Clicks by short code'
                          : 'Clicks over time'
                }
                groupBy={groupBy}
                formatDimension={formatDimension}
                linkTo="/shortlinks"
            />
        </div>
    );
}

function ReferralAnalyticsTab() {
    const [referralCode, setReferralCode] = useState<string>('');
    const [days, setDays] = useState<string>('7');
    const [groupBy, setGroupBy] = useState<string>('country');

    const params = new URLSearchParams({ days, groupBy });
    if (referralCode) params.set('referralCode', referralCode);
    const {
        data: response,
        error,
        isFetching: loading,
        refetch,
    } = useApiQuery<AnalyticsResponse>({
        entity: 'analytics',
        queryKey: ['referrals', referralCode, days, groupBy],
        endpoint: `/api/referrals/analytics?${params.toString()}`,
        queryOptions: {
            meta: { errorPresentation: 'local' },
        },
    });
    const data = error ? [] : (response?.data ?? []);

    const formatDimension = (dim: string) => {
        if (groupBy === 'day' && /^\d{4}-\d{2}-\d{2}/.test(dim)) {
            return new Date(dim).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            });
        }
        return dim || '—';
    };

    return (
        <div className="space-y-8">
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className={headingClass}>Filters</CardTitle>
                    <CardDescription>
                        Referral link click analytics · Binding:{' '}
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                            OBCF_ANALYTICS_REFERRALS
                        </code>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="min-w-[140px]">
                            <label className="mb-1.5 block text-sm font-medium">Referral Code</label>
                            <input
                                type="text"
                                placeholder="All (optional)"
                                value={referralCode}
                                onChange={(e) => setReferralCode(e.target.value)}
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>
                        <div className="min-w-[120px]">
                            <label className="mb-1.5 block text-sm font-medium">Period</label>
                            <Select value={days} onValueChange={setDays}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">Last 1 day</SelectItem>
                                    <SelectItem value="7">Last 7 days</SelectItem>
                                    <SelectItem value="14">Last 14 days</SelectItem>
                                    <SelectItem value="30">Last 30 days</SelectItem>
                                    <SelectItem value="90">Last 90 days</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="min-w-[140px]">
                            <label className="mb-1.5 block text-sm font-medium">Group by</label>
                            <Select value={groupBy} onValueChange={setGroupBy}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="country">Country</SelectItem>
                                    <SelectItem value="referralCode">Referral Code</SelectItem>
                                    <SelectItem value="day">Day</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button variant="secondary" size="icon" onClick={() => void refetch()} disabled={loading}>
                            {loading ? (
                                <IconLoader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <IconRefresh className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {error?.message && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    {error.message}
                </div>
            )}

            <AnalyticsResultsCard
                loading={loading}
                data={data}
                description={
                    groupBy === 'country'
                        ? 'Clicks by country'
                        : groupBy === 'referralCode'
                          ? 'Clicks by referral code'
                          : 'Clicks over time'
                }
                groupBy={groupBy}
                formatDimension={formatDimension}
                linkTo="/referrals"
                dimensionLabel={groupBy === 'referralCode' ? 'Referral Code' : undefined}
            />
        </div>
    );
}

function CoreAnalyticsTab() {
    const [eventFilter, setEventFilter] = useState<string>('');
    const [days, setDays] = useState<string>('7');
    const [groupBy, setGroupBy] = useState<string>('event');

    const params = new URLSearchParams({ days, groupBy });
    if (eventFilter) params.set('event', eventFilter);
    const {
        data: response,
        error,
        isFetching: loading,
        refetch,
    } = useApiQuery<AnalyticsResponse>({
        entity: 'analytics',
        queryKey: ['core', eventFilter, days, groupBy],
        endpoint: `/api/analytics/core?${params.toString()}`,
        queryOptions: {
            meta: { errorPresentation: 'local' },
        },
    });
    const data = error ? [] : (response?.data ?? []);

    const formatDimension = (dim: string) => {
        if (groupBy === 'day' && /^\d{4}-\d{2}-\d{2}/.test(dim)) {
            return new Date(dim).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            });
        }
        return dim || '—';
    };

    return (
        <div className="space-y-8">
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className={headingClass}>Filters</CardTitle>
                    <CardDescription>
                        Core event analytics (page_view, button_click, etc.) · Binding:{' '}
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">OBCF_ANALYTICS_CORE</code>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="min-w-[140px]">
                            <label className="mb-1.5 block text-sm font-medium">Event</label>
                            <input
                                type="text"
                                placeholder="All (optional)"
                                value={eventFilter}
                                onChange={(e) => setEventFilter(e.target.value)}
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>
                        <div className="min-w-[120px]">
                            <label className="mb-1.5 block text-sm font-medium">Period</label>
                            <Select value={days} onValueChange={setDays}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">Last 1 day</SelectItem>
                                    <SelectItem value="7">Last 7 days</SelectItem>
                                    <SelectItem value="14">Last 14 days</SelectItem>
                                    <SelectItem value="30">Last 30 days</SelectItem>
                                    <SelectItem value="90">Last 90 days</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="min-w-[140px]">
                            <label className="mb-1.5 block text-sm font-medium">Group by</label>
                            <Select value={groupBy} onValueChange={setGroupBy}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="event">Event</SelectItem>
                                    <SelectItem value="country">Country</SelectItem>
                                    <SelectItem value="day">Day</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button variant="secondary" size="icon" onClick={() => void refetch()} disabled={loading}>
                            {loading ? (
                                <IconLoader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <IconRefresh className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {error?.message && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    {error.message}
                </div>
            )}

            <AnalyticsResultsCard
                loading={loading}
                data={data}
                description={
                    groupBy === 'country'
                        ? 'Events by country'
                        : groupBy === 'event'
                          ? 'Events by type'
                          : 'Events over time'
                }
                groupBy={groupBy}
                formatDimension={formatDimension}
                linkTo="/analytics"
                dimensionLabel={groupBy === 'event' ? 'Event' : undefined}
                valueLabel="Events"
            />
        </div>
    );
}

function AnalyticsTable({
    data,
    groupBy,
    formatDimension,
    linkTo,
    dimensionLabel,
    valueLabel = 'Clicks',
}: {
    data: AnalyticsRow[];
    groupBy: string;
    formatDimension: (dim: string) => string;
    linkTo: string;
    dimensionLabel?: string;
    valueLabel?: string;
}) {
    const colLabel =
        dimensionLabel ??
        (groupBy === 'country'
            ? 'Country'
            : groupBy === 'shortCode'
              ? 'Short Code'
              : groupBy === 'referralCode'
                ? 'Referral Code'
                : groupBy === 'event'
                  ? 'Event'
                  : 'Date');

    const showLink = groupBy === 'shortCode' || groupBy === 'referralCode';

    return (
        <div className="overflow-x-auto rounded-xl bg-background ring-1 ring-border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            {colLabel}
                        </TableHead>
                        <TableHead className="text-right text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            {valueLabel}
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((row, i) => (
                        <TableRow key={i}>
                            <TableCell>
                                {showLink ? (
                                    <Link to={linkTo} className="font-mono text-primary hover:underline">
                                        {row.dimension}
                                    </Link>
                                ) : (
                                    <span className="text-sm">{formatDimension(row.dimension)}</span>
                                )}
                            </TableCell>
                            <TableCell className="text-right">
                                <span className="inline-flex items-center rounded-full bg-background px-2 py-0.5 font-mono text-[0.6875rem] font-medium text-muted-foreground ring-1 ring-border">
                                    {Math.round(row.clicks ?? row.value ?? 0)}
                                </span>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
