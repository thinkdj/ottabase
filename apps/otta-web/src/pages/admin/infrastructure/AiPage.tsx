/**
 * Admin > Infrastructure > AI Gateway
 *
 * Platform-admin, read-only view of the OttaAI deployment: Cloudflare AI Gateway
 * identity, frozen dials, task policies, provider wire coverage, and whether the
 * secrets that actually make it run are present. Editing happens in
 * `ottabase.config.ts` / env — this page exists so you do not have to grep either.
 *
 * Tenant BYOK (paste a key) lives at /admin/growth/ai-providers.
 */

import { useApiQuery } from '@ottabase/ottaorm/client';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { sanitizeUrl } from '@ottabase/utils/sanitize';
import { Link } from '@tanstack/react-router';
import { AlertTriangle, CheckCircle2, Copy, ExternalLink, KeyRound, Server, Sparkles, Waypoints } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { AiConfigSnapshot } from '@/ottabase/ai-config-types';

const QUIET_CARD = 'rounded-xl border-transparent bg-muted/40 shadow-none';
const SECTION_TITLE = 'text-[0.9375rem] font-semibold';
const MICRO_LABEL = 'text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground';

function StatusBadge({ ok, okLabel, badLabel }: { ok: boolean; okLabel: string; badLabel: string }) {
    return (
        <Badge
            variant="outline"
            className={`rounded-full border-transparent bg-background ring-1 ring-border ${
                ok ? 'text-success' : 'text-muted-foreground'
            }`}
        >
            {ok ? okLabel : badLabel}
        </Badge>
    );
}

function Kv({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="space-y-1">
            <div className={MICRO_LABEL}>{label}</div>
            <div className="break-all font-mono text-sm">{value ?? '—'}</div>
        </div>
    );
}

function presentLabel(present: boolean) {
    return present ? 'Set' : 'Missing';
}

export function AdminAiPage() {
    const [copied, setCopied] = useState(false);
    const query = useApiQuery<AiConfigSnapshot>({
        entity: 'ai-config',
        queryKey: ['admin', 'snapshot'],
        endpoint: '/api/admin/ai/config',
    });

    const data = query.data;
    const copySnapshot = async () => {
        if (!data) return;
        try {
            await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            setCopied(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1.5">
                    <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
                        <Sparkles className="h-6 w-6 text-muted-foreground" />
                        AI Gateway
                    </h1>
                    <p className="max-w-3xl text-muted-foreground">
                        Read-only snapshot of this deployment&apos;s OttaAI config. Cloudflare AI Gateway is the shipped
                        transport. Change dials in{' '}
                        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">ottabase.config.ts</code> or
                        env; secrets stay in{' '}
                        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">.dev.vars</code>.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="gap-2" asChild>
                        <Link to="/admin/growth/ai-providers">Workspace keys</Link>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => void copySnapshot()}
                        disabled={!data}
                    >
                        <Copy className="h-3.5 w-3.5" />
                        {copied ? 'Copied' : 'Copy snapshot'}
                    </Button>
                </div>
            </div>

            {query.isLoading ? (
                <div aria-busy="true" className="h-32 animate-pulse rounded-xl bg-muted/40" />
            ) : query.error ? (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    {query.error.message}
                </div>
            ) : data ? (
                <>
                    <div className="flex flex-wrap gap-2">
                        <StatusBadge ok={data.packageEnabled} okLabel="Package on" badLabel="Package off" />
                        <StatusBadge
                            ok={data.configured}
                            okLabel={data.dials.byokEnabled ? 'BYOK keyring ready' : 'Platform-only mode'}
                            badLabel="BYOK keyring missing"
                        />
                        <StatusBadge
                            ok={Boolean(data.gateway.accountId && data.gateway.name)}
                            okLabel="Gateway identified"
                            badLabel="Gateway incomplete"
                        />
                        <StatusBadge
                            ok={data.platform.routeUsable}
                            okLabel="Platform transport configured"
                            badLabel="No platform floor"
                        />
                    </div>

                    {data.configurationError ? (
                        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                            {data.configurationError}
                        </div>
                    ) : null}

                    {data.spend.warning ? (
                        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                            {data.spend.warning}
                        </div>
                    ) : null}

                    {data.platform.missing.length > 0 ? (
                        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                            <div className="mb-1 font-medium">Configuration notes</div>
                            <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
                                {data.platform.missing.map((item) => (
                                    <li key={item}>{item}</li>
                                ))}
                            </ul>
                        </div>
                    ) : null}

                    <Card className={QUIET_CARD}>
                        <CardHeader>
                            <CardTitle className={`flex items-center gap-2 ${SECTION_TITLE}`}>
                                <Waypoints className="h-4 w-4 text-muted-foreground" />
                                Cloudflare AI Gateway
                            </CardTitle>
                            <CardDescription>
                                Every inference call is proxied here — unified logging, cache, retries, and cost
                                analytics. Inline tenant keys travel as request headers; aliases select credentials
                                already stored in AI Gateway.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 sm:grid-cols-2">
                            <Kv label="Transport" value={data.transport.name} />
                            <Kv label="Gateway slug" value={data.gateway.name} />
                            <Kv label="Gateway source" value={data.gateway.source} />
                            <Kv label="Account ID" value={data.gateway.accountId} />
                            <Kv label="Gateway token" value={presentLabel(data.gateway.tokenPresent)} />
                            <Kv label="Unified Billing token" value={presentLabel(data.gateway.apiTokenPresent)} />
                            <Kv label="Proxy URL" value={data.gateway.proxyUrl} />
                            <div className="space-y-2">
                                <div className={MICRO_LABEL}>Links</div>
                                <div className="flex flex-col gap-1 text-sm">
                                    {data.gateway.dashboardUrl ? (
                                        <a
                                            href={sanitizeUrl(data.gateway.dashboardUrl)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                                        >
                                            Cloudflare dashboard
                                            <ExternalLink className="h-3 w-3" />
                                        </a>
                                    ) : null}
                                    <a
                                        href={sanitizeUrl(data.transport.docsUrl)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                                    >
                                        AI Gateway docs
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                    <a
                                        href={sanitizeUrl(data.transport.getStartedUrl)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                                    >
                                        Get started
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className={QUIET_CARD}>
                        <CardHeader>
                            <CardTitle className={SECTION_TITLE}>Dials</CardTitle>
                            <CardDescription>
                                Frozen at deploy. Changing mode or strategy silently re-points which key a tenant&apos;s
                                calls use.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 sm:grid-cols-3">
                            <Kv label="Mode" value={data.dials.mode} />
                            <Kv label="Strategy" value={data.dials.strategy} />
                            <Kv label="App scope" value={data.dials.appScope} />
                            <Kv label="BYOK enabled" value={String(data.dials.byokEnabled)} />
                            <Kv label="Org credentials" value={String(data.dials.allowOrgCredentials)} />
                            <Kv
                                label="Keyring"
                                value={
                                    data.keyring.present
                                        ? `${data.keyring.source} · ${data.keyring.currentKeyId} (${data.keyring.keyIds.length} keys)`
                                        : 'not set'
                                }
                            />
                        </CardContent>
                    </Card>

                    <Card className={QUIET_CARD}>
                        <CardHeader>
                            <CardTitle className={`flex items-center gap-2 ${SECTION_TITLE}`}>
                                <Server className="h-4 w-4 text-muted-foreground" />
                                Platform floor
                            </CardTitle>
                            <CardDescription>
                                Optional operator-paid fallback. Leave provider unset to ship BYOK-only — every task
                                then upsells instead of falling back.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 sm:grid-cols-2">
                            <Kv label="Provider" value={data.platform.provider} />
                            <Kv label="Model" value={data.platform.model} />
                            <Kv label="Billing" value={data.platform.billing} />
                            <Kv
                                label={data.platform.providerKeyEnv ?? 'Provider key'}
                                value={presentLabel(data.platform.providerKeyPresent)}
                            />
                            <Kv
                                label="Route usable"
                                value={data.platform.routeUsable ? 'yes — transport can place a call' : 'no'}
                            />
                            <Kv label="OBCF_KV" value={data.spend.kvBound ? 'bound' : 'missing'} />
                            <Kv label="Workers AI binding" value={data.bindings.workersAi ? 'bound' : 'unbound'} />
                            <Kv
                                label="Azure destination"
                                value={
                                    data.platform.azure.configured
                                        ? 'configured (resource + deployment + api version)'
                                        : 'not configured — Azure hidden from BYOK form'
                                }
                            />
                            <Kv
                                label="Rate limit / min"
                                value={`user ${data.rateLimit.perUser} · org ${data.rateLimit.perOrganization} · app ${data.rateLimit.perApp}`}
                            />
                        </CardContent>
                    </Card>

                    <Card className={QUIET_CARD}>
                        <CardHeader>
                            <CardTitle className={SECTION_TITLE}>Tasks</CardTitle>
                            <CardDescription>
                                Call sites name a task key only. Gate strength and mode live here, in the resolver, not
                                in the browser.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {data.tasks.map((task) => (
                                <div key={task.key} className="rounded-lg bg-background p-3 text-sm ring-1 ring-border">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-medium">{task.label}</span>
                                        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                                            {task.key}
                                        </code>
                                        <Badge variant="outline" className="rounded-full text-[0.6875rem]">
                                            {task.gate}
                                        </Badge>
                                        {task.mode ? (
                                            <Badge variant="outline" className="rounded-full text-[0.6875rem]">
                                                mode {task.mode}
                                            </Badge>
                                        ) : null}
                                    </div>
                                    <p className="mt-1 text-muted-foreground">
                                        {task.modelPolicy}
                                        {task.defaultModel ? ` · default ${task.defaultModel}` : ''}
                                        {task.requiredCapabilities.length
                                            ? ` · needs ${task.requiredCapabilities.join(', ')}`
                                            : ''}
                                    </p>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card className={QUIET_CARD}>
                        <CardHeader>
                            <CardTitle className={SECTION_TITLE}>Providers</CardTitle>
                            <CardDescription>
                                Wire-verified providers can be called through AI Gateway. Unservable means this
                                deployment is missing operator config (Azure destination is the usual case).
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {data.providers.map((provider) => (
                                <div
                                    key={provider.id}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background p-3 text-sm ring-1 ring-border"
                                >
                                    <div className="min-w-0">
                                        <span className="font-medium">{provider.displayName}</span>
                                        <span className="ml-2 text-muted-foreground">
                                            {provider.id}
                                            {provider.requiresKey ? ` · ${provider.keyEnv}` : ' · no tenant key'}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="outline" className="rounded-full text-[0.6875rem]">
                                            {provider.wireVerified ? 'wire verified' : 'no wire'}
                                        </Badge>
                                        <Badge variant="outline" className="rounded-full text-[0.6875rem]">
                                            {provider.tenantSelectable ? 'tenant BYOK' : 'not selectable'}
                                        </Badge>
                                        {provider.unservable ? (
                                            <Badge variant="outline" className="rounded-full text-[0.6875rem]">
                                                unservable here
                                            </Badge>
                                        ) : null}
                                        {provider.gatewayDocs ? (
                                            <a
                                                href={sanitizeUrl(provider.gatewayDocs)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-muted-foreground hover:text-foreground"
                                                aria-label={`${provider.displayName} gateway docs`}
                                            >
                                                <ExternalLink className="h-3.5 w-3.5" />
                                            </a>
                                        ) : null}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card className={QUIET_CARD}>
                        <CardHeader>
                            <CardTitle className={`flex items-center gap-2 ${SECTION_TITLE}`}>
                                <KeyRound className="h-4 w-4 text-muted-foreground" />
                                Secrets & env
                            </CardTitle>
                            <CardDescription>
                                Presence only — values never leave the worker. A missing required secret is why the
                                feature looks dormant.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {data.secrets.map((secret) => (
                                <div
                                    key={secret.key}
                                    className="flex flex-wrap items-start justify-between gap-2 rounded-lg bg-background p-3 text-sm ring-1 ring-border"
                                >
                                    <div className="min-w-0">
                                        <code className="font-mono text-xs">{secret.key}</code>
                                        <p className="mt-1 text-xs text-muted-foreground">{secret.note}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={MICRO_LABEL}>{secret.role}</span>
                                        {secret.present ? (
                                            <span className="inline-flex items-center gap-1 text-success">
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                Set
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground">Missing</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </>
            ) : null}
        </div>
    );
}
