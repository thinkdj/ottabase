'use client';

// ============================================================
// @ottabase/vault/react — the drop-in admin surface
// ============================================================
// TAILWIND SETUP CHECKLIST (this fails with NO ERROR): a consuming app must add
//     '../../packages/vault/src/**/*.{js,ts,jsx,tsx}'
// to its Tailwind `content` array, or these components render structurally correct and
// completely unstyled.
//
// No license check is written here. The "Run backup" button is disabled by the SAME limit
// the server enforces, read from the server-resolved status, and the paid cards sit behind
// `PremiumGate`, so the UI and the 402 can never disagree.
// ============================================================

import { PremiumGate, PremiumUpsell, usePremiumLimit } from '@ottabase/premium/react';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@ottabase/ui';
import { Archive, Download, Play, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
    DEFAULT_RETENTION_DAYS,
    DEFAULT_SCHEDULE,
    VAULT_BASE_PATH,
    VAULT_FEATURE_EXPORT,
    VAULT_FEATURE_SCHEDULE,
    VAULT_LIMIT_BACKUPS,
    VAULT_PACKAGE_KEY,
} from '../constants';
import type { BackupManifest } from '../types';
import { useVaultBackups } from './hooks';

const QUIET_CARD = '';

export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function totals(manifest: BackupManifest): { rows: number; bytes: number } {
    return manifest.tables.reduce((sum, table) => ({ rows: sum.rows + table.rows, bytes: sum.bytes + table.bytes }), {
        rows: 0,
        bytes: 0,
    });
}

function BackupRow({
    manifest,
    busy,
    onRestore,
    onDelete,
}: {
    manifest: BackupManifest;
    busy: boolean;
    onRestore: () => Promise<unknown>;
    onDelete: () => void;
}) {
    const [confirm, setConfirm] = useState<string | null>(null);
    const [result, setResult] = useState<string | null>(null);
    const { rows, bytes } = totals(manifest);
    const confirming = confirm !== null;

    return (
        <div className="space-y-2 rounded-lg bg-background p-3 text-sm ring-1 ring-border">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="truncate font-mono text-xs">{manifest.id}</span>
                        {manifest.label ? (
                            <Badge variant="outline" className="rounded-full text-[0.6875rem]">
                                {manifest.label}
                            </Badge>
                        ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {new Date(manifest.createdAt).toLocaleString()} · {manifest.tables.length} tables · {rows} rows
                        · {formatBytes(bytes)}
                        {manifest.objects
                            ? ` · ${manifest.objects.count} files · ${formatBytes(manifest.objects.bytes)}`
                            : ''}{' '}
                        · {manifest.durationMs} ms
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirm(confirming ? null : '')}
                        disabled={busy}
                    >
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                        Restore
                    </Button>
                    <Button size="sm" variant="ghost" onClick={onDelete} disabled={busy} aria-label="Delete backup">
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>
            {confirming ? (
                <div className="flex flex-wrap items-center gap-2 rounded-md bg-destructive/5 p-2">
                    <span className="text-xs text-muted-foreground">
                        Restoring replaces every live row in {manifest.tables.length} tables. Type the backup id to
                        confirm.
                    </span>
                    <Input
                        value={confirm}
                        onChange={(event) => setConfirm(event.target.value)}
                        placeholder={manifest.id}
                        className="h-8 max-w-xs font-mono text-xs"
                        aria-label="Backup id to confirm"
                    />
                    <Button
                        size="sm"
                        variant="destructive"
                        disabled={busy || confirm !== manifest.id}
                        onClick={async () => {
                            const outcome = (await onRestore()) as
                                | { tables?: Array<{ name: string; rows: number }> }
                                | undefined;
                            setConfirm(null);
                            setResult(
                                outcome?.tables
                                    ? `Restored ${outcome.tables.reduce((n, table) => n + table.rows, 0)} rows into ${outcome.tables.length} tables.`
                                    : 'Restored.',
                            );
                        }}
                    >
                        Restore now
                    </Button>
                </div>
            ) : null}
            {result ? <p className="text-xs text-success">{result}</p> : null}
        </div>
    );
}

export interface VaultSettingsProps {
    /** Cron expression shown for the schedule. Match what the composition passes to `createVaultPackage`. */
    schedule?: string;
    /** Retention days shown for the schedule. Match the composition. */
    retentionDays?: number;
    /** URL of the operator export for one organization. Default `/api/vault/export?organizationId=…`. */
    exportHref?: (organizationId: string) => string;
}

/**
 * Backups, restore and delete (free), and the licensed schedule and tenant export behind
 * their gates.
 */
export function VaultSettings({
    schedule = DEFAULT_SCHEDULE,
    retentionDays = DEFAULT_RETENTION_DAYS,
    exportHref = (organizationId) => `${VAULT_BASE_PATH}/export?organizationId=${encodeURIComponent(organizationId)}`,
}: VaultSettingsProps) {
    const { backups, isLoading, error, create, restore, remove } = useVaultBackups();
    const [organizationId, setOrganizationId] = useState('');
    const limitGate = usePremiumLimit(VAULT_PACKAGE_KEY, VAULT_LIMIT_BACKUPS, backups.length);
    const busy = create.isPending || restore.isPending || remove.isPending;
    const failure = error ?? create.error ?? restore.error ?? remove.error;

    return (
        <div className="space-y-6">
            <Card className={QUIET_CARD}>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Archive className="h-4 w-4 text-muted-foreground" />
                            Backups
                        </CardTitle>
                        <CardDescription>
                            Every table as NDJSON in your bucket. Restore puts the rows back in one transaction.
                            {limitGate.limit !== undefined ? ` ${backups.length} of ${limitGate.limit} kept.` : ''}
                        </CardDescription>
                    </div>
                    <Button
                        size="sm"
                        onClick={() => create.mutate({ label: 'manual' })}
                        disabled={busy || limitGate.isLoading || !limitGate.allowed}
                    >
                        <Play className="mr-1.5 h-3.5 w-3.5" />
                        {create.isPending ? 'Backing up…' : 'Run backup now'}
                    </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                    {!limitGate.isLoading && !limitGate.allowed && limitGate.upsell ? (
                        <PremiumUpsell
                            answer={limitGate}
                            title="Backup limit reached"
                            description={`The free tier keeps ${limitGate.limit ?? 5} backups. Delete one, or license Vault for a nightly schedule with retention.`}
                        />
                    ) : null}
                    {failure ? <p className="text-sm text-destructive">{failure.message}</p> : null}
                    {isLoading ? (
                        <div className="h-20 animate-pulse rounded-lg bg-background/60" aria-busy="true" />
                    ) : backups.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No backups yet. Run one before your next migration.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {backups.map((manifest) => (
                                <BackupRow
                                    key={manifest.id}
                                    manifest={manifest}
                                    busy={busy}
                                    onRestore={() => restore.mutateAsync({ id: manifest.id })}
                                    onDelete={() => remove.mutate(manifest.id)}
                                />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <PremiumGate
                packageKey={VAULT_PACKAGE_KEY}
                feature={VAULT_FEATURE_SCHEDULE}
                title="Nightly schedule and retention"
                description="A license runs vault:backup every night, prunes backups past the retention window (never the newest), and reports a stale backup in the health check."
            >
                <Card className={QUIET_CARD}>
                    <CardHeader>
                        <CardTitle className="text-base">Nightly schedule</CardTitle>
                        <CardDescription>
                            Runs at <code className="font-mono text-xs">{schedule}</code> (UTC). Backups older than{' '}
                            {retentionDays} days are pruned after each run; the newest is always kept. A backup older
                            than two days shows up in <code className="font-mono text-xs">/api/admin/health</code>.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </PremiumGate>

            <PremiumGate
                packageKey={VAULT_PACKAGE_KEY}
                feature={VAULT_FEATURE_EXPORT}
                title="Tenant export"
                description="Stream one organization's rows from every table as NDJSON, for a customer's data request or a migration. Users can always export their own data from /api/vault/export/me."
            >
                <Card className={QUIET_CARD}>
                    <CardHeader>
                        <CardTitle className="text-base">Tenant export</CardTitle>
                        <CardDescription>
                            One organization, every table that carries it, as NDJSON lines of{' '}
                            <code className="font-mono text-xs">{'{ table, row }'}</code>.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap items-center gap-2">
                        <Input
                            value={organizationId}
                            onChange={(event) => setOrganizationId(event.target.value)}
                            placeholder="organization id"
                            className="h-9 max-w-xs font-mono text-xs"
                            aria-label="Organization id"
                        />
                        <Button asChild size="sm" variant="outline" disabled={!organizationId.trim()}>
                            <a href={organizationId.trim() ? exportHref(organizationId.trim()) : '#'} download>
                                <Download className="mr-1.5 h-3.5 w-3.5" />
                                Download export
                            </a>
                        </Button>
                    </CardContent>
                </Card>
            </PremiumGate>
        </div>
    );
}
