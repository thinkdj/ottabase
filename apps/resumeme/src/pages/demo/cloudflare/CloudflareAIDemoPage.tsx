/**
 * Cloudflare AI Demo Page
 *
 * Interactive demo for Workers AI, AI Gateway, and Universal AI chat.
 * Lets users send prompts, pick providers/models, and see responses.
 */
import { api, isApiError } from '@/lib/api';
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
import { Link } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';

// ── Types ───────────────────────────────────────────────────────────────────

interface AIStatus {
    workersAI: boolean;
    aiGateway: boolean;
    openai: boolean;
    anthropic: boolean;
    googleAI: boolean;
}

interface ProviderInfo {
    key: string;
    name: string;
    pathPrefix: string;
}

interface ChatResponse {
    text?: string;
    response?: unknown;
    provider?: string;
    model?: string;
    usage?: Record<string, unknown>;
}

// ── Popular models by provider ──────────────────────────────────────────────

const PROVIDER_MODELS: Record<string, Array<{ value: string; label: string }>> = {
    'workers-ai': [
        { value: '@cf/meta/llama-3.1-8b-instruct', label: 'Llama 3.1 8B Instruct' },
        { value: '@cf/meta/llama-3-8b-instruct', label: 'Llama 3 8B Instruct' },
        { value: '@cf/mistral/mistral-7b-instruct-v0.2', label: 'Mistral 7B Instruct' },
        { value: '@hf/google/gemma-7b-it', label: 'Gemma 7B IT' },
    ],
    openai: [
        { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
        { value: 'gpt-4o', label: 'GPT-4o' },
        { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    ],
    anthropic: [
        { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
        { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
    ],
    'google-ai-studio': [
        { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
        { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    ],
};

// ── Component ───────────────────────────────────────────────────────────────

export function CloudflareAIDemoPage() {
    const [status, setStatus] = useState<AIStatus | null>(null);
    const [providers, setProviders] = useState<ProviderInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Chat state
    const [mode, setMode] = useState<'workers-ai' | 'gateway' | 'universal'>('workers-ai');
    const [prompt, setPrompt] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('');
    const [selectedProvider, setSelectedProvider] = useState('workers-ai');
    const [selectedModel, setSelectedModel] = useState('@cf/meta/llama-3.1-8b-instruct');
    const [response, setResponse] = useState<ChatResponse | null>(null);
    const [chatLoading, setChatLoading] = useState(false);

    // Fallback chain state (universal mode)
    const [fallbackChain, setFallbackChain] = useState<Array<{ provider: string; model: string }>>([]);

    // Load AI status and provider list on mount
    useEffect(() => {
        void loadStatus();
        void loadProviders();
    }, []);

    // Reset model when provider changes
    useEffect(() => {
        const models = PROVIDER_MODELS[selectedProvider];
        if (models && models.length > 0) {
            setSelectedModel(models[0].value);
        }
    }, [selectedProvider]);

    const loadStatus = async () => {
        try {
            const data = await api<AIStatus>('/api/cloudflare/ai/status');
            setStatus(data);
        } catch (err) {
            setError(isApiError(err) ? err.message : 'Failed to load AI status');
        }
    };

    const loadProviders = async () => {
        try {
            const data = await api<{ providers: ProviderInfo[] }>('/api/cloudflare/ai/providers');
            setProviders(data.providers);
        } catch {
            // Non-critical, we have hardcoded fallback
        }
    };

    const sendChat = useCallback(async () => {
        if (!prompt.trim()) return;

        setChatLoading(true);
        setError(null);
        setResponse(null);

        try {
            let endpoint: string;
            let body: Record<string, unknown>;

            switch (mode) {
                case 'workers-ai':
                    endpoint = '/api/cloudflare/ai/chat';
                    body = {
                        prompt: prompt.trim(),
                        model: selectedModel,
                        ...(systemPrompt.trim() ? { systemPrompt: systemPrompt.trim() } : {}),
                    };
                    break;

                case 'gateway':
                    endpoint = '/api/cloudflare/ai/gateway/chat';
                    body = {
                        provider: selectedProvider,
                        model: selectedModel,
                        prompt: prompt.trim(),
                        ...(systemPrompt.trim() ? { systemPrompt: systemPrompt.trim() } : {}),
                    };
                    break;

                case 'universal':
                    endpoint = '/api/cloudflare/ai/universal/chat';
                    body = {
                        provider: selectedProvider,
                        model: selectedModel,
                        prompt: prompt.trim(),
                        ...(systemPrompt.trim() ? { systemPrompt: systemPrompt.trim() } : {}),
                        ...(fallbackChain.length > 0 ? { fallback: fallbackChain } : {}),
                    };
                    break;
            }

            const data = await api<ChatResponse>(endpoint, {
                method: 'POST',
                body,
            });

            setResponse(data);
        } catch (err) {
            setError(isApiError(err) ? err.message : 'Chat request failed');
        } finally {
            setChatLoading(false);
        }
    }, [mode, prompt, systemPrompt, selectedProvider, selectedModel, fallbackChain]);

    const currentModels = PROVIDER_MODELS[selectedProvider] || [];

    return (
        <div className="space-y-6">
            <Button asChild variant="ghost" className="w-fit">
                <Link to="/demo/cloudflare">← Back to Cloudflare Features</Link>
            </Button>

            <div>
                <h1 className="mb-2 text-3xl font-semibold">Cloudflare AI Demo</h1>
                <p className="text-muted-foreground">
                    Multi-provider AI via Workers AI, AI Gateway, and Universal chat. Powered by{' '}
                    <code className="text-xs">@ottabase/cf-ai</code>.
                </p>
            </div>

            {/* ── Binding Status ──────────────────────────────────────────── */}
            {status ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Binding Status</CardTitle>
                        <CardDescription>Which AI services are configured in your Worker environment</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            <Badge variant={status.workersAI ? 'default' : 'secondary'}>
                                Workers AI {status.workersAI ? '✓' : '✗'}
                            </Badge>
                            <Badge variant={status.aiGateway ? 'default' : 'secondary'}>
                                AI Gateway {status.aiGateway ? '✓' : '✗'}
                            </Badge>
                            <Badge variant={status.openai ? 'default' : 'secondary'}>
                                OpenAI Key {status.openai ? '✓' : '✗'}
                            </Badge>
                            <Badge variant={status.anthropic ? 'default' : 'secondary'}>
                                Anthropic Key {status.anthropic ? '✓' : '✗'}
                            </Badge>
                            <Badge variant={status.googleAI ? 'default' : 'secondary'}>
                                Google AI Key {status.googleAI ? '✓' : '✗'}
                            </Badge>
                        </div>
                    </CardContent>
                </Card>
            ) : null}

            {/* ── Error Banner ────────────────────────────────────────────── */}
            {error ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                    <p className="text-sm text-destructive">{error}</p>
                </div>
            ) : null}

            {/* ── Mode Selector ───────────────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Chat Mode</CardTitle>
                    <CardDescription>Choose how to route your AI request</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant={mode === 'workers-ai' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => {
                                setMode('workers-ai');
                                setSelectedProvider('workers-ai');
                            }}
                        >
                            Workers AI
                        </Button>
                        <Button
                            variant={mode === 'gateway' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setMode('gateway')}
                        >
                            AI Gateway
                        </Button>
                        <Button
                            variant={mode === 'universal' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setMode('universal')}
                        >
                            Universal
                        </Button>
                    </div>

                    <p className="mt-3 text-xs text-muted-foreground">
                        {mode === 'workers-ai' &&
                            'Direct Workers AI binding — runs models on Cloudflare edge. No API key needed.'}
                        {mode === 'gateway' &&
                            'AI Gateway proxy — route requests through any supported provider with caching & logging.'}
                        {mode === 'universal' &&
                            'Universal client — unified chat interface with multi-provider fallback.'}
                    </p>
                </CardContent>
            </Card>

            {/* ── Provider & Model ────────────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Provider & Model</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {mode !== 'workers-ai' ? (
                        <div className="space-y-2">
                            <Label>Provider</Label>
                            <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select provider" />
                                </SelectTrigger>
                                <SelectContent>
                                    {providers.length > 0
                                        ? providers.map((p) => (
                                              <SelectItem key={p.key} value={p.key}>
                                                  {p.name}
                                              </SelectItem>
                                          ))
                                        : Object.keys(PROVIDER_MODELS).map((key) => (
                                              <SelectItem key={key} value={key}>
                                                  {key}
                                              </SelectItem>
                                          ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ) : null}

                    <div className="space-y-2">
                        <Label>Model</Label>
                        {currentModels.length > 0 ? (
                            <Select value={selectedModel} onValueChange={setSelectedModel}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select model" />
                                </SelectTrigger>
                                <SelectContent>
                                    {currentModels.map((m) => (
                                        <SelectItem key={m.value} value={m.value}>
                                            {m.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <Input
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value)}
                                placeholder="Enter model name"
                            />
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* ── Fallback Chain (Universal mode only) ────────────────── */}
            {mode === 'universal' ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Fallback Chain</CardTitle>
                        <CardDescription>
                            Add providers in priority order. If the primary fails, each fallback is tried sequentially.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {fallbackChain.map((step, idx) => {
                            const stepModels = PROVIDER_MODELS[step.provider] || [];
                            return (
                                <div key={idx} className="flex items-end gap-2">
                                    <span className="mb-2 text-xs font-medium text-muted-foreground">#{idx + 1}</span>
                                    <div className="flex-1 space-y-1">
                                        {idx === 0 && <Label className="text-xs">Provider</Label>}
                                        <Select
                                            value={step.provider}
                                            onValueChange={(val) => {
                                                setFallbackChain((prev) => {
                                                    const next = [...prev];
                                                    const firstModel = PROVIDER_MODELS[val]?.[0]?.value ?? '';
                                                    next[idx] = {
                                                        provider: val,
                                                        model: firstModel,
                                                    };
                                                    return next;
                                                });
                                            }}
                                        >
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.keys(PROVIDER_MODELS).map((key) => (
                                                    <SelectItem key={key} value={key}>
                                                        {key}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        {idx === 0 && <Label className="text-xs">Model</Label>}
                                        {stepModels.length > 0 ? (
                                            <Select
                                                value={step.model}
                                                onValueChange={(val) => {
                                                    setFallbackChain((prev) => {
                                                        const next = [...prev];
                                                        next[idx] = { ...next[idx], model: val };
                                                        return next;
                                                    });
                                                }}
                                            >
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {stepModels.map((m) => (
                                                        <SelectItem key={m.value} value={m.value}>
                                                            {m.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Input
                                                className="h-8 text-xs"
                                                value={step.model}
                                                onChange={(e) => {
                                                    setFallbackChain((prev) => {
                                                        const next = [...prev];
                                                        next[idx] = {
                                                            ...next[idx],
                                                            model: e.target.value,
                                                        };
                                                        return next;
                                                    });
                                                }}
                                                placeholder="Model name"
                                            />
                                        )}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="mb-0.5 h-8 px-2 text-muted-foreground hover:text-destructive"
                                        onClick={() => setFallbackChain((prev) => prev.filter((_, i) => i !== idx))}
                                    >
                                        ✕
                                    </Button>
                                </div>
                            );
                        })}

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const defaultProvider = 'workers-ai';
                                const defaultModel = PROVIDER_MODELS[defaultProvider]?.[0]?.value ?? '';
                                setFallbackChain((prev) => [
                                    ...prev,
                                    { provider: defaultProvider, model: defaultModel },
                                ]);
                            }}
                        >
                            + Add Fallback Provider
                        </Button>

                        {fallbackChain.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                                Primary: <strong>{selectedProvider}</strong> → Fallbacks:{' '}
                                {fallbackChain.map((s) => s.provider).join(' → ')}
                            </p>
                        )}
                    </CardContent>
                </Card>
            ) : null}

            {/* ── Chat Input ──────────────────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Send a Message</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>System Prompt (optional)</Label>
                        <Input
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                            placeholder="e.g. You are a helpful assistant"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Prompt</Label>
                        <Textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Ask anything..."
                            rows={3}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                    void sendChat();
                                }
                            }}
                        />
                    </div>
                    <Button onClick={() => void sendChat()} disabled={chatLoading || !prompt.trim()}>
                        {chatLoading ? 'Sending...' : 'Send'}
                    </Button>
                    <span className="ml-2 text-xs text-muted-foreground">Ctrl+Enter to send</span>
                </CardContent>
            </Card>

            {/* ── Response ────────────────────────────────────────────────── */}
            {response ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Response</CardTitle>
                        <CardDescription>
                            {response.provider ? (
                                <>
                                    Served by{' '}
                                    <Badge variant="outline" className="ml-1 text-xs">
                                        {response.provider}
                                    </Badge>
                                </>
                            ) : null}
                            {response.model ? (
                                <span className="ml-2 text-muted-foreground">· {response.model}</span>
                            ) : null}
                            {/* Highlight when a fallback provider served the response */}
                            {mode === 'universal' &&
                                fallbackChain.length > 0 &&
                                response.provider &&
                                response.provider !== selectedProvider && (
                                    <Badge variant="secondary" className="ml-2 text-xs">
                                        fallback
                                    </Badge>
                                )}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {response.text ? (
                            <div className="whitespace-pre-wrap rounded-lg border bg-muted/50 p-4 text-sm">
                                {response.text}
                            </div>
                        ) : (
                            <pre className="overflow-auto rounded-lg border bg-muted/50 p-4 text-xs">
                                {JSON.stringify(response.response ?? response, null, 2)}
                            </pre>
                        )}
                        {response.usage ? (
                            <div className="mt-3 text-xs text-muted-foreground">
                                Usage: {JSON.stringify(response.usage)}
                            </div>
                        ) : null}
                    </CardContent>
                </Card>
            ) : null}

            {/* ── Setup Info ──────────────────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Setup</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>
                        <strong>Workers AI</strong> — enabled by default via{' '}
                        <code className="text-xs">ai: &#123; binding: &quot;AI&quot; &#125;</code> in wrangler.jsonc.
                    </p>
                    <p>
                        <strong>AI Gateway</strong> — set <code className="text-xs">CFAI_GATEWAY_NAME</code> and{' '}
                        <code className="text-xs">CLOUDFLARE_ACCOUNT_ID</code> in your vars / .dev.vars.
                    </p>
                    <p>
                        <strong>External Providers</strong> — add API keys (
                        <code className="text-xs">CFAI_OPENAI_API_KEY</code>,{' '}
                        <code className="text-xs">CFAI_ANTHROPIC_API_KEY</code>,{' '}
                        <code className="text-xs">CFAI_GOOGLE_AI_API_KEY</code>) in .dev.vars or Cloudflare secrets.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
