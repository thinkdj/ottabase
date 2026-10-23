'use client';

// ============================================================
// @ottabase/premium/react — the drop-in admin surface
// ============================================================
// One component gives an app the whole operator story: what is installed, what state
// each package is in, and where to paste a license. Hosts that want their own layout
// can build it from the hooks instead — nothing here is privileged.
// ============================================================

import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    EnvName,
    Input,
    Status,
    Tag,
} from '@ottabase/ui';
import { ExternalLink, KeyRound, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { usePremiumLicense, usePremiumPackages } from './hooks';
import type { PremiumPackageStatus } from '../types';

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
        <Card>
            <CardHeader className="gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2">
                        {status.name}
                        <Tag mono>v{status.version}</Tag>
                    </CardTitle>
                    {/* The one status map: a license state is the same pill on every surface. */}
                    <Status domain="license" value={status.state} withIcon />
                </div>
                {status.description ? <CardDescription>{status.description}</CardDescription> : null}
            </CardHeader>

            <CardContent className="space-y-4">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                    <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                            Plan
                        </dt>
                        <dd className="text-foreground">{status.plan ?? '—'}</dd>
                    </div>
                    <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                            Licensed to
                        </dt>
                        <dd className="truncate text-foreground">{status.licensee ?? '—'}</dd>
                    </div>
                    <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                            Expires
                        </dt>
                        <dd className="text-foreground">
                            {status.requiresLicense
                                ? status.expiresAt
                                    ? formatDate(status.expiresAt)
                                    : 'never'
                                : 'n/a'}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                            Installed
                        </dt>
                        <dd className="text-foreground">{formatDate(status.installedAt)}</dd>
                    </div>
                </dl>

                {(status.features.length > 0 || limitEntries.length > 0) && (
                    <div className="flex flex-wrap gap-1.5">
                        {status.features.map((feature) => (
                            <Tag key={feature} mono>
                                {feature}
                            </Tag>
                        ))}
                        {limitEntries.map(([key, value]) => (
                            <Tag key={key} mono>
                                {key}: {value < 0 ? '∞' : value}
                            </Tag>
                        ))}
                    </div>
                )}

                {status.requiresLicense ? (
                    envManaged ? (
                        <p className="flex flex-wrap items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                            <EnvName>PREMIUM_LICENSE_{status.key.toUpperCase().replace(/-/g, '_')}</EnvName>
                            Licensed from the environment, which outranks a key pasted here. Change it where you
                            configure secrets.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Input
                                    value={licenseInput}
                                    onChange={(event) => setLicenseInput(event.target.value)}
                                    placeholder="Paste license key (otta_premium_v1.…)"
                                    className="font-mono text-sm"
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
                            {error ? <p className="text-xs text-destructive-text">{error}</p> : null}
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
                                className="inline-flex items-center gap-1 font-medium text-accent-foreground hover:underline"
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
                {emptyMessage ?? 'No premium packages are installed. Add one to ottabase/packages.ts to see it here.'}
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
