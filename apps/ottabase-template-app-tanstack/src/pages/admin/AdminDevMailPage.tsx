import { api, isApiError } from '@/lib/api';
import { useApiMutation } from '@ottabase/ottaorm/client';
import {
    Alert,
    AlertDescription,
    AlertTitle,
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Separator,
} from '@ottabase/ui-shadcn';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, ExternalLink, Inbox, RefreshCw, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

interface DevMailAddress {
    email: string;
    name?: string;
}

interface DevMailMessage {
    id: string;
    provider: string;
    createdAt: number;
    from: DevMailAddress;
    to: DevMailAddress[];
    cc: DevMailAddress[];
    bcc: DevMailAddress[];
    replyTo?: DevMailAddress;
    subject: string;
    html: string;
    text?: string;
    previewText: string;
}

interface DevMailListResponse {
    messages: DevMailMessage[];
    cursor?: string;
    hasMore: boolean;
}

function formatAddress(address: DevMailAddress): string {
    return address.name ? `${address.name} <${address.email}>` : address.email;
}

function extractLinks(message: DevMailMessage): string[] {
    const source = [message.html, message.text || ''].join(' ');
    const matches = source.match(/https?:\/\/[^\s"'<>]+/g) || [];
    return Array.from(new Set(matches));
}

function formatDate(timestamp: number): string {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(timestamp));
}

export function AdminDevMailPage() {
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ['admin', 'dev-mail'],
        queryFn: () => api<DevMailListResponse>('/api/admin/dev-mail?limit=50'),
    });

    const clearMutation = useApiMutation<{ deleted: number }>({
        endpoint: '/api/admin/dev-mail',
        method: 'DELETE',
        invalidateKeys: [['admin', 'dev-mail']],
    });

    const deleteMutation = useApiMutation<unknown, string>({
        endpoint: (messageId) => `/api/admin/dev-mail/${messageId}`,
        method: 'DELETE',
        invalidateKeys: [['admin', 'dev-mail']],
    });

    const messages = data?.messages || [];
    const selectedMessage = useMemo(() => {
        if (!messages.length) {
            return null;
        }

        return messages.find((message) => message.id === selectedId) || messages[0];
    }, [messages, selectedId]);

    const selectedLinks = selectedMessage ? extractLinks(selectedMessage) : [];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
                <div className="space-y-2">
                    <Link
                        to="/admin"
                        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to admin
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Dev Mail Trap</h1>
                        <p className="text-muted-foreground mt-2">
                            Captured local emails for magic links, verification, password reset, and queued sends.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={() => clearMutation.mutate({})}
                        disabled={clearMutation.isPending || messages.length === 0}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Clear inbox
                    </Button>
                </div>
            </div>

            {isError && (
                <Alert variant="destructive">
                    <AlertTitle>Dev trap unavailable</AlertTitle>
                    <AlertDescription>
                        {isApiError(error)
                            ? error.message
                            : 'Enable DEV_EMAIL_TRAP_ENABLED and OBCF_KV to capture mail locally.'}
                    </AlertDescription>
                </Alert>
            )}

            {!isError && !isLoading && messages.length === 0 && (
                <Alert>
                    <Inbox className="h-4 w-4" />
                    <AlertTitle>Inbox is empty</AlertTitle>
                    <AlertDescription>
                        Send a magic link or verification email locally and it will appear here instead of going to a
                        real provider.
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid gap-6 xl:grid-cols-[360px,minmax(0,1fr)]">
                <div className="space-y-3">
                    {messages.map((message) => {
                        const isSelected = selectedMessage?.id === message.id;

                        return (
                            <button
                                key={message.id}
                                type="button"
                                onClick={() => setSelectedId(message.id)}
                                className={`w-full text-left rounded-lg border p-4 transition-colors ${
                                    isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 space-y-1">
                                        <p className="font-medium truncate">{message.subject}</p>
                                        <p className="text-sm text-muted-foreground truncate">
                                            To: {message.to.map(formatAddress).join(', ')}
                                        </p>
                                    </div>
                                    <Badge variant="secondary">{message.provider}</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{message.previewText}</p>
                                <p className="text-xs text-muted-foreground mt-3">{formatDate(message.createdAt)}</p>
                            </button>
                        );
                    })}
                </div>

                <Card>
                    {selectedMessage ? (
                        <>
                            <CardHeader>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <CardTitle>{selectedMessage.subject}</CardTitle>
                                        <CardDescription>{formatDate(selectedMessage.createdAt)}</CardDescription>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge>{selectedMessage.provider}</Badge>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => deleteMutation.mutate(selectedMessage.id)}
                                            disabled={deleteMutation.isPending}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className="grid gap-3 md:grid-cols-2">
                                    <MetaBlock label="From" value={formatAddress(selectedMessage.from)} />
                                    <MetaBlock label="To" value={selectedMessage.to.map(formatAddress).join(', ')} />
                                    {selectedMessage.replyTo && (
                                        <MetaBlock label="Reply-To" value={formatAddress(selectedMessage.replyTo)} />
                                    )}
                                    {selectedMessage.cc.length > 0 && (
                                        <MetaBlock
                                            label="Cc"
                                            value={selectedMessage.cc.map(formatAddress).join(', ')}
                                        />
                                    )}
                                </div>

                                {selectedLinks.length > 0 && (
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-medium">Detected links</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedLinks.map((link) => (
                                                <a
                                                    key={link}
                                                    href={link}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted"
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                    Open link
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <Separator />

                                <div className="space-y-2">
                                    <h3 className="text-sm font-medium">Rendered HTML</h3>
                                    <div
                                        className="rounded-lg border bg-background p-4 prose prose-sm max-w-none"
                                        dangerouslySetInnerHTML={{ __html: selectedMessage.html }}
                                    />
                                </div>

                                {selectedMessage.text && (
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-medium">Plain text</h3>
                                        <pre className="rounded-lg border bg-muted/30 p-4 text-sm whitespace-pre-wrap break-words">
                                            {selectedMessage.text}
                                        </pre>
                                    </div>
                                )}
                            </CardContent>
                        </>
                    ) : (
                        <CardContent className="py-12 text-center text-muted-foreground">
                            Select a captured email to inspect it.
                        </CardContent>
                    )}
                </Card>
            </div>
        </div>
    );
}

function MetaBlock({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-sm mt-1 break-words">{value}</p>
        </div>
    );
}
