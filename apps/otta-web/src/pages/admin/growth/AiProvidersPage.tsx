/**
 * AI Providers (admin)
 *
 * Two surfaces, deliberately separate:
 *
 *  1. CONNECT — the package's drop-in settings component, with the organization scope
 *     enabled. Saving an org key needs the `ai:manage` permission (owner/admin hold it);
 *     the server enforces that, this page only offers the affordance.
 *
 *  2. RESOLUTION INSPECTOR — `explainResolution` per task. This is the honest answer to
 *     the asymmetry the design makes explicit: an RLS filter is single-dimension and
 *     cannot express `org = X OR user = Y`, so under a mixed strategy A USER CAN BE
 *     RUNNING ON A KEY THEY CANNOT SEE IN THE LIST ABOVE. The inspector reads the
 *     resolver, not the list, so it always tells the truth.
 */

import { api } from '@/lib/api';
import { OTTAAI_CONFIG } from '@/ottabase/config';
import { AiProviderSettings, AiProvisioningProvider, useAiStatus } from '@ottabase/ottaai/react';
import type { CandidateExplanation, ResolutionReason } from '@ottabase/ottaai';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    NativeSelect,
    Separator,
} from '@ottabase/ui-shadcn';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, Stethoscope } from 'lucide-react';
import { useState } from 'react';

const QUIET_CARD = 'rounded-xl border-transparent bg-muted/40 shadow-none';
const SECTION_TITLE = 'text-[0.9375rem] font-semibold';
const MICRO_LABEL = 'text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground';

interface ExplainResponse {
    resolution: {
        source: 'byok' | 'platform' | null;
        reason: ResolutionReason;
        tenantReason: ResolutionReason | null;
        provider: string | null;
        model: string | null;
        credentialId: string | null;
    };
    candidates: CandidateExplanation[];
}

function ResolutionInspector() {
    const status = useAiStatus();
    const taskKeys = Object.keys(status.data?.gates ?? {});
    const [task, setTask] = useState<string>('');
    const activeTask = task || taskKeys[0] || '';

    const explain = useQuery<ExplainResponse, Error>({
        queryKey: ['ai_provider_credentials', 'explain', activeTask],
        enabled: Boolean(activeTask),
        // Through the SAME adapter as every other call: the handlers wrap their payload in
        // { data }, and  returns the RAW body — reading fields off the envelope would
        // dereference undefined and crash the page on first render.
        queryFn: () => aiRequest<ExplainResponse>(`/explain?task=${encodeURIComponent(activeTask)}`),
    });

    return (
        <Card className={QUIET_CARD}>
            <CardHeader>
                <CardTitle className={`flex items-center gap-2 ${SECTION_TITLE}`}>
                    <Stethoscope className="h-4 w-4 text-muted-foreground" />
                    Resolution inspector
                </CardTitle>
                <CardDescription>
                    What the resolver would pick for you, and why every other credential lost. Reads the resolver itself
                    — not the list above — so it stays honest even when a key is out of your management scope.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <label className={MICRO_LABEL} htmlFor="ai-explain-task">
                        Task
                    </label>
                    <NativeSelect
                        id="ai-explain-task"
                        value={activeTask}
                        onChange={(event) => setTask(event.target.value)}
                        disabled={taskKeys.length === 0}
                    >
                        {taskKeys.map((key) => (
                            <option key={key} value={key}>
                                {key}
                            </option>
                        ))}
                    </NativeSelect>
                </div>

                {explain.isLoading ? (
                    <div aria-busy="true">
                        <span className="sr-only">Loading resolution…</span>
                        <div className="h-20 animate-pulse rounded-lg bg-background/60" />
                    </div>
                ) : explain.error ? (
                    <p className="text-sm text-destructive">{explain.error.message}</p>
                ) : explain.data ? (
                    <>
                        <div className="rounded-lg bg-background p-3 text-sm ring-1 ring-border">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="rounded-full text-[0.6875rem]">
                                    {explain.data.resolution.source ?? 'no client'}
                                </Badge>
                                <span className="text-muted-foreground">
                                    {explain.data.resolution.provider ?? '—'}
                                    {explain.data.resolution.model ? ` · ${explain.data.resolution.model}` : ''}
                                </span>
                            </div>
                            <p className="mt-2 text-muted-foreground">
                                reason{' '}
                                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                                    {explain.data.resolution.reason}
                                </code>
                                {explain.data.resolution.tenantReason ? (
                                    <>
                                        {' · tenant path '}
                                        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                                            {explain.data.resolution.tenantReason}
                                        </code>
                                    </>
                                ) : null}
                            </p>
                        </div>

                        <Separator className="bg-border/60" />

                        {explain.data.candidates.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No candidate credentials in scope.</p>
                        ) : (
                            <div className="space-y-2">
                                {explain.data.candidates.map((candidate) => (
                                    <div
                                        key={candidate.id}
                                        className={`flex flex-wrap items-center justify-between gap-2 rounded-lg p-3 text-sm ring-1 ${
                                            candidate.selected
                                                ? 'bg-success/10 ring-success/30'
                                                : 'bg-background ring-border'
                                        }`}
                                    >
                                        <div className="min-w-0">
                                            <span className="font-medium">{candidate.label || candidate.provider}</span>
                                            <span className="ml-2 text-muted-foreground">
                                                {candidate.scope} · {candidate.keyHint || 'no key'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {candidate.score !== undefined ? (
                                                <span className={MICRO_LABEL}>score {candidate.score}</span>
                                            ) : null}
                                            <Badge variant="outline" className="rounded-full text-[0.6875rem]">
                                                {candidate.verdict}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                ) : null}

                <Button variant="ghost" size="sm" onClick={() => void explain.refetch()}>
                    Re-run
                </Button>
            </CardContent>
        </Card>
    );
}

export function AiProvidersPage() {
    return (
        <AiProvisioningProvider basePath="/api/ai" request={aiRequest}>
            <div className="max-w-3xl space-y-8">
                <div className="space-y-1.5">
                    <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
                        <Sparkles className="h-6 w-6 text-muted-foreground" />
                        AI providers
                    </h1>
                    <p className="max-w-3xl text-muted-foreground">
                        Bring your own provider key. Strategy{' '}
                        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{OTTAAI_CONFIG.strategy}</code>
                        , mode{' '}
                        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{OTTAAI_CONFIG.mode}</code>
                        {OTTAAI_CONFIG.byokEnabled ? '' : ' — BYOK is currently switched off platform-wide'}.
                    </p>
                </div>

                <AiProviderSettings
                    // Opt in and let SERVER TRUTH decide. The component ANDs this with
                    // `status.orgScopeManageable`, which now carries both the operator's
                    // `allowOrgCredentials` dial and the strategy — so reading
                    // `OTTAAI_CONFIG.allowOrgCredentials` here again would be a second,
                    // independently-fetched copy of an answer the server already gave.
                    allowOrgScope
                    title="Organization & personal keys"
                    description="A personal key applies only to you. An organization key applies to everyone in this workspace — it is a spending instrument, so only owners and admins can change it."
                />

                <ResolutionInspector />
            </div>
        </AiProvisioningProvider>
    );
}

/**
 * The app's API client, adapted to the package's request seam.
 *
 * PASSING THE APP CLIENT MATTERS: it attaches `X-Org-Id` and `X-App-Id`, and those headers
 * are what select the tenancy scope the server resolves against. The package's bare-fetch
 * default would silently resolve in the session's DEFAULT org.
 */
const aiRequest = async <T,>(path: string, init?: { method?: string; body?: unknown }): Promise<T> => {
    // The api client returns undefined for a 204 or a non-JSON 2xx, so this must not assume
    // an envelope is present — otherwise a legitimate empty success becomes a TypeError.
    const response = await api<{ data: T } | undefined>(path, { method: init?.method ?? 'GET', body: init?.body });
    return response?.data as T;
};
