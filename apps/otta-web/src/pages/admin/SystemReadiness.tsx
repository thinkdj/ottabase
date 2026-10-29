/**
 * "System readiness" at the top of /admin, platform admins only.
 *
 * One collapsed line when everything is fine; expanded with a red banner when a required setting
 * is missing or a probe fails. Details: counts, search, "Missing only" / "Required only" filters,
 * a table grouped by package (key, kind chip, optional pill, description, value or Set / Not set)
 * and the health checks under their package. A missing secret offers its wrangler command.
 */
import type { DeploymentVersion, ReadinessReport } from '@ottabase/kernel';
import { useApiQuery } from '@ottabase/ottaorm/client';
import { Button, EnvName, Input, StatusChip, toast } from '@ottabase/ui';
import { AlertTriangle, Check, ChevronDown, ChevronRight, Copy, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';

interface ReadinessResponse extends ReadinessReport {
    app: {
        appId: string;
        environment: string;
        version: DeploymentVersion | null;
        packages: Array<{ key: string; name: string; version: string; premium: boolean }>;
        premiumInstalled: boolean;
    };
    timestamp: number;
}

const CHIP =
    'inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide ring-1 ring-border';

/** "abc1234 · 2 h ago": the deploy tag (the commit in CI) or a short version id, and its age. */
export function versionLabel(version: DeploymentVersion, now = Date.now()): string {
    const name = version.tag ?? version.id.slice(0, 8);
    if (!version.createdAt) return name;
    const minutes = Math.max(0, Math.round((now - Date.parse(version.createdAt)) / 60_000));
    if (!Number.isFinite(minutes)) return name;
    const age =
        minutes < 60
            ? `${minutes} min ago`
            : minutes < 2880
              ? `${Math.round(minutes / 60)} h ago`
              : `${Math.round(minutes / 1440)} d ago`;
    return `${name} · deployed ${age}`;
}

/**
 * `wrangler secret put KEY` for a missing secret: the command only, never a value. A plain var
 * (`secret: false`) belongs in `wrangler.jsonc` vars and a binding in the bindings, so neither
 * gets a command.
 */
export function wranglerCommand(setting: {
    key: string;
    kind: 'var' | 'secret' | 'binding';
    secret: boolean;
}): string | null {
    if (setting.kind === 'binding' || !setting.secret) return null;
    return `wrangler secret put ${setting.key}`;
}

export function SystemReadiness() {
    const [open, setOpen] = useState<boolean | null>(null);
    const [query, setQuery] = useState('');
    const [missingOnly, setMissingOnly] = useState(false);
    const [requiredOnly, setRequiredOnly] = useState(false);

    const readiness = useApiQuery<ReadinessResponse>({
        queryKey: ['admin', 'system', 'readiness'],
        endpoint: '/api/admin/system/readiness',
        queryOptions: { staleTime: 30_000, meta: { errorPresentation: 'local' } },
    });
    const data = readiness.data;
    const problems = data ? data.summary.missingRequired + data.summary.failedChecks : 0;
    // Collapsed by default when fine, expanded automatically when something is wrong.
    const expanded = open ?? problems > 0;

    const groups = useMemo(() => {
        if (!data) return [];
        const q = query.trim().toLowerCase();
        const settings = data.settings.filter(
            (s) =>
                (!q || s.key.toLowerCase().includes(q) || s.package.toLowerCase().includes(q)) &&
                (!missingOnly || !s.set) &&
                (!requiredOnly || s.required),
        );
        const checks = data.checks.filter(
            (c) => !q || c.name.toLowerCase().includes(q) || c.package.toLowerCase().includes(q),
        );
        const keys = [...new Set([...settings.map((s) => s.package), ...checks.map((c) => c.package)])].sort();
        return keys.map((pkg) => ({
            pkg,
            name: data.app.packages.find((p) => p.key === pkg)?.name ?? pkg,
            settings: settings
                .filter((s) => s.package === pkg)
                .sort((a, b) => Number(b.required) - Number(a.required) || a.key.localeCompare(b.key)),
            checks: missingOnly
                ? checks.filter((c) => c.package === pkg && !c.ok)
                : checks.filter((c) => c.package === pkg),
        }));
    }, [data, query, missingOnly, requiredOnly]);

    if (readiness.isPending) {
        return <div className="h-11 animate-pulse rounded-lg bg-muted/40" aria-busy="true" />;
    }
    if (readiness.isError || !data) {
        return (
            <div
                role="alert"
                className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
                Could not load system readiness.
            </div>
        );
    }

    const missing = data.settings.filter((s) => s.required && !s.set);
    const failed = data.checks.filter((c) => !c.ok);
    const copy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            toast.success('Command copied');
        } catch {
            toast.error('Clipboard is not available');
        }
    };

    return (
        <section className="rounded-xl border border-border/60 bg-card">
            {/* Summary line */}
            <button
                type="button"
                onClick={() => setOpen(!expanded)}
                aria-expanded={expanded}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm"
            >
                <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${problems > 0 ? 'bg-destructive' : 'bg-success'}`}
                />
                <span className="font-medium text-foreground">
                    {problems > 0
                        ? `${missing.length} required setting${missing.length === 1 ? '' : 's'} missing${failed.length ? `, ${failed.length} check${failed.length === 1 ? '' : 's'} failing` : ''}`
                        : 'All systems ready'}
                </span>
                <span className="text-muted-foreground">
                    · {data.summary.total} settings · {data.checks.length} health checks · {data.app.environment}
                    {data.app.version && ` · ${versionLabel(data.app.version)}`}
                </span>
                <span className="ml-auto inline-flex items-center gap-1 text-muted-foreground">
                    Details {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </span>
            </button>

            {expanded && (
                <div className="space-y-4 border-t border-border/60 p-4">
                    {missing.length > 0 && (
                        <div
                            role="alert"
                            className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm"
                        >
                            <p className="flex items-center gap-2 font-medium text-destructive">
                                <AlertTriangle className="h-4 w-4" /> {missing.length} required setting
                                {missing.length === 1 ? '' : 's'} missing
                            </p>
                            <ul className="mt-2 space-y-1">
                                {missing.map((s) => (
                                    <li key={`${s.package}:${s.key}`} className="flex flex-wrap items-center gap-2">
                                        <EnvName>{s.key}</EnvName>
                                        <span className="text-muted-foreground">{s.package}</span>
                                        {s.description && (
                                            <span className="text-muted-foreground">{s.description}</span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Counts */}
                    <div className="grid gap-3 sm:grid-cols-4">
                        {[
                            ['Total', data.summary.total],
                            ['Set', data.summary.set],
                            ['Missing (required)', data.summary.missingRequired],
                            ['Optional unset', data.summary.optionalUnset],
                        ].map(([label, value]) => (
                            <div key={String(label)} className="rounded-lg bg-muted/40 px-3 py-2">
                                <div className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                    {label}
                                </div>
                                <div className="text-lg font-semibold tabular-nums">{value}</div>
                            </div>
                        ))}
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative w-64">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Filter by key name..."
                                className="pl-9"
                            />
                            {query && (
                                <button
                                    type="button"
                                    aria-label="Clear"
                                    onClick={() => setQuery('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={missingOnly}
                                onChange={(e) => setMissingOnly(e.target.checked)}
                                className="h-4 w-4 rounded border-input"
                            />
                            Missing only
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={requiredOnly}
                                onChange={(e) => setRequiredOnly(e.target.checked)}
                                className="h-4 w-4 rounded border-input"
                            />
                            Required only
                        </label>
                        <span className="ml-auto text-xs text-muted-foreground">
                            {data.app.appId} · {data.app.packages.length} packages
                            {data.app.premiumInstalled ? ' · premium installed' : ''}
                        </span>
                    </div>

                    {/* Table grouped by package */}
                    <div className="overflow-x-auto rounded-lg border border-border/60">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/40 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                <tr>
                                    <th className="w-10 px-3 py-2 text-left">Status</th>
                                    <th className="px-3 py-2 text-left">Key</th>
                                    <th className="px-3 py-2 text-left">Value</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                                {groups.map((group) => (
                                    <GroupRows key={group.pkg} group={group} onCopy={copy} />
                                ))}
                                {groups.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                                            Nothing matches.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </section>
    );
}

function GroupRows({
    group,
    onCopy,
}: {
    group: {
        pkg: string;
        name: string;
        settings: ReadinessReport['settings'];
        checks: ReadinessReport['checks'];
    };
    onCopy: (text: string) => void;
}) {
    return (
        <>
            <tr className="bg-muted/20">
                <td
                    colSpan={3}
                    className="px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                    {group.name} <span className="font-normal normal-case tracking-normal">({group.pkg})</span>
                </td>
            </tr>
            {group.settings.map((s) => {
                const command = s.set ? null : wranglerCommand(s);
                return (
                    <tr key={`${s.package}:${s.key}`}>
                        <td className="px-3 py-2 align-top">
                            {s.set ? (
                                <Check className="h-4 w-4 text-success" aria-label="Set" />
                            ) : (
                                <X className="h-4 w-4 text-destructive" aria-label="Not set" />
                            )}
                        </td>
                        <td className="px-3 py-2 align-top">
                            <div className="flex flex-wrap items-center gap-1.5">
                                <EnvName>{s.key}</EnvName>
                                <span className={`${CHIP} text-muted-foreground`}>{s.kind}</span>
                                {!s.required && <span className={`${CHIP} text-muted-foreground`}>optional</span>}
                            </div>
                            {s.description && <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>}
                        </td>
                        <td className="px-3 py-2 align-top">
                            {!s.set ? (
                                <span className="inline-flex items-center gap-2">
                                    <span className="italic text-muted-foreground">Not set</span>
                                    {command && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onCopy(command)}
                                            title={command}
                                        >
                                            <Copy className="mr-1 h-3.5 w-3.5" /> wrangler
                                        </Button>
                                    )}
                                </span>
                            ) : s.preview !== undefined ? (
                                <code
                                    className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-xs"
                                    title={`${s.preview.length} characters shown masked`}
                                >
                                    {s.preview}
                                </code>
                            ) : (
                                <StatusChip tone="green">Set</StatusChip>
                            )}
                        </td>
                    </tr>
                );
            })}
            {group.checks.map((c) => (
                <tr key={`${c.package}:${c.name}`}>
                    <td className="px-3 py-2 align-top">
                        {c.ok ? (
                            <Check className="h-4 w-4 text-success" aria-label="OK" />
                        ) : (
                            <X className="h-4 w-4 text-destructive" aria-label="Failing" />
                        )}
                    </td>
                    <td className="px-3 py-2 align-top">
                        <span className="font-mono text-xs">{c.name}</span>{' '}
                        <span className={`${CHIP} text-muted-foreground`}>health check</span>
                    </td>
                    <td className="px-3 py-2 align-top text-muted-foreground">
                        {c.detail ?? (c.ok ? 'OK' : 'Failing')}
                    </td>
                </tr>
            ))}
        </>
    );
}
