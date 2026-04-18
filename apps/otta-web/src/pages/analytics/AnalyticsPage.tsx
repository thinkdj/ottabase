import { api, isApiError } from '@/lib/api';
import { PACKAGES_ENABLED } from '@/ottabase/config';
import {
    Badge,
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
import { useCallback, useEffect, useState } from 'react';

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

const headingClass = 'text-xl font-semibold';

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
        <div className="flex h-32 flex-col items-center justify-center gap-2">
            <IconChartBar className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">No data yet. Data will appear once tracking is active.</p>
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
        <Card>
            <CardHeader>
                <CardTitle>Results</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex h-32 items-center justify-center">
                        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
        <div className="mx-auto max-w-7xl space-y-8 px-4 py-12">
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <IconChartBar className="h-8 w-8 text-primary" />
                        <h1 className={headingClass}>Analytics</h1>
                    </div>
                    <p className="text-muted-foreground">
                        Click data from Cloudflare Analytics Engine (WAE). Data retention: 3 months.
                    </p>
                </div>
                <div className="flex gap-2">
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
    const [data, setData] = useState<AnalyticsRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [shortCode, setShortCode] = useState<string>('');
    const [days, setDays] = useState<string>('7');
    const [groupBy, setGroupBy] = useState<string>('country');

    const fetchAnalytics = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const params = new URLSearchParams();
            if (shortCode) params.set('shortCode', shortCode);
            params.set('days', days);
            params.set('groupBy', groupBy);
            const response = await api<AnalyticsResponse>(`/api/shortlinks/analytics?${params.toString()}`, {
                method: 'GET',
                callerId: 'ShortlinkAnalyticsTab:fetchAnalytics',
            });
            if (response?.data) {
                setData(response.data);
            } else {
                setData([]);
            }
        } catch (err) {
            setError(isApiError(err) ? err.message : 'Failed to load analytics');
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [shortCode, days, groupBy]);

    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);

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
        <>
            <Card>
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
                        <Button variant="secondary" size="icon" onClick={fetchAnalytics} disabled={loading}>
                            {loading ? (
                                <IconLoader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <IconRefresh className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                    <p className="text-sm text-destructive">{error}</p>
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
        </>
    );
}

function ReferralAnalyticsTab() {
    const [data, setData] = useState<AnalyticsRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [referralCode, setReferralCode] = useState<string>('');
    const [days, setDays] = useState<string>('7');
    const [groupBy, setGroupBy] = useState<string>('country');

    const fetchAnalytics = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const params = new URLSearchParams();
            if (referralCode) params.set('referralCode', referralCode);
            params.set('days', days);
            params.set('groupBy', groupBy);
            const response = await api<AnalyticsResponse>(`/api/referrals/analytics?${params.toString()}`, {
                method: 'GET',
                callerId: 'ReferralAnalyticsTab:fetchAnalytics',
            });
            if (response?.data) {
                setData(response.data);
            } else {
                setData([]);
            }
        } catch (err) {
            setError(isApiError(err) ? err.message : 'Failed to load analytics');
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [referralCode, days, groupBy]);

    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);

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
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl font-semibold">Filters</CardTitle>
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
                        <Button variant="secondary" size="icon" onClick={fetchAnalytics} disabled={loading}>
                            {loading ? (
                                <IconLoader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <IconRefresh className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                    <p className="text-sm text-destructive">{error}</p>
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
        </>
    );
}

function CoreAnalyticsTab() {
    const [data, setData] = useState<AnalyticsRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [eventFilter, setEventFilter] = useState<string>('');
    const [days, setDays] = useState<string>('7');
    const [groupBy, setGroupBy] = useState<string>('event');

    const fetchAnalytics = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const params = new URLSearchParams();
            if (eventFilter) params.set('event', eventFilter);
            params.set('days', days);
            params.set('groupBy', groupBy);
            const response = await api<AnalyticsResponse>(`/api/analytics/core?${params.toString()}`, {
                method: 'GET',
                callerId: 'CoreAnalyticsTab:fetchAnalytics',
            });
            if (response?.data) {
                setData(response.data);
            } else {
                setData([]);
            }
        } catch (err) {
            setError(isApiError(err) ? err.message : 'Failed to load analytics');
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [eventFilter, days, groupBy]);

    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);

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
        <>
            <Card>
                <CardHeader>
                    <CardTitle className={headingClass}>Filters</CardTitle>
                    <CardDescription>
                        Core event analytics (page_view, button_click, etc.) · Binding:{' '}
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono dark:bg-muted/50">
                            OBCF_ANALYTICS_CORE
                        </code>
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
                        <Button variant="secondary" size="icon" onClick={fetchAnalytics} disabled={loading}>
                            {loading ? (
                                <IconLoader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <IconRefresh className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                    <p className="text-sm text-destructive">{error}</p>
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
        </>
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
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{colLabel}</TableHead>
                        <TableHead className="text-right">{valueLabel}</TableHead>
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
                                    <span>{formatDimension(row.dimension)}</span>
                                )}
                            </TableCell>
                            <TableCell className="text-right">
                                <Badge variant="secondary" className="font-mono">
                                    {Math.round(row.clicks ?? row.value ?? 0)}
                                </Badge>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
