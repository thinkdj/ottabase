import { api, isApiError } from '@/lib/api';
import { useApiMutation } from '@ottabase/ottaorm/client';
import { ConfirmDialog } from '@ottabase/ui-components';
import {
    Badge,
    Button,
    NativeSelect,
    NativeSelectOption,
    ScrollArea,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@ottabase/ui-shadcn';
import { sanitizeBlockHtml } from '@ottabase/utils/sanitize';
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

const PROVIDER_CHIP =
    'rounded-full border-transparent bg-background text-[0.6875rem] font-medium text-muted-foreground ring-1 ring-border';

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
    const sanitizedSelectedHtml = selectedMessage ? sanitizeBlockHtml(selectedMessage.html) : '';

    return (
        <div className="space-y-8">
            {/* Page header */}
            <div className="space-y-4">
                <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit gap-1.5 text-muted-foreground">
                    <Link to="/admin">
                        <ArrowLeft className="h-4 w-4" />
                        Back to admin
                    </Link>
                </Button>

                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1.5">
                        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Dev Mail Trap</h1>
                        <p className="max-w-3xl text-muted-foreground">
                            Captured local emails for magic links, verification, password reset, and queued sends.
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-muted-foreground"
                            onClick={() => refetch()}
                            disabled={isLoading}
                        >
                            <RefreshCw className="h-4 w-4" /> Refresh
                        </Button>
                        {/* Clear all with confirmation */}
                        <ConfirmDialog
                            trigger={
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="gap-1.5"
                                    disabled={clearMutation.isPending || messages.length === 0}
                                >
                                    <Trash2 className="h-4 w-4" /> Clear inbox
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
            </div>

            {isError && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    <p className="font-semibold">Dev trap unavailable</p>
                    <p>
                        {isApiError(error)
                            ? error.message
                            : 'Enable DEV_EMAIL_TRAP_ENABLED and OBCF_KV to capture mail locally.'}
                    </p>
                </div>
            )}

            {/* Mailbox layout — fixed height, two-pane like an email client */}
            <div className="flex h-[calc(100vh-13rem)] overflow-hidden rounded-xl border border-border/60">
                {/* Left: inbox list */}
                <div className="flex w-72 shrink-0 flex-col overflow-x-hidden border-r border-border/60 bg-muted/40">
                    <div className="space-y-2 border-b border-border/60 px-3 py-2">
                        <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            Inbox
                            {filteredMessages.length > 0 && (
                                <span className="ml-2 text-foreground">{filteredMessages.length}</span>
                            )}
                        </p>
                        {/* Filter by To address */}
                        {uniqueToAddresses.length > 1 && (
                            <div className="flex items-center gap-1">
                                <NativeSelect
                                    aria-label="Filter by recipient"
                                    value={toFilter}
                                    onChange={(e) => {
                                        setToFilter(e.target.value);
                                        setSelectedId(null);
                                    }}
                                    size="sm"
                                    wrapperClassName="flex-1 min-w-0"
                                    className="text-xs text-muted-foreground"
                                >
                                    <NativeSelectOption value="">All recipients</NativeSelectOption>
                                    {uniqueToAddresses.map((addr) => (
                                        <NativeSelectOption key={addr} value={addr}>
                                            {addr}
                                        </NativeSelectOption>
                                    ))}
                                </NativeSelect>
                                {/* Clear button — only shown when a filter is active */}
                                {toFilter && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setToFilter('');
                                            setSelectedId(null);
                                        }}
                                        className="shrink-0 text-muted-foreground transition-colors duration-normal hover:text-foreground"
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
                        <div className="w-72 overflow-x-hidden">
                            {isLoading ? (
                                <div className="space-y-2 p-3" aria-busy="true">
                                    <span className="sr-only">Loading emails…</span>
                                    {Array.from({ length: 4 }, (_, index) => (
                                        <div key={index} className="h-20 animate-pulse rounded-lg bg-background/60" />
                                    ))}
                                </div>
                            ) : !isError && messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center text-muted-foreground">
                                    <Inbox className="h-8 w-8 opacity-40" />
                                    <p className="text-sm">No emails captured yet.</p>
                                </div>
                            ) : filteredMessages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center text-muted-foreground">
                                    <Inbox className="h-8 w-8 opacity-40" />
                                    <p className="text-sm">No emails for this recipient.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border/60">
                                    {filteredMessages.map((message) => {
                                        const isSelected = selectedMessage?.id === message.id;
                                        return (
                                            <button
                                                key={message.id}
                                                type="button"
                                                onClick={() => setSelectedId(message.id)}
                                                className={`w-full min-w-0 overflow-hidden px-4 py-3 text-left outline-none transition-colors duration-normal focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                                                    isSelected ? 'bg-background' : 'hover:bg-muted/70'
                                                }`}
                                            >
                                                {/* Subject + provider badge */}
                                                <div className="mb-0.5 flex min-w-0 items-center justify-between gap-2">
                                                    <p className="min-w-0 flex-1 truncate text-sm font-medium">
                                                        {message.subject}
                                                    </p>
                                                    <Badge variant="secondary" className={`shrink-0 ${PROVIDER_CHIP}`}>
                                                        {message.provider}
                                                    </Badge>
                                                </div>
                                                {/* Recipient */}
                                                <p className="mb-1 truncate text-xs text-muted-foreground">
                                                    {message.to.map(formatAddress).join(', ')}
                                                </p>
                                                {/* One-line preview — strip HTML tags for clean text */}
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {stripHtml(message.previewText)}
                                                </p>
                                                {/* Date */}
                                                <p className="mt-1.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
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
                <div className="flex flex-1 flex-col overflow-hidden">
                    {selectedMessage ? (
                        <>
                            {/* Email header */}
                            <div className="shrink-0 border-b border-border/60 px-6 py-4">
                                <div className="mb-3 flex items-start justify-between gap-4">
                                    <h2 className="flex-1 text-lg font-semibold leading-tight tracking-tight">
                                        {selectedMessage.subject}
                                    </h2>
                                    <div className="flex shrink-0 items-center gap-2">
                                        <Badge variant="outline" className={PROVIDER_CHIP}>
                                            {selectedMessage.provider}
                                        </Badge>
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
                                <div className="space-y-0.5 text-sm">
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
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {selectedLinks.map((link) => (
                                            <a
                                                key={link}
                                                href={link}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1.5 rounded-full bg-background px-2.5 py-1 text-xs text-muted-foreground ring-1 ring-border transition-colors duration-normal hover:bg-muted/40 hover:text-foreground"
                                            >
                                                <ExternalLink className="h-3 w-3" />
                                                Open link
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Body — tabs for rendered HTML vs plain text */}
                            <div className="flex flex-1 flex-col overflow-hidden">
                                <Tabs defaultValue="html" className="flex flex-1 flex-col overflow-hidden">
                                    <div className="shrink-0 border-b border-border/60 px-6 pt-3">
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
                                                dangerouslySetInnerHTML={{ __html: sanitizedSelectedHtml }}
                                            />
                                        </TabsContent>
                                        <TabsContent value="plain" className="m-0 p-6">
                                            <pre className="whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-4 font-mono text-xs">
                                                {stripHtml(selectedMessage.html)}
                                            </pre>
                                        </TabsContent>
                                        <TabsContent value="raw" className="m-0 p-6">
                                            {selectedMessage.text ? (
                                                <pre className="whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-4 font-mono text-xs">
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
                        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
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
            <span className="w-16 shrink-0 pt-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                {label}
            </span>
            <span className="break-all text-foreground">{value}</span>
        </div>
    );
}
