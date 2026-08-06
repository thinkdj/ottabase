'use client';

// ============================================================
// @ottabase/premium/react — the drop-in admin surface
// ============================================================
// One component gives an app the whole operator story: what is installed, what state
// each package is in, and where to paste a license. Hosts that want their own layout
// can build it from the hooks instead — nothing here is privileged.
// ============================================================

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@ottabase/ui-shadcn';
import { CheckCircle2, ExternalLink, KeyRound, Lock, RefreshCw, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { usePremiumLicense, usePremiumPackages } from './hooks';
import type { PremiumPackageStatus, PremiumState } from '../types';

const STATE_LABEL: Record<PremiumState, string> = {
    active: 'Active',
    grace: 'Grace period',
    expired: 'Expired',
    invalid: 'Invalid key',
    unlicensed: 'Not licensed',
    disabled: 'Disabled',
};

/** Badge variant per state. `grace` reads as a warning on purpose — it is a deadline. */
const STATE_VARIANT: Record<PremiumState, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    active: 'default',
    grace: 'secondary',
    expired: 'destructive',
    invalid: 'destructive',
    unlicensed: 'outline',
    disabled: 'outline',
};

function StateIcon({ state }: { state: PremiumState }) {
    if (state === 'active') return <CheckCircle2 className="h-4 w-4 text-success" />;
    if (state === 'grace' || state === 'expired' || state === 'invalid') {
        return <TriangleAlert className="h-4 w-4 text-warning" />;
    }
    return <Lock className="h-4 w-4 text-muted-foreground" />;
}

function formatDate(timestamp: number | null): string {
    if (!timestamp) return 'never';
    return new Date(timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function PackageCard({ status }: { status: PremiumPackageStatus }) {
    const { activate, remove } = usePremiumLicense();
    const [licenseInput, setLicenseInput] = useState('');
    const [error, setError] = useState<string | null>(null);

    // An env-supplied license is deploy-pinned: showing an editable field for it would
    // promise a change the server deliberately ignores.
    const envManaged = status.licenseSource === 'env';
    const limitEntries = Object.entries(status.limits);

    const onActivate = async () => {
        setError(null);
        try {
            const next = await activate.mutateAsync({ key: status.key, license: licenseInput.trim() });
            if (!next?.enabled) setError('That key did not unlock the package. Check it is for this package and app.');
            else setLicenseInput('');
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not save the license key');
        }
    };

    return (
        <Card className="rounded-xl border-transparent bg-muted/40 shadow-none dark:bg-muted/20">
            <CardHeader className="gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                        <StateIcon state={status.state} />
                        {status.name}
                        <span className="font-mono text-xs font-normal text-muted-foreground">v{status.version}</span>
                    </CardTitle>
                    <Badge variant={STATE_VARIANT[status.state]} className="rounded-full text-[0.6875rem]">
                        {STATE_LABEL[status.state]}
                    </Badge>
                </div>
                {status.description ? <CardDescription>{status.description}</CardDescription> : null}
            </CardHeader>

            <CardContent className="space-y-4">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                    <div>
                        <dt className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">Plan</dt>
                        <dd className="text-foreground">{status.plan ?? '—'}</dd>
                    </div>
                    <div>
                        <dt className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">Licensed to</dt>
                        <dd className="truncate text-foreground">{status.licensee ?? '—'}</dd>
                    </div>
                    <div>
                        <dt className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">Expires</dt>
                        <dd className="text-foreground">
                            {status.requiresLicense
                                ? status.expiresAt
                                    ? formatDate(status.expiresAt)
                                    : 'never'
                                : 'n/a'}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">Installed</dt>
                        <dd className="text-foreground">{formatDate(status.installedAt)}</dd>
                    </div>
                </dl>

                {(status.features.length > 0 || limitEntries.length > 0) && (
                    <div className="flex flex-wrap gap-1.5">
                        {status.features.map((feature) => (
                            <Badge key={feature} variant="outline" className="rounded-full font-mono text-[0.6875rem]">
                                {feature}
                            </Badge>
                        ))}
                        {limitEntries.map(([key, value]) => (
                            <Badge key={key} variant="outline" className="rounded-full font-mono text-[0.6875rem]">
                                {key}: {value < 0 ? '∞' : value}
                            </Badge>
                        ))}
                    </div>
                )}

                {status.requiresLicense ? (
                    envManaged ? (
                        <p className="rounded-lg bg-background p-3 text-xs text-muted-foreground ring-1 ring-border">
                            Licensed from an environment variable. Change it where you configure secrets — a key pasted
                            here would be ignored.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Input
                                    value={licenseInput}
                                    onChange={(event) => setLicenseInput(event.target.value)}
                                    placeholder="Paste license key (obp1.…)"
                                    className="font-mono text-xs"
                                    aria-label={`License key for ${status.name}`}
                                    spellCheck={false}
                                />
                                <Button
                                    size="sm"
                                    onClick={onActivate}
                                    disabled={!licenseInput.trim() || activate.isPending}
                                    className="shrink-0"
                                >
                                    <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                                    {activate.isPending ? 'Saving…' : 'Activate'}
                                </Button>
                                {status.licenseSource === 'store' ? (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="shrink-0"
                                        onClick={() => void remove.mutateAsync(status.key)}
                                        disabled={remove.isPending}
                                    >
                                        Remove
                                    </Button>
                                ) : null}
                            </div>
                            {error ? <p className="text-xs text-destructive">{error}</p> : null}
                        </div>
                    )
                ) : (
                    <p className="text-xs text-muted-foreground">
                        This package ships without a license key requirement.
                    </p>
                )}

                {status.purchaseUrl || status.docsUrl ? (
                    <div className="flex flex-wrap gap-3 text-xs">
                        {status.purchaseUrl ? (
                            <a
                                className="inline-flex items-center gap-1 text-primary hover:underline"
                                href={status.purchaseUrl}
                                target="_blank"
                                rel="noreferrer noopener"
                            >
                                Plans <ExternalLink className="h-3 w-3" />
                            </a>
                        ) : null}
                        {status.docsUrl ? (
                            <a
                                className="inline-flex items-center gap-1 text-muted-foreground hover:underline"
                                href={status.docsUrl}
                                target="_blank"
                                rel="noreferrer noopener"
                            >
                                Docs <ExternalLink className="h-3 w-3" />
                            </a>
                        ) : null}
                    </div>
                ) : null}
            </CardContent>
        </Card>
    );
}

export interface PremiumPackagesManagerProps {
    /** Copy shown when no Premium Packages are registered. */
    emptyMessage?: string;
}

/**
 * The operator's view of every registered Premium Package.
 *
 * Renders an explicit empty state rather than nothing: "no premium packages installed"
 * is the correct and common answer for a stock Ottabase app, and a blank panel reads as
 * a bug.
 */
export function PremiumPackagesManager({ emptyMessage }: PremiumPackagesManagerProps) {
    const { data, isLoading, error } = usePremiumPackages();
    const { refresh } = usePremiumLicense();

    if (isLoading) {
        return <div className="h-32 animate-pulse rounded-xl bg-muted/60" aria-busy="true" />;
    }

    if (error) {
        return <p className="text-sm text-destructive">{error.message}</p>;
    }

    if (!data || data.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                {emptyMessage ??
                    'No premium packages are installed. Register one in ottabase/config.premium.ts to see it here.'}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {data.map((status) => (
                <PackageCard key={status.key} status={status} />
            ))}
            <Button variant="ghost" size="sm" onClick={() => void refresh.mutateAsync()} disabled={refresh.isPending}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refresh.isPending ? 'animate-spin' : ''}`} />
                Re-check licenses
            </Button>
        </div>
    );
}
