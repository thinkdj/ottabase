/**
 * Cloudflare AI demo — a chat test over the REAL product path.
 *
 * This page deliberately has NO AI code of its own. It posts to `/api/ai/complete`, the same
 * endpoint the rest of the app uses, so what it demonstrates is the actual resolution chain:
 * the signed-in user's own key → their organization's key → the platform default → nothing.
 *
 * It replaced a demo built on `@ottabase/cf-ai`, which shipped a second, parallel AI client
 * (Workers AI binding, gateway proxy, a fallback chain) whose provider table had already
 * drifted from Cloudflare's docs. A demo that exercises a code path no product feature uses
 * is worse than no demo: it passes while the real path is broken.
 *
 * Three things here are worth reading as documentation:
 *  • the task selector — `extract` is `gate: 'required'`, so it 402s WITHOUT a tenant key even
 *    though the platform floor is configured. That is the BYOK upsell, enforced server-side.
 *  • `source` in the response — `byok` or `platform`, i.e. whose key actually paid.
 *  • the model override — the app validates it (no traversal, no operator-only dynamic route).
 */
import { api, isApiError } from '@/lib/api';
import { useSession } from '@/lib/auth';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Textarea,
} from '@ottabase/ui-shadcn';
import { useCallback, useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { DemoPageHeader } from '../DemoPageHeader';

// ── Types (mirroring the /api/ai/* responses) ───────────────────────────────

/** `GET /api/ai/status` — the resolver's dry run for the current user. */
interface AiStatus {
    configured: boolean;
    source: 'byok' | 'platform' | null;
    reason: string;
    provider: string | null;
    model: string | null;
    keyHint: string | null;
    hasSecret: boolean;
    strategy: string;
    gates: Record<string, { allowed: boolean; reason?: string }>;
}

/** `POST /api/ai/complete` — note `source`, which names whose key paid. */
interface CompleteResponse {
    text: string;
    source: 'byok' | 'platform' | null;
    provider: string | null;
    model: string | null;
    usage: { input: number; output: number; cached?: number } | null;
}

/**
 * Where a user connects their own key (the AI settings live on the profile page).
 *
 * Typed as a plain `string` rather than inlined as a literal: this app's TanStack route
 * registration only knows a handful of paths, so a literal `to="/profile"` fails to type-check
 * — the same pre-existing error `UserSection.tsx` has for `/login`, `/register` and `/profile`.
 * `DemoPageHeader` already navigates this way. Inline the literal once the route tree is
 * registered properly and this can go.
 */
const PROFILE_PATH: string = '/profile';

/**
 * The app's declared tasks (see `worker/lib/ai.ts`).
 *
 * Hard-coded rather than fetched: task keys are a SERVER contract, and the worker module that
 * declares them must not be imported into the browser bundle.
 */
const TASKS = [
    { key: 'assist', label: 'Assistant', note: 'Soft gate — runs on the platform key when you have none.' },
    { key: 'summarize', label: 'Summarise', note: 'Soft gate, and your model wins when you bring a key.' },
    {
        key: 'extract',
        label: 'Document extraction',
        note: 'REQUIRED gate — 402s without your own key, even though a platform key exists.',
    },
] as const;

// ── Component ───────────────────────────────────────────────────────────────

export function CloudflareAIDemoPage() {
    const { isAuthenticated, isInitialized, isLoading: authLoading } = useSession();
    const [status, setStatus] = useState<AiStatus | null>(null);
    const [statusError, setStatusError] = useState<string | null>(null);

    const [task, setTask] = useState<string>('assist');
    const [prompt, setPrompt] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('');
    const [model, setModel] = useState('');
    const [response, setResponse] = useState<CompleteResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);

    const signedIn = isInitialized && !authLoading && isAuthenticated;

    useEffect(() => {
        // The status endpoint is authenticated, like every other AI route.
        if (!signedIn) return;
        void (async () => {
            try {
                const data = await api<{ data: AiStatus }>('/api/ai/status');
                setStatus(data?.data ?? null);
                setStatusError(null);
            } catch (err) {
                setStatusError(isApiError(err) ? err.message : 'Failed to load AI status');
            }
        })();
    }, [signedIn]);

    const send = useCallback(async () => {
        if (!signedIn || !prompt.trim()) return;

        setSending(true);
        setError(null);
        setResponse(null);
        try {
            const data = await api<CompleteResponse>('/api/ai/complete', {
                method: 'POST',
                body: {
                    task,
                    prompt: prompt.trim(),
                    ...(systemPrompt.trim() ? { system: systemPrompt.trim() } : {}),
                    ...(model.trim() ? { model: model.trim() } : {}),
                },
            });
            setResponse(data);
        } catch (err) {
            // The server returns a CLASSIFIED code — BYOK_REQUIRED, NOT_CONFIGURED,
            // VALIDATION_ERROR — and the message is already tenant-safe.
            setError(isApiError(err) ? err.message : 'Request failed');
        } finally {
            setSending(false);
        }
    }, [signedIn, task, prompt, systemPrompt, model]);

    const activeTask = TASKS.find((entry) => entry.key === task);

    return (
        <div className="space-y-8">
            <DemoPageHeader
                title="AI chat"
                description={
                    <>
                        Tenant-aware chat through Cloudflare AI Gateway, powered by{' '}
                        <code className="text-xs">@ottabase/ottaai</code>. Posts to the same{' '}
                        <code className="text-xs">/api/ai/complete</code> the rest of the app uses, so the key
                        resolution and the server-side gate are the real ones.
                    </>
                }
                backTo="/demo/cloudflare"
                backLabel="Back to Cloudflare Features"
            />

            {/* ── What would resolve for you ──────────────────────────────── */}
            {signedIn ? (
                <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                    <CardHeader>
                        <CardTitle className="text-[0.9375rem] font-semibold">Your resolution</CardTitle>
                        <CardDescription>
                            Computed by the same resolver the runtime path uses, so the guard and the call cannot drift.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {status ? (
                            <>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant={status.configured ? 'default' : 'secondary'}>
                                        {status.configured ? 'Configured' : 'Not configured'}
                                    </Badge>
                                    {status.source ? (
                                        <Badge variant={status.source === 'byok' ? 'default' : 'outline'}>
                                            source: {status.source}
                                        </Badge>
                                    ) : null}
                                    {status.provider ? <Badge variant="outline">{status.provider}</Badge> : null}
                                    {status.model ? (
                                        <span className="text-xs text-muted-foreground">{status.model}</span>
                                    ) : null}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {status.hasSecret
                                        ? `Running on your own key (${status.keyHint ?? 'saved'}). You are billed by your provider.`
                                        : 'Running on the platform key. Connect your own to unlock gated tasks and pay your own provider.'}{' '}
                                    <Link className="underline" to={PROFILE_PATH}>
                                        Manage AI providers
                                    </Link>
                                </p>
                            </>
                        ) : (
                            <p className="text-sm text-muted-foreground">{statusError ?? 'Loading…'}</p>
                        )}
                    </CardContent>
                </Card>
            ) : null}

            {error ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                </div>
            ) : null}

            {isInitialized && !authLoading && !isAuthenticated ? (
                <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
                    Every AI route requires an authenticated session — an anonymous request could otherwise carry a
                    client-supplied organization header into a resolver that deliberately bypasses RLS. Sign in to send
                    prompts.
                </div>
            ) : null}

            {/* ── Compose ─────────────────────────────────────────────────── */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Send a message</CardTitle>
                    <CardDescription>
                        You choose a TASK, not a provider or a key — that is the whole promise. An operator changes
                        provisioning behaviour without touching this call site.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Task</Label>
                        <Select value={task} onValueChange={setTask}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select task" />
                            </SelectTrigger>
                            <SelectContent>
                                {TASKS.map((entry) => (
                                    <SelectItem key={entry.key} value={entry.key}>
                                        {entry.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {activeTask ? <p className="text-xs text-muted-foreground">{activeTask.note}</p> : null}
                    </div>

                    <div className="space-y-2">
                        <Label>System prompt (optional)</Label>
                        <Input
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                            placeholder="e.g. You are a helpful assistant"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Model override (optional)</Label>
                        <Input
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            placeholder="e.g. gpt-4o — leave blank to use the resolved default"
                        />
                        <p className="text-xs text-muted-foreground">
                            Validated server-side: no path traversal, and{' '}
                            <code className="text-xs">dynamic/&lt;route&gt;</code> is operator-only.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label>Prompt</Label>
                        <Textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Ask anything..."
                            rows={3}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && signedIn) void send();
                            }}
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Button onClick={() => void send()} disabled={sending || !prompt.trim() || !signedIn}>
                            {sending ? 'Sending…' : 'Send'}
                        </Button>
                        <span className="text-xs text-muted-foreground">
                            {!isInitialized || authLoading
                                ? 'Checking authentication…'
                                : signedIn
                                  ? 'Ctrl+Enter to send'
                                  : 'Sign in required'}
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* ── Response ────────────────────────────────────────────────── */}
            {response ? (
                <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                    <CardHeader>
                        <CardTitle className="text-[0.9375rem] font-semibold">Response</CardTitle>
                        <CardDescription className="flex flex-wrap items-center gap-2">
                            {response.source ? (
                                <Badge variant={response.source === 'byok' ? 'default' : 'outline'}>
                                    {response.source === 'byok' ? 'your key' : 'platform key'}
                                </Badge>
                            ) : null}
                            {response.provider ? <Badge variant="outline">{response.provider}</Badge> : null}
                            {response.model ? <span className="text-muted-foreground">· {response.model}</span> : null}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="whitespace-pre-wrap rounded-lg bg-background p-4 text-sm ring-1 ring-border">
                            {response.text}
                        </div>
                        {response.usage ? (
                            <div className="mt-3 text-xs text-muted-foreground">
                                {response.usage.input} in · {response.usage.output} out
                                {response.usage.cached !== undefined ? ` · ${response.usage.cached} cached` : ''}
                            </div>
                        ) : null}
                    </CardContent>
                </Card>
            ) : null}

            {/* ── Setup ───────────────────────────────────────────────────── */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Setup</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>
                        <strong>Required</strong> — <code className="text-xs">AI_CREDENTIAL_SECRET</code> (the master
                        key that encrypts tenant credentials). Without it the feature stays dormant and every AI route
                        returns 501.
                    </p>
                    <p>
                        <strong>Gateway</strong> — <code className="text-xs">CLOUDFLARE_ACCOUNT_ID</code> and{' '}
                        <code className="text-xs">CFAI_GATEWAY_NAME</code>, plus{' '}
                        <code className="text-xs">CFAI_GATEWAY_TOKEN</code> when the gateway is authenticated.
                    </p>
                    <p>
                        <strong>Platform floor (optional)</strong> —{' '}
                        <code className="text-xs">OTTAAI_PLATFORM_PROVIDER</code>,{' '}
                        <code className="text-xs">OTTAAI_PLATFORM_MODEL</code> and the matching{' '}
                        <code className="text-xs">CFAI_&lt;PROVIDER&gt;_API_KEY</code>. Leave unset to ship BYOK-only,
                        where every task upsells instead of falling back.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
