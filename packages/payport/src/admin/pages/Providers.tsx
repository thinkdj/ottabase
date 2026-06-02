// ============================================================
// Payport Admin — Providers + Plan Catalog (super-admin)
// ============================================================
//
// Read-only views into runtime state:
//   • Registered providers + their capability matrix
//   • In-memory plan catalog (registerPlans / definePlans output)
//
// Backed by GET /api/payport/admin/providers.
// ============================================================

import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Server } from 'lucide-react';

export interface PayportProvidersInfo {
    active: string;
    providers: Array<{
        name: string;
        capabilities: Record<string, boolean>;
    }>;
    plans: Array<{
        slug: string;
        name: string;
        features?: string[];
        priceLabel?: string | null;
        providerProductIds?: Record<string, string>;
        priceMonthly?: number | null;
        priceYearly?: number | null;
        currency?: string | null;
    }>;
}

const ENDPOINT = '/api/payport/admin/providers';

async function fetchProviders(): Promise<PayportProvidersInfo> {
    const res = await fetch(ENDPOINT, { credentials: 'include' });
    if (!res.ok) throw new Error(`Failed to load providers info (${res.status})`);
    return res.json();
}

export function PayportProvidersPage() {
    const { data, isLoading, error } = useQuery({
        queryKey: ['payport', 'admin', 'providers'],
        queryFn: fetchProviders,
    });

    if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading providers…</div>;
    if (error || !data) {
        return (
            <div className="p-6">
                <Card>
                    <CardContent className="pt-6 flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Failed to load providers info.</span>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <header>
                <h1 className="text-2xl font-semibold tracking-tight">Payment Providers</h1>
                <p className="text-sm text-muted-foreground">
                    Adapters registered at boot. The active provider handles checkout, subscriptions, and webhook
                    ingestion.
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.providers.map((p) => {
                    const isActive = p.name === data.active;
                    return (
                        <Card key={p.name} className={isActive ? 'ring-1 ring-primary/40' : undefined}>
                            <CardHeader className="flex flex-row items-start justify-between space-y-0">
                                <div className="flex items-center gap-2">
                                    <Server className="h-4 w-4 text-muted-foreground" />
                                    <CardTitle className="capitalize text-base">{p.name}</CardTitle>
                                </div>
                                {isActive ? (
                                    <Badge variant="secondary" className="gap-1">
                                        <CheckCircle2 className="h-3 w-3" /> Active
                                    </Badge>
                                ) : (
                                    <Badge variant="outline">Registered</Badge>
                                )}
                            </CardHeader>
                            <CardContent>
                                <CardDescription className="mb-2 uppercase text-xs tracking-wide">
                                    Capabilities
                                </CardDescription>
                                <div className="grid grid-cols-2 gap-1.5 text-xs">
                                    {Object.entries(p.capabilities).map(([k, on]) => (
                                        <div key={k} className="flex items-center justify-between">
                                            <span className="text-muted-foreground capitalize">
                                                {k.replace(/([A-Z])/g, ' $1').toLowerCase()}
                                            </span>
                                            <Badge variant={on ? 'secondary' : 'outline'}>{on ? 'yes' : 'no'}</Badge>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <section>
                <h2 className="text-lg font-semibold tracking-tight mb-3">Plan Catalog</h2>
                <p className="text-sm text-muted-foreground mb-3">
                    Plans registered in-memory via <code>payport.registerPlans()</code>. This is the canonical source
                    that checkout, entitlements and the admin Plans table sync against.
                </p>
                <Card>
                    <CardContent className="p-0">
                        {data.plans.length === 0 ? (
                            <div className="p-6 text-sm text-muted-foreground">No plans registered.</div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                                    <tr>
                                        <th className="text-left px-4 py-2">Slug</th>
                                        <th className="text-left px-4 py-2">Name</th>
                                        <th className="text-left px-4 py-2">Monthly</th>
                                        <th className="text-left px-4 py-2">Yearly</th>
                                        <th className="text-left px-4 py-2">External Product</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.plans.map((plan) => (
                                        <tr key={plan.slug} className="border-t">
                                            <td className="px-4 py-2 font-mono text-xs">{plan.slug}</td>
                                            <td className="px-4 py-2">{plan.name}</td>
                                            <td className="px-4 py-2 tabular-nums">
                                                {plan.priceMonthly != null
                                                    ? `${(plan.priceMonthly / 100).toFixed(2)} ${plan.currency ?? ''}`
                                                    : '—'}
                                            </td>
                                            <td className="px-4 py-2 tabular-nums">
                                                {plan.priceYearly != null
                                                    ? `${(plan.priceYearly / 100).toFixed(2)} ${plan.currency ?? ''}`
                                                    : '—'}
                                            </td>
                                            <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                                                {plan.providerProductIds
                                                    ? Object.entries(plan.providerProductIds)
                                                          .map(([k, v]) => `${k}:${v}`)
                                                          .join(', ') || '—'
                                                    : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </CardContent>
                </Card>
            </section>
        </div>
    );
}
