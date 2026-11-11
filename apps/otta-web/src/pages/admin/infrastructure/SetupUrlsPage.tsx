/**
 * /admin/infrastructure/setup-urls (platform admins only): every URL to paste into a provider's
 * console (OAuth redirect URIs, webhook endpoints), grouped by provider, one copy button each.
 *
 * The URLs come from `getSetupUrls` in `@ottabase/utils/setup-urls`, the same route map the auth
 * and postmaster handlers read their paths from and the same helper `otta setup-urls` prints, so
 * the page, the CLI and the served routes agree. The server only adds AUTH_URL, the installed
 * packages and which env key NAMES are missing per provider; no secret value reaches the browser.
 */
import { useApiQuery } from '@ottabase/ottaorm/client';
import { Button, EnvName, Input, PageHeader, StatusChip, toast } from '@ottabase/ui';
import { getSetupUrls, type SetupUrlGroup } from '@ottabase/utils/setup-urls';
import { Copy, ExternalLink } from 'lucide-react';
import { useMemo, useState } from 'react';

interface SetupUrlsResponse {
    authUrl: string | null;
    packages: string[];
    providers: Array<{ id: string; missing: string[] }>;
}

const GROUPS = [
    { id: 'auth', title: 'Sign-in providers' },
    { id: 'email', title: 'Email webhooks' },
] as const;

async function copy(text: string) {
    try {
        await navigator.clipboard.writeText(text);
        toast.success('Copied');
    } catch {
        toast.error('Clipboard is not available');
    }
}

export function SetupUrlsPage() {
    const status = useApiQuery<SetupUrlsResponse>({
        queryKey: ['admin', 'system', 'setup-urls'],
        endpoint: '/api/admin/system/setup-urls',
        queryOptions: { staleTime: 30_000, meta: { errorPresentation: 'local' } },
    });
    const data = status.data;
    // null = follow the deployment (AUTH_URL, else this page's origin); a string = what the admin typed.
    const [typed, setTyped] = useState<string | null>(null);
    const origin = typed ?? data?.authUrl ?? window.location.origin;

    const result = useMemo(() => {
        if (!data) return null;
        try {
            return { urls: getSetupUrls(origin, { packages: data.packages }) };
        } catch (error) {
            return { error: error instanceof Error ? error.message : String(error) };
        }
    }, [data, origin]);

    const missingById = useMemo(
        () => new Map((data?.providers ?? []).map((provider) => [provider.id, provider.missing])),
        [data],
    );

    return (
        <div className="flex flex-col gap-6 pb-20">
            <PageHeader
                title="Setup URLs"
                description="The URLs each provider's console asks for: OAuth redirect URIs and webhook endpoints, ready to copy."
            />

            {status.isPending ? (
                <div className="h-11 animate-pulse rounded-lg bg-muted/40" aria-busy="true" />
            ) : !data ? (
                <div
                    role="alert"
                    className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                >
                    Could not load setup status.
                </div>
            ) : (
                <>
                    <section className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-4">
                        <label htmlFor="setup-origin" className="text-sm font-medium text-foreground">
                            Base URL
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                            <Input
                                id="setup-origin"
                                value={origin}
                                onChange={(e) => setTyped(e.target.value)}
                                placeholder="https://app.example.com"
                                className="w-full max-w-md font-mono text-sm"
                                spellCheck={false}
                            />
                            {typed !== null && (
                                <Button variant="ghost" size="sm" onClick={() => setTyped(null)}>
                                    Reset
                                </Button>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {result && 'error' in result ? (
                                <span className="text-destructive">{result.error}</span>
                            ) : data.authUrl ? (
                                <>
                                    Defaults to <EnvName>AUTH_URL</EnvName>, the origin OAuth redirect URIs are built
                                    from. Type another origin to see its URLs.
                                </>
                            ) : (
                                <>
                                    <EnvName>AUTH_URL</EnvName> is not set, so this shows the page's own origin. Set it
                                    before registering OAuth apps.
                                </>
                            )}{' '}
                            Same output in a terminal: <code className="font-mono">otta setup-urls --url {origin}</code>
                        </p>
                    </section>

                    {result &&
                        'urls' in result &&
                        GROUPS.map((group) => {
                            const providers = result.urls.providers.filter((p) => p.group === group.id);
                            if (providers.length === 0) return null;
                            return (
                                <section key={group.id} className="flex flex-col gap-3">
                                    <h2 className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                                        {group.title}
                                    </h2>
                                    {providers.map((provider) => (
                                        <ProviderCard
                                            key={provider.id}
                                            provider={provider}
                                            missing={missingById.get(provider.id) ?? provider.env}
                                        />
                                    ))}
                                </section>
                            );
                        })}
                </>
            )}
        </div>
    );
}

function ProviderCard({ provider, missing }: { provider: SetupUrlGroup; missing: readonly string[] }) {
    const configured = missing.length === 0;
    return (
        <div className="rounded-xl border border-border/60 bg-card">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/60 px-4 py-3">
                <span className="font-medium text-foreground">{provider.name}</span>
                <StatusChip tone={configured ? 'green' : 'amber'}>
                    {configured ? 'Configured' : 'Not configured'}
                </StatusChip>
                {!configured && (
                    <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                        Missing
                        {missing.map((key) => (
                            <EnvName key={key}>{key}</EnvName>
                        ))}
                    </span>
                )}
                <a
                    href={provider.consoleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                    Open console <ExternalLink className="h-3.5 w-3.5" />
                </a>
            </div>
            <dl className="divide-y divide-border/60">
                {provider.urls.map((url) => (
                    <div key={url.label} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
                        <dt className="shrink-0 text-sm text-muted-foreground sm:w-56">{url.label}</dt>
                        <dd className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <code className="min-w-0 flex-1 break-all rounded bg-muted/50 px-2 py-1 font-mono text-xs text-foreground">
                                    {url.value}
                                </code>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copy(url.value)}
                                    aria-label={`Copy ${provider.name} ${url.label}`}
                                >
                                    <Copy className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                            {url.note && <p className="mt-1 text-xs text-muted-foreground">{url.note}</p>}
                        </dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}
