// ============================================================
// Payport Admin — Super-Admin Dashboard
// ============================================================
//
// KPIs: customer count, active subs, MRR estimate, refunds total,
// outstanding meter usage. Plus a recent webhook events feed and
// active-provider health card.
//
// Data source: GET /api/payport/admin/stats (see server/admin-routes.ts).
// Wire the route in your app's router and ProtectedRoute with the
// `*:*` permission for super-admin only access.
// ============================================================

import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { useQuery } from '@tanstack/react-query';
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    CreditCard,
    DollarSign,
    Gauge,
    Receipt,
    TrendingUp,
    Users,
} from 'lucide-react';
import React from 'react';

export interface PayportDashboardStats {
    counts: {
        customers: number;
        subscriptions: { active: number; trialing: number; cancelled: number; pastDue: number };
        plans: number;
        products: number;
        discounts: number;
        meters: number;
        refunds: number;
        licenseKeys: number;
        eventsLast24h: number;
    };
    /** Estimated MRR (sum of active subscription plan.priceMonthly). */
    mrrCents: number;
    /** Estimated 12 × MRR. */
    arrCents: number;
    currency: string;
    provider: { name: string; healthy: boolean; capabilities: Record<string, boolean> };
    recentEvents: Array<{
        id: string;
        type: string;
        provider: string;
        receivedAt: number;
        processed: boolean;
    }>;
}

const STATS_ENDPOINT = '/api/payport/admin/stats';

async function fetchStats(): Promise<PayportDashboardStats> {
    const res = await fetch(STATS_ENDPOINT, { credentials: 'include' });
    if (!res.ok) throw new Error(`Failed to load payport dashboard stats (${res.status})`);
    return res.json();
}

function formatMoney(cents: number, currency: string): string {
    try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
    } catch {
        return `${(cents / 100).toFixed(2)} ${currency}`;
    }
}

function Kpi({
    icon: Icon,
    label,
    value,
    sub,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
    sub?: string;
}) {
    return (
        <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardDescription className="text-xs uppercase tracking-wide">{label}</CardDescription>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-semibold tabular-nums">{value}</div>
                {sub ? <p className="text-xs text-muted-foreground mt-1">{sub}</p> : null}
            </CardContent>
        </Card>
    );
}

/** Super-admin Payport dashboard. Drop into `/admin/billing`. */
export function PayportDashboardPage() {
    const { data, isLoading, error } = useQuery({
        queryKey: ['payport', 'admin', 'stats'],
        queryFn: fetchStats,
        refetchInterval: 30_000,
    });

    if (isLoading) {
        return <div className="text-sm text-muted-foreground p-6">Loading billing dashboard…</div>;
    }
    if (error || !data) {
        return (
            <div className="p-6">
                <Card>
                    <CardContent className="pt-6 flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Failed to load dashboard. Ensure /api/payport/admin/stats is wired.</span>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const subs = data.counts.subscriptions;
    return (
        <div className="p-6 space-y-6">
            <header className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold tracking-tight">Billing Overview</h1>
                <p className="text-sm text-muted-foreground">
                    Real-time KPIs and recent payment activity. Refreshes every 30 seconds.
                </p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Kpi
                    icon={DollarSign}
                    label="MRR"
                    value={formatMoney(data.mrrCents, data.currency)}
                    sub={`ARR ≈ ${formatMoney(data.arrCents, data.currency)}`}
                />
                <Kpi
                    icon={CreditCard}
                    label="Active Subs"
                    value={subs.active.toLocaleString()}
                    sub={`${subs.trialing} trialing · ${subs.pastDue} past-due`}
                />
                <Kpi icon={Users} label="Customers" value={data.counts.customers.toLocaleString()} />
                <Kpi
                    icon={Receipt}
                    label="Refunds"
                    value={data.counts.refunds.toLocaleString()}
                    sub="All-time issued"
                />
                <Kpi icon={TrendingUp} label="Plans" value={data.counts.plans.toLocaleString()} />
                <Kpi icon={Gauge} label="Meters" value={data.counts.meters.toLocaleString()} />
                <Kpi
                    icon={Activity}
                    label="Webhooks (24h)"
                    value={data.counts.eventsLast24h.toLocaleString()}
                    sub="processed events"
                />
                <Kpi icon={CreditCard} label="Discounts" value={data.counts.discounts.toLocaleString()} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="text-base">Active Provider</CardTitle>
                        <CardDescription>Adapter currently handling checkout + webhooks.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="text-lg font-semibold capitalize">{data.provider.name}</span>
                            {data.provider.healthy ? (
                                <Badge variant="secondary" className="gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> Healthy
                                </Badge>
                            ) : (
                                <Badge variant="destructive" className="gap-1">
                                    <AlertTriangle className="h-3 w-3" /> Degraded
                                </Badge>
                            )}
                        </div>
                        <div className="space-y-1 text-xs">
                            {Object.entries(data.provider.capabilities).map(([cap, on]) => (
                                <div key={cap} className="flex items-center justify-between">
                                    <span className="text-muted-foreground capitalize">
                                        {cap.replace(/([A-Z])/g, ' $1').toLowerCase()}
                                    </span>
                                    <Badge variant={on ? 'secondary' : 'outline'}>{on ? 'yes' : 'no'}</Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-base">Recent Webhook Events</CardTitle>
                        <CardDescription>Last 20 inbound events from the provider.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {data.recentEvents.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No events yet.</p>
                        ) : (
                            <ul className="divide-y text-sm">
                                {data.recentEvents.map((evt) => (
                                    <li key={evt.id} className="py-2 flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="font-mono text-xs truncate">{evt.type}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {new Date(evt.receivedAt).toLocaleString()} · {evt.provider}
                                            </div>
                                        </div>
                                        <Badge variant={evt.processed ? 'secondary' : 'outline'}>
                                            {evt.processed ? 'processed' : 'pending'}
                                        </Badge>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
