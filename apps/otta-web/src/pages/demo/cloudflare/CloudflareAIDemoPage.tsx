/**
 * OttaAI playground — real app routes, not a parallel demo client.
 *
 * Chat calls `/api/ai/complete`; vectors call `/api/ai/embed`. Both resolve the signed-in
 * tenant's selected credential before the platform fallback, enforce their task policy on
 * the server, and expose only redacted provenance back to this page.
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
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Textarea,
} from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Bot, Braces, Check, Cloud, KeyRound, Layers3, MessageSquareText, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DemoPageHeader } from '../DemoPageHeader';

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

interface CompleteResponse {
    text: string;
    source: 'byok' | 'platform' | null;
    provider: string | null;
    model: string | null;
    usage: { input: number; output: number; cached?: number } | null;
}

interface EmbedResponse {
    vectors: number[][];
    source: 'byok' | 'platform' | null;
    provider: string | null;
    model: string | null;
    usage: { input: number } | null;
}

type Surface = 'chat' | 'embeddings';

const PROFILE_PATH: string = '/profile';

const TASKS = [
    { key: 'assist', label: 'Assistant', note: 'Uses the platform fallback when you have no tenant key.' },
    { key: 'summarize', label: 'Summarise', note: 'Optimised for longer source text; your tenant model wins.' },
    {
        key: 'extract',
        label: 'Document extraction',
        note: 'Requires a tenant key. The platform never pays for this task.',
    },
] as const;

function sourceLabel(source: 'byok' | 'platform' | null): string {
    if (source === 'byok') return 'tenant key';
    if (source === 'platform') return 'platform key';
    return 'no route';
}

function VectorPreview({ vector }: { vector: number[] }) {
    const preview = vector.slice(0, 8).map((value) => value.toFixed(4));
    return (
        <code className="block overflow-x-auto rounded-lg bg-background px-3 py-2 font-mono text-xs leading-6 text-foreground ring-1 ring-border">
            [{preview.join(', ')}
            {vector.length > preview.length ? ', …' : ''}]
        </code>
    );
}

export function CloudflareAIDemoPage() {
    const { isAuthenticated, isInitialized, isLoading: authLoading } = useSession();
    const [status, setStatus] = useState<AiStatus | null>(null);
    const [statusError, setStatusError] = useState<string | null>(null);
    const [surface, setSurface] = useState<Surface>('chat');

    const [task, setTask] = useState<string>('assist');
    const [prompt, setPrompt] = useState('What makes a good multi-tenant AI boundary?');
    const [systemPrompt, setSystemPrompt] = useState('Answer in three concise bullets.');
    const [model, setModel] = useState('');
    const [response, setResponse] = useState<CompleteResponse | null>(null);
    const [chatError, setChatError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);

    const [embeddingText, setEmbeddingText] = useState(
        'Ottabase gives product teams the SaaS foundation so they can ship the part that matters.',
    );
    const [dimensions, setDimensions] = useState('');
    const [embedding, setEmbedding] = useState<EmbedResponse | null>(null);
    const [embeddingError, setEmbeddingError] = useState<string | null>(null);
    const [embeddingSending, setEmbeddingSending] = useState(false);

    const signedIn = isInitialized && !authLoading && isAuthenticated;
    const activeTask = TASKS.find((entry) => entry.key === task);
    const embeddingInputs = useMemo(
        () =>
            embeddingText
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean),
        [embeddingText],
    );

    useEffect(() => {
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
        setChatError(null);
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
            setChatError(isApiError(err) ? err.message : 'The chat request failed');
        } finally {
            setSending(false);
        }
    }, [model, prompt, signedIn, systemPrompt, task]);

    const createEmbedding = useCallback(async () => {
        if (!signedIn || embeddingInputs.length === 0) return;
        setEmbeddingSending(true);
        setEmbeddingError(null);
        setEmbedding(null);
        try {
            const parsedDimensions = dimensions.trim() ? Number(dimensions) : undefined;
            const data = await api<EmbedResponse>('/api/ai/embed', {
                method: 'POST',
                body: {
                    input: embeddingInputs.length === 1 ? embeddingInputs[0] : embeddingInputs,
                    ...(parsedDimensions !== undefined ? { dimensions: parsedDimensions } : {}),
                },
            });
            setEmbedding(data);
        } catch (err) {
            setEmbeddingError(isApiError(err) ? err.message : 'The embedding request failed');
        } finally {
            setEmbeddingSending(false);
        }
    }, [dimensions, embeddingInputs, signedIn]);

    const activeSource = response?.source ?? embedding?.source ?? status?.source ?? null;

    return (
        <div className="space-y-8 pb-8">
            <DemoPageHeader
                title="OttaAI Playground"
                description="A small, honest surface for the real OttaAI runtime: tenant-aware chat and embeddings through Cloudflare AI Gateway. No browser-held keys, no parallel demo client."
                backTo="/demo/cloudflare"
                backLabel="Back to Cloudflare Features"
                actions={
                    <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-xs font-medium">
                        <Sparkles className="h-3.5 w-3.5" /> Real product route
                    </Badge>
                }
            />

            {isInitialized && !authLoading && !isAuthenticated ? (
                <Card className="border-warning/30 bg-warning/5 shadow-none">
                    <CardContent className="flex gap-3 p-4 text-sm text-warning">
                        <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
                        <p>
                            Sign in to run the playground. OttaAI always derives identity and organization scope on the
                            server before it looks at a tenant credential.
                        </p>
                    </CardContent>
                </Card>
            ) : null}

            <Card className="overflow-hidden rounded-xl border-border/70 bg-card shadow-none">
                <CardHeader className="border-b border-border/70 bg-muted/20 pb-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                            <CardTitle className="text-base">Your AI route</CardTitle>
                            <CardDescription>
                                What the resolver would use for this signed-in tenant right now.
                            </CardDescription>
                        </div>
                        {status ? (
                            <Badge variant={status.configured ? 'default' : 'secondary'}>
                                {status.configured ? `Ready · ${sourceLabel(status.source)}` : 'Not configured'}
                            </Badge>
                        ) : null}
                    </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-5">
                    {signedIn && status ? (
                        <>
                            <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
                                <div
                                    className={`rounded-lg border p-3 ${status.source === 'byok' ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/20'}`}
                                >
                                    <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                                        <KeyRound className="h-4 w-4" /> Tenant key
                                    </div>
                                    <p className="text-xs leading-relaxed text-muted-foreground">
                                        Your personal or workspace credential takes priority when eligible.
                                    </p>
                                </div>
                                <ArrowRight className="m-auto hidden h-4 w-4 text-muted-foreground md:block" />
                                <div
                                    className={`rounded-lg border p-3 ${status.source === 'platform' ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/20'}`}
                                >
                                    <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                                        <Cloud className="h-4 w-4" /> Platform fallback
                                    </div>
                                    <p className="text-xs leading-relaxed text-muted-foreground">
                                        Soft tasks can use the deployment's inexpensive default.
                                    </p>
                                </div>
                                <ArrowRight className="m-auto hidden h-4 w-4 text-muted-foreground md:block" />
                                <div className="rounded-lg border border-border bg-muted/20 p-3">
                                    <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                                        <Bot className="h-4 w-4" /> Task policy
                                    </div>
                                    <p className="text-xs leading-relaxed text-muted-foreground">
                                        Sensitive work can require BYOK before any provider call is made.
                                    </p>
                                </div>
                            </div>
                            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
                                {status.provider ? <Badge variant="outline">{status.provider}</Badge> : null}
                                {status.model ? <span>{status.model}</span> : null}
                                <span>·</span>
                                <span>
                                    {status.hasSecret
                                        ? 'A tenant credential is selected for eligible work.'
                                        : 'No tenant credential is selected; soft tasks may use the platform fallback.'}
                                </span>
                                <Link
                                    className="font-medium text-foreground underline underline-offset-4"
                                    to={PROFILE_PATH}
                                >
                                    Manage providers
                                </Link>
                            </div>
                        </>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            {signedIn
                                ? (statusError ?? 'Checking your route…')
                                : 'Your route appears after you sign in.'}
                        </p>
                    )}
                </CardContent>
            </Card>

            <Tabs value={surface} onValueChange={(value) => setSurface(value as Surface)} className="space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <TabsList className="w-full sm:w-auto">
                        <TabsTrigger value="chat" className="flex-1 gap-2 sm:flex-none">
                            <MessageSquareText className="h-4 w-4" /> Chat
                        </TabsTrigger>
                        <TabsTrigger value="embeddings" className="flex-1 gap-2 sm:flex-none">
                            <Braces className="h-4 w-4" /> Embeddings
                        </TabsTrigger>
                    </TabsList>
                    <p className="text-xs text-muted-foreground">
                        Active source: <span className="font-medium text-foreground">{sourceLabel(activeSource)}</span>
                    </p>
                </div>

                <TabsContent value="chat" className="mt-0 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
                    <Card className="rounded-xl border-border/70 shadow-none">
                        <CardHeader>
                            <CardTitle className="text-base">Ask the assistant</CardTitle>
                            <CardDescription>
                                Name a task, not a provider. Resolution, gating and attribution stay server-side.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="space-y-2">
                                <Label>Task</Label>
                                <Select value={task} onValueChange={setTask}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a task" />
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
                                <Label htmlFor="ai-prompt">Prompt</Label>
                                <Textarea
                                    id="ai-prompt"
                                    value={prompt}
                                    onChange={(event) => setPrompt(event.target.value)}
                                    rows={5}
                                    placeholder="Ask anything…"
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && signedIn)
                                            void send();
                                    }}
                                />
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="ai-system">
                                        System instruction <span className="text-muted-foreground">(optional)</span>
                                    </Label>
                                    <Input
                                        id="ai-system"
                                        value={systemPrompt}
                                        onChange={(event) => setSystemPrompt(event.target.value)}
                                        placeholder="Be concise…"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="ai-model">
                                        Model override <span className="text-muted-foreground">(optional)</span>
                                    </Label>
                                    <Input
                                        id="ai-model"
                                        value={model}
                                        onChange={(event) => setModel(event.target.value)}
                                        placeholder="gpt-4o-mini"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <Button onClick={() => void send()} disabled={sending || !prompt.trim() || !signedIn}>
                                    {sending ? 'Thinking…' : 'Send message'}
                                </Button>
                                <span className="text-xs text-muted-foreground">
                                    {signedIn ? 'Ctrl/⌘ + Enter to send' : 'Sign in required'}
                                </span>
                            </div>
                            {chatError ? <p className="text-sm text-destructive">{chatError}</p> : null}
                        </CardContent>
                    </Card>

                    <Card className="rounded-xl border-border/70 bg-muted/15 shadow-none">
                        <CardHeader>
                            <CardTitle className="text-base">Response</CardTitle>
                            <CardDescription>
                                Redacted provenance is visible; provider credentials never are.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {response ? (
                                <div className="space-y-4">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant={response.source === 'byok' ? 'default' : 'outline'}>
                                            {sourceLabel(response.source)}
                                        </Badge>
                                        {response.provider ? (
                                            <Badge variant="outline">{response.provider}</Badge>
                                        ) : null}
                                        {response.model ? (
                                            <span className="text-xs text-muted-foreground">{response.model}</span>
                                        ) : null}
                                    </div>
                                    <div className="whitespace-pre-wrap rounded-lg bg-background p-4 text-sm leading-6 ring-1 ring-border">
                                        {response.text}
                                    </div>
                                    {response.usage ? (
                                        <p className="text-xs text-muted-foreground">
                                            {response.usage.input} input · {response.usage.output} output
                                            {response.usage.cached !== undefined
                                                ? ` · ${response.usage.cached} cached`
                                                : ''}
                                        </p>
                                    ) : null}
                                </div>
                            ) : (
                                <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 text-center">
                                    <MessageSquareText className="mb-3 h-5 w-5 text-muted-foreground" />
                                    <p className="text-sm font-medium">Your response will appear here</p>
                                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                        It includes the source, model and token accounting that actually served the
                                        call.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent
                    value="embeddings"
                    className="mt-0 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]"
                >
                    <Card className="rounded-xl border-border/70 shadow-none">
                        <CardHeader>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <CardTitle className="text-base">Turn text into vectors</CardTitle>
                                    <CardDescription className="mt-1">
                                        Use vectors for semantic search, similarity and recommendations — not a
                                        human-facing answer.
                                    </CardDescription>
                                </div>
                                <Badge variant="outline">OpenAI · text-embedding-3-small</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="rounded-lg border border-border bg-muted/25 p-3 text-xs leading-relaxed text-muted-foreground">
                                The model is task-pinned by the server. One non-empty line creates one vector,
                                preserving order; the demo supports up to 16 lines. It does not persist vectors or
                                connect them to Vectorize.
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="embedding-text">Text to embed</Label>
                                <Textarea
                                    id="embedding-text"
                                    value={embeddingText}
                                    onChange={(event) => setEmbeddingText(event.target.value)}
                                    rows={7}
                                    placeholder="One text value per line…"
                                />
                                <p className="text-xs text-muted-foreground">
                                    {embeddingInputs.length} {embeddingInputs.length === 1 ? 'vector' : 'vectors'}{' '}
                                    queued
                                </p>
                            </div>
                            <div className="max-w-56 space-y-2">
                                <Label htmlFor="embedding-dimensions">
                                    Dimensions <span className="text-muted-foreground">(optional)</span>
                                </Label>
                                <Input
                                    id="embedding-dimensions"
                                    inputMode="numeric"
                                    value={dimensions}
                                    onChange={(event) => setDimensions(event.target.value.replace(/[^0-9]/g, ''))}
                                    placeholder="Provider default (1536)"
                                />
                                <p className="text-xs text-muted-foreground">1–1536 for the pinned model.</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <Button
                                    onClick={() => void createEmbedding()}
                                    disabled={embeddingSending || embeddingInputs.length === 0 || !signedIn}
                                >
                                    {embeddingSending ? 'Vectorising…' : 'Create embedding'}
                                </Button>
                                <span className="text-xs text-muted-foreground">
                                    Same tenant resolver, quota and provenance as chat.
                                </span>
                            </div>
                            {embeddingError ? <p className="text-sm text-destructive">{embeddingError}</p> : null}
                        </CardContent>
                    </Card>

                    <Card className="rounded-xl border-border/70 bg-muted/15 shadow-none">
                        <CardHeader>
                            <CardTitle className="text-base">Vector output</CardTitle>
                            <CardDescription>A compact preview keeps the numerical result legible.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {embedding ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="rounded-lg border border-border bg-background p-3">
                                            <p className="text-xs text-muted-foreground">Vectors</p>
                                            <p className="mt-1 text-xl font-semibold">{embedding.vectors.length}</p>
                                        </div>
                                        <div className="rounded-lg border border-border bg-background p-3">
                                            <p className="text-xs text-muted-foreground">Dimensions</p>
                                            <p className="mt-1 text-xl font-semibold">
                                                {embedding.vectors[0]?.length ?? 0}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant={embedding.source === 'byok' ? 'default' : 'outline'}>
                                            {sourceLabel(embedding.source)}
                                        </Badge>
                                        {embedding.provider ? (
                                            <Badge variant="outline">{embedding.provider}</Badge>
                                        ) : null}
                                        {embedding.model ? (
                                            <span className="text-xs text-muted-foreground">{embedding.model}</span>
                                        ) : null}
                                    </div>
                                    {embedding.vectors[0] ? <VectorPreview vector={embedding.vectors[0]} /> : null}
                                    <div className="flex items-start gap-2 rounded-lg bg-background p-3 text-xs leading-relaxed text-muted-foreground ring-1 ring-border">
                                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                                        <span>
                                            The full vector is returned by the API. This demo only previews its first
                                            values so the useful facts — order, count and dimensionality — stay
                                            readable.
                                        </span>
                                    </div>
                                    {embedding.usage ? (
                                        <p className="text-xs text-muted-foreground">
                                            {embedding.usage.input} input tokens
                                        </p>
                                    ) : null}
                                </div>
                            ) : (
                                <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 text-center">
                                    <Layers3 className="mb-3 h-5 w-5 text-muted-foreground" />
                                    <p className="text-sm font-medium">A vector preview will appear here</p>
                                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                        This makes the embedding operation tangible without pretending a vector is
                                        prose.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Card className="rounded-xl border-border/70 bg-muted/25 shadow-none">
                <CardContent className="grid gap-5 p-5 md:grid-cols-3">
                    <div className="space-y-1.5">
                        <KeyRound className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium">Keys stay server-side</p>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            The browser sees a redacted source, never a provider secret or gateway token.
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <Bot className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium">Tasks carry the policy</p>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            The app chooses the job; OttaAI decides which eligible credential and model may serve it.
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <Layers3 className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium">Embeddings are ready for a real feature</p>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            This route creates vectors. A search feature can next store them in a deliberate
                            Vectorize-backed model.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
