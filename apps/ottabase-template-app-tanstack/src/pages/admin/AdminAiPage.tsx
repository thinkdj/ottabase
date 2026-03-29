/**
 * Admin AI Settings Page — View AI provider status and configuration.
 *
 * Shows which AI providers are configured, available models,
 * and links to the AI Chat page.
 */
import { api } from '@/lib/api';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Separator,
    Skeleton,
} from '@ottabase/ui-shadcn';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, Bot, CheckCircle, ExternalLink, MessageSquare, Server, ShieldCheck, XCircle } from 'lucide-react';

interface AIStatus {
    workersAI: boolean;
    aiGateway: boolean;
    openai: boolean;
    anthropic: boolean;
    googleAI: boolean;
}

interface ModelInfo {
    id: string;
    name: string;
    context: string;
}

interface ModelsResponse {
    models: Record<string, ModelInfo[]>;
    providers: Array<{ key: string; name: string }>;
}

const PROVIDER_DETAILS: Record<string, { name: string; description: string; docsUrl: string }> = {
    workersAI: {
        name: 'Workers AI',
        description: 'Run AI models directly on Cloudflare edge network. No API key needed — uses native binding.',
        docsUrl: 'https://developers.cloudflare.com/workers-ai/',
    },
    aiGateway: {
        name: 'AI Gateway',
        description: 'Proxy requests to any AI provider with caching, rate limiting, logging, and analytics.',
        docsUrl: 'https://developers.cloudflare.com/ai-gateway/',
    },
    openai: {
        name: 'OpenAI',
        description: 'GPT-4o, GPT-4 Turbo, and GPT-3.5 models via AI Gateway.',
        docsUrl: 'https://developers.cloudflare.com/ai-gateway/providers/openai/',
    },
    anthropic: {
        name: 'Anthropic',
        description: 'Claude family of models via AI Gateway.',
        docsUrl: 'https://developers.cloudflare.com/ai-gateway/providers/anthropic/',
    },
    googleAI: {
        name: 'Google AI Studio',
        description: 'Gemini models via AI Gateway.',
        docsUrl: 'https://developers.cloudflare.com/ai-gateway/providers/google-ai-studio/',
    },
};

function StatusIcon({ configured }: { configured: boolean }) {
    return configured ? (
        <CheckCircle className="w-5 h-5 text-green-500" />
    ) : (
        <XCircle className="w-5 h-5 text-muted-foreground/40" />
    );
}

export function AdminAiPage() {
    const statusQuery = useQuery({
        queryKey: ['ai-status'],
        queryFn: () => api('/api/cloudflare/ai/status') as Promise<AIStatus>,
    });

    const modelsQuery = useQuery({
        queryKey: ['ai-models'],
        queryFn: () => api('/api/ai/models') as Promise<ModelsResponse>,
    });

    const status = statusQuery.data;
    const models = modelsQuery.data;
    const configuredCount = status ? Object.values(status).filter(Boolean).length : 0;

    /** Map provider key (e.g. "workers-ai") to AIStatus key (e.g. "workersAI") */
    const mapProviderKeyToStatusKey = (providerKey: string): keyof AIStatus => {
        const mapping: Record<string, keyof AIStatus> = {
            'workers-ai': 'workersAI',
            'google-ai-studio': 'googleAI',
        };
        return mapping[providerKey] ?? (providerKey as keyof AIStatus);
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link to="/admin">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Bot className="w-6 h-6" />
                        AI Configuration
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Manage AI providers, models, and chat settings.
                    </p>
                </div>
                <Link to="/ai/chat">
                    <Button className="gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Open AI Chat
                    </Button>
                </Link>
            </div>

            {/* Overview card */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Server className="w-5 h-5" />
                        Provider Status
                    </CardTitle>
                    <CardDescription>
                        {configuredCount > 0
                            ? `${configuredCount} of ${Object.keys(PROVIDER_DETAILS).length} providers configured`
                            : 'Loading provider status...'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {statusQuery.isLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <Skeleton key={i} className="h-16 w-full rounded-lg" />
                            ))}
                        </div>
                    ) : status ? (
                        <div className="space-y-3">
                            {Object.entries(PROVIDER_DETAILS).map(([key, details]) => {
                                const isConfigured = status[key as keyof AIStatus] ?? false;
                                return (
                                    <div
                                        key={key}
                                        className="flex items-start gap-3 p-3 rounded-lg border border-border"
                                    >
                                        <StatusIcon configured={isConfigured} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-sm">{details.name}</span>
                                                <Badge
                                                    variant={isConfigured ? 'default' : 'secondary'}
                                                    className="text-[10px]"
                                                >
                                                    {isConfigured ? 'Configured' : 'Not configured'}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {details.description}
                                            </p>
                                        </div>
                                        <a
                                            href={details.docsUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-sm">Failed to load provider status.</p>
                    )}
                </CardContent>
            </Card>

            {/* Available Models */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5" />
                        Available Models
                    </CardTitle>
                    <CardDescription>Models available for each configured provider.</CardDescription>
                </CardHeader>
                <CardContent>
                    {modelsQuery.isLoading ? (
                        <div className="space-y-3">
                            {[1, 2].map((i) => (
                                <Skeleton key={i} className="h-24 w-full rounded-lg" />
                            ))}
                        </div>
                    ) : models ? (
                        <div className="space-y-4">
                            {Object.entries(models.models).map(([providerKey, providerModels]) => {
                                const providerName =
                                    models.providers.find((p) => p.key === providerKey)?.name || providerKey;
                                const isConfigured = status?.[mapProviderKeyToStatusKey(providerKey)] ?? false;

                                return (
                                    <div key={providerKey}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <h3 className="text-sm font-medium">{providerName}</h3>
                                            <Badge
                                                variant={isConfigured ? 'default' : 'outline'}
                                                className="text-[10px]"
                                            >
                                                {isConfigured ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                            {providerModels.map((m) => (
                                                <div
                                                    key={m.id}
                                                    className="flex items-center justify-between p-2 rounded border border-border text-sm"
                                                >
                                                    <span className="font-mono text-xs truncate">{m.name}</span>
                                                    <Badge
                                                        variant="secondary"
                                                        className="text-[10px] ml-2 flex-shrink-0"
                                                    >
                                                        {m.context}
                                                    </Badge>
                                                </div>
                                            ))}
                                        </div>
                                        <Separator className="mt-4" />
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-sm">Failed to load models.</p>
                    )}
                </CardContent>
            </Card>

            {/* Quick Links */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Quick Links</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-3">
                        <Link to="/ai/chat">
                            <Button variant="outline" size="sm" className="gap-2">
                                <MessageSquare className="w-4 h-4" />
                                AI Chat
                            </Button>
                        </Link>
                        <Link to="/demo" className="gap-2">
                            <Button variant="outline" size="sm" className="gap-2">
                                <Bot className="w-4 h-4" />
                                AI Demo
                            </Button>
                        </Link>
                        <a
                            href="https://developers.cloudflare.com/workers-ai/"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <Button variant="outline" size="sm" className="gap-2">
                                <ExternalLink className="w-4 h-4" />
                                Workers AI Docs
                            </Button>
                        </a>
                        <a
                            href="https://developers.cloudflare.com/ai-gateway/"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <Button variant="outline" size="sm" className="gap-2">
                                <ExternalLink className="w-4 h-4" />
                                AI Gateway Docs
                            </Button>
                        </a>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
