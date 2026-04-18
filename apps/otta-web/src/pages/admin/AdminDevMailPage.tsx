import { api, isApiError } from '@/lib/api';
import { useApiMutation } from '@ottabase/ottaorm/client';
import { ConfirmDialog } from '@ottabase/ui-components';
import {
    Alert,
    AlertDescription,
    AlertTitle,
    Badge,
    Button,
    ScrollArea,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@ottabase/ui-shadcn';
import { stripHtml } from '@ottabase/utils/string';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, ExternalLink, Inbox, RefreshCw, Trash2, X } from 'lucide-react';
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
    const [toFilter, setToFilter] = useState<string>('');

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
        onSuccess: () => setSelectedId(null),
    });

    const messages = data?.messages || [];

    // Collect unique "to" addresses from all messages for the filter dropdown
    const uniqueToAddresses = useMemo(() => {
        const seen = new Set<string>();
        for (const msg of messages) {
            for (const addr of msg.to) {
                seen.add(addr.email.toLowerCase());
            }
        }
        return Array.from(seen).sort();
    }, [messages]);

    // Apply local filter by "to" email
    const filteredMessages = useMemo(() => {
        if (!toFilter) return messages;
        return messages.filter((m) => m.to.some((addr) => addr.email.toLowerCase() === toFilter));
    }, [messages, toFilter]);

    const selectedMessage = useMemo(() => {
        if (!filteredMessages.length) return null;
        return filteredMessages.find((m) => m.id === selectedId) || filteredMessages[0];
    }, [filteredMessages, selectedId]);

    const selectedLinks = selectedMessage ? extractLinks(selectedMessage) : [];

    return (
        <div className="space-y-4">
            {/* Page header */}
            <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                    <Link
                        to="/admin"
                        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to admin
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Dev Mail Trap</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Captured local emails for magic links, verification, password reset, and queued sends.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
                        <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
                    </Button>
                    {/* Clear all with confirmation */}
                    <ConfirmDialog
                        trigger={
                            <Button
                                variant="destructive"
                                size="sm"
                                disabled={clearMutation.isPending || messages.length === 0}
                            >
                                <Trash2 className="h-4 w-4 mr-1.5" /> Clear inbox
                            </Button>
                        }
                        title="Clear all emails?"
                        description={`This will permanently delete all ${messages.length} captured email${messages.length !== 1 ? 's' : ''} from the dev trap. This action cannot be undone.`}
                        tone="destructive"
                        secondaryActionText="Cancel"
                        primaryActionText="Clear inbox"
                        onConfirm={() => clearMutation.mutate({})}
                    />
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

            {/* Mailbox layout — fixed height, two-pane like an email client */}
            <div className="flex h-[calc(100vh-13rem)] rounded-lg border overflow-hidden">
                {/* Left: inbox list */}
                <div className="w-72 shrink-0 border-r flex flex-col bg-muted/20 overflow-x-hidden">
                    <div className="px-3 py-2 border-b space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Inbox
                            {filteredMessages.length > 0 && (
                                <span className="ml-2 text-foreground">{filteredMessages.length}</span>
                            )}
                        </p>
                        {/* Filter by To address */}
                        {uniqueToAddresses.length > 1 && (
                            <div className="flex items-center gap-1">
                                <select
                                    aria-label="Filter by recipient"
                                    value={toFilter}
                                    onChange={(e) => {
                                        setToFilter(e.target.value);
                                        setSelectedId(null);
                                    }}
                                    className="flex-1 min-w-0 text-xs rounded-md border bg-background px-2 py-1 text-muted-foreground cursor-pointer hover:border-foreground/40 transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
                                >
                                    <option value="">All recipients</option>
                                    {uniqueToAddresses.map((addr) => (
                                        <option key={addr} value={addr}>
                                            {addr}
                                        </option>
                                    ))}
                                </select>
                                {/* Clear button — only shown when a filter is active */}
                                {toFilter && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setToFilter('');
                                            setSelectedId(null);
                                        }}
                                        className="shrink-0 text-muted-foreground hover:text-foreground"
                                        aria-label="Clear filter"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    <ScrollArea className="flex-1">
                        {/* overflow-x-hidden forces the scrollarea viewport to clip width so truncate works */}
                        <div className="overflow-x-hidden w-72">
                            {!isError && !isLoading && messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center gap-2 py-12 px-4 text-center text-muted-foreground">
                                    <Inbox className="h-8 w-8 opacity-40" />
                                    <p className="text-sm">No emails captured yet.</p>
                                </div>
                            ) : filteredMessages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center gap-2 py-12 px-4 text-center text-muted-foreground">
                                    <Inbox className="h-8 w-8 opacity-40" />
                                    <p className="text-sm">No emails for this recipient.</p>
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {filteredMessages.map((message) => {
                                        const isSelected = selectedMessage?.id === message.id;
                                        return (
                                            <button
                                                key={message.id}
                                                type="button"
                                                onClick={() => setSelectedId(message.id)}
                                                className={`w-full min-w-0 text-left px-4 py-3 transition-colors overflow-hidden ${
                                                    isSelected
                                                        ? 'bg-primary/10 border-l-2 border-l-primary'
                                                        : 'hover:bg-muted/60 border-l-2 border-l-transparent'
                                                }`}
                                            >
                                                {/* Subject + provider badge */}
                                                <div className="flex items-center justify-between gap-2 mb-0.5 min-w-0">
                                                    <p className="text-sm font-medium truncate flex-1 min-w-0">
                                                        {message.subject}
                                                    </p>
                                                    <Badge variant="secondary" className="text-[10px] shrink-0">
                                                        {message.provider}
                                                    </Badge>
                                                </div>
                                                {/* Recipient */}
                                                <p className="text-xs text-muted-foreground truncate mb-1">
                                                    {message.to.map(formatAddress).join(', ')}
                                                </p>
                                                {/* One-line preview — strip HTML tags for clean text */}
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {stripHtml(message.previewText)}
                                                </p>
                                                {/* Date */}
                                                <p className="text-[11px] text-muted-foreground/70 mt-1.5">
                                                    {formatDate(message.createdAt)}
                                                </p>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>

                {/* Right: email detail */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {selectedMessage ? (
                        <>
                            {/* Email header */}
                            <div className="px-6 py-4 border-b shrink-0">
                                <div className="flex items-start justify-between gap-4 mb-3">
                                    <h2 className="text-lg font-semibold leading-tight flex-1">
                                        {selectedMessage.subject}
                                    </h2>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Badge variant="outline">{selectedMessage.provider}</Badge>
                                        {/* Delete single email with confirmation */}
                                        <ConfirmDialog
                                            trigger={
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                    disabled={deleteMutation.isPending}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            }
                                            title="Delete this email?"
                                            description={`"${selectedMessage.subject}" will be permanently removed from the dev trap.`}
                                            tone="destructive"
                                            secondaryActionText="Cancel"
                                            primaryActionText="Delete"
                                            onConfirm={() => deleteMutation.mutate(selectedMessage.id)}
                                        />
                                    </div>
                                </div>

                                {/* From / To / CC as email-style headers — not blocks */}
                                <div className="text-sm space-y-0.5">
                                    <MetaRow label="From" value={formatAddress(selectedMessage.from)} />
                                    <MetaRow label="To" value={selectedMessage.to.map(formatAddress).join(', ')} />
                                    {selectedMessage.replyTo && (
                                        <MetaRow label="Reply-To" value={formatAddress(selectedMessage.replyTo)} />
                                    )}
                                    {selectedMessage.cc.length > 0 && (
                                        <MetaRow label="Cc" value={selectedMessage.cc.map(formatAddress).join(', ')} />
                                    )}
                                    <MetaRow label="Date" value={formatDate(selectedMessage.createdAt)} />
                                </div>

                                {/* Detected action links */}
                                {selectedLinks.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        {selectedLinks.map((link) => (
                                            <a
                                                key={link}
                                                href={link}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs hover:bg-muted transition-colors"
                                            >
                                                <ExternalLink className="h-3 w-3" />
                                                Open link
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Body — tabs for rendered HTML vs plain text */}
                            <div className="flex-1 overflow-hidden flex flex-col">
                                <Tabs defaultValue="html" className="flex flex-col flex-1 overflow-hidden">
                                    <div className="px-6 pt-3 border-b shrink-0">
                                        <TabsList className="h-8">
                                            <TabsTrigger value="html" className="text-xs">
                                                Rendered HTML
                                            </TabsTrigger>
                                            <TabsTrigger value="plain" className="text-xs">
                                                Plain Text
                                            </TabsTrigger>
                                            <TabsTrigger value="raw" className="text-xs">
                                                Raw
                                            </TabsTrigger>
                                        </TabsList>
                                    </div>
                                    <ScrollArea className="flex-1">
                                        <TabsContent value="html" className="m-0 p-6">
                                            <div
                                                className="prose prose-sm max-w-none dark:prose-invert"
                                                dangerouslySetInnerHTML={{ __html: selectedMessage.html }}
                                            />
                                        </TabsContent>
                                        <TabsContent value="plain" className="m-0 p-6">
                                            <pre className="rounded-lg border bg-muted/30 p-4 text-sm whitespace-pre-wrap break-words font-mono">
                                                {stripHtml(selectedMessage.html)}
                                            </pre>
                                        </TabsContent>
                                        <TabsContent value="raw" className="m-0 p-6">
                                            {selectedMessage.text ? (
                                                <pre className="rounded-lg border bg-muted/30 p-4 text-sm whitespace-pre-wrap break-words font-mono">
                                                    {selectedMessage.text}
                                                </pre>
                                            ) : (
                                                <p className="text-sm text-muted-foreground">
                                                    No raw plain text version available.
                                                </p>
                                            )}
                                        </TabsContent>
                                    </ScrollArea>
                                </Tabs>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center flex-1 gap-2 text-muted-foreground">
                            <Inbox className="h-10 w-10 opacity-30" />
                            <p className="text-sm">
                                {messages.length === 0
                                    ? 'Send a local email and it will appear here.'
                                    : 'Select an email to read it.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/** Compact key-value row for email metadata (From, To, Date, etc.) */
function MetaRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex gap-2">
            <span className="text-muted-foreground w-16 shrink-0">{label}</span>
            <span className="text-foreground break-all">{value}</span>
        </div>
    );
}
