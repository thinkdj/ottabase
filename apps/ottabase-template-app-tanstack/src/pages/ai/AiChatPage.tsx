/**
 * AI Chat Page — Full-featured chat interface with conversation history.
 *
 * Features:
 * - Conversation sidebar with create/delete/rename
 * - Multi-turn chat with message history
 * - Streaming AI responses via SSE
 * - File attachments for multimodal chats (text/image)
 * - Model & provider selection (switchable in header and settings)
 * - System prompt configuration
 * - Auto-scroll, loading states, markdown support
 * - Dark mode support
 */
import { api, isApiError } from '@/lib/api';
import {
    Badge,
    Button,
    Card,
    CardContent,
    cn,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    ScrollArea,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Separator,
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    Skeleton,
    Textarea,
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@ottabase/ui-shadcn';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
    ArrowLeft,
    Bot,
    ChevronDown,
    Copy,
    ImagePlus,
    Loader2,
    MessageSquarePlus,
    MoreVertical,
    Paperclip,
    PanelLeftClose,
    PanelLeftOpen,
    Send,
    Settings,
    Trash2,
    User,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

// ============================================================
// Types
// ============================================================

interface Conversation {
    id: string;
    title: string;
    model: string;
    provider: string;
    systemPrompt: string | null;
    userId: string;
    createdAt: number;
    updatedAt: number;
}

interface Message {
    id: string;
    conversationId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    model: string | null;
    provider: string | null;
    usage: string | null;
    attachments: string | null;
    createdAt: number;
}

interface Attachment {
    url: string;
    name: string;
    type: string;
    size?: number;
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

// ============================================================
// Constants
// ============================================================

const DEFAULT_PROVIDER = 'workers-ai';
const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct';

// ============================================================
// API Helpers
// ============================================================

async function fetchConversations(): Promise<Conversation[]> {
    const data = (await api('/api/ai/conversations')) as { conversations: Conversation[] };
    return data.conversations;
}

async function fetchConversation(id: string): Promise<{ conversation: Conversation; messages: Message[] }> {
    return api(`/api/ai/conversations/${id}`) as Promise<{ conversation: Conversation; messages: Message[] }>;
}

async function fetchModels(): Promise<ModelsResponse> {
    return api('/api/ai/models') as Promise<ModelsResponse>;
}

// ============================================================
// Message Bubble Component
// ============================================================

function MessageBubble({ message, isLast }: { message: Message; isLast: boolean }) {
    const isUser = message.role === 'user';
    const usage = message.usage ? JSON.parse(message.usage) : null;
    const attachments: Attachment[] = message.attachments ? JSON.parse(message.attachments) : [];

    const handleCopy = () => {
        navigator.clipboard.writeText(message.content);
        toast.success('Copied to clipboard');
    };

    return (
        <div className={cn('group flex gap-3 py-4', isUser ? 'justify-end' : 'justify-start')}>
            {/* Avatar */}
            {!isUser && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-primary" />
                </div>
            )}

            <div className={cn('flex flex-col max-w-[80%] md:max-w-[70%]', isUser && 'items-end')}>
                {/* Attachments */}
                {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                        {attachments.map((att, idx) =>
                            att.type.startsWith('image/') ? (
                                <img
                                    key={idx}
                                    src={att.url}
                                    alt={att.name}
                                    className="max-w-[200px] max-h-[150px] rounded-lg border border-border object-cover"
                                />
                            ) : (
                                <a
                                    key={idx}
                                    href={att.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-muted/50 text-xs hover:bg-muted transition-colors"
                                >
                                    <Paperclip className="w-3 h-3" />
                                    <span className="truncate max-w-[120px]">{att.name}</span>
                                </a>
                            ),
                        )}
                    </div>
                )}

                {/* Message content */}
                <div
                    className={cn(
                        'rounded-2xl px-4 py-3 text-sm leading-relaxed',
                        isUser
                            ? 'bg-primary text-primary-foreground rounded-br-md'
                            : 'bg-muted text-foreground rounded-bl-md',
                    )}
                >
                    {/* Render content as paragraphs, preserving line breaks */}
                    <div className="whitespace-pre-wrap break-words">{message.content}</div>
                </div>

                {/* Metadata row */}
                <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!isUser && message.model && (
                        <span className="text-[10px] text-muted-foreground">{message.model}</span>
                    )}
                    {!isUser && usage && (
                        <span className="text-[10px] text-muted-foreground">
                            {usage.total_tokens || usage.completion_tokens || ''} tokens
                        </span>
                    )}
                    <button
                        onClick={handleCopy}
                        className="p-1 rounded hover:bg-muted transition-colors"
                        title="Copy message"
                    >
                        <Copy className="w-3 h-3 text-muted-foreground" />
                    </button>
                </div>
            </div>

            {/* User avatar */}
            {isUser && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    <User className="w-4 h-4 text-primary-foreground" />
                </div>
            )}
        </div>
    );
}

// ============================================================
// Typing Indicator
// ============================================================

function TypingIndicator() {
    return (
        <div className="flex gap-3 py-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                </div>
            </div>
        </div>
    );
}

// ============================================================
// Empty State
// ============================================================

function EmptyChat({ onExampleClick }: { onExampleClick: (text: string) => void }) {
    const examples = [
        'Explain how Cloudflare Workers work',
        'Write a TypeScript function to sort an array',
        'What are the benefits of edge computing?',
        'Help me debug a React component',
    ];

    return (
        <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <Bot className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Ottabase AI</h2>
            <p className="text-muted-foreground mb-8 max-w-md">
                Powered by Cloudflare Workers AI & AI Gateway. Start a conversation or try one of these examples:
            </p>
            <div className="grid gap-3 w-full max-w-md">
                {examples.map((example) => (
                    <button
                        key={example}
                        onClick={() => onExampleClick(example)}
                        className="text-left p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-sm text-muted-foreground hover:text-foreground"
                    >
                        &ldquo;{example}&rdquo;
                    </button>
                ))}
            </div>
        </div>
    );
}

// ============================================================
// Conversation Sidebar
// ============================================================

function ConversationList({
    conversations,
    activeId,
    onSelect,
    onDelete,
    onNewChat,
    isLoading,
}: {
    conversations: Conversation[];
    activeId: string | null;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    onNewChat: () => void;
    isLoading: boolean;
}) {
    return (
        <div className="flex flex-col h-full">
            {/* New Chat button */}
            <div className="p-3">
                <Button onClick={onNewChat} variant="outline" className="w-full justify-start gap-2" size="sm">
                    <MessageSquarePlus className="w-4 h-4" />
                    New Chat
                </Button>
            </div>

            <Separator />

            {/* Conversation list */}
            <ScrollArea className="flex-1 px-2 py-2">
                {isLoading ? (
                    <div className="space-y-2 px-1">
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-10 w-full rounded-lg" />
                        ))}
                    </div>
                ) : conversations.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No conversations yet</p>
                ) : (
                    <div className="space-y-1">
                        {conversations.map((conv) => (
                            <div
                                key={conv.id}
                                className={cn(
                                    'group flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors',
                                    activeId === conv.id
                                        ? 'bg-primary/10 text-primary font-medium'
                                        : 'hover:bg-muted text-muted-foreground hover:text-foreground',
                                )}
                                onClick={() => onSelect(conv.id)}
                            >
                                <MessageSquarePlus className="w-4 h-4 flex-shrink-0 opacity-50" />
                                <span className="truncate flex-1">{conv.title}</span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(conv.id);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 transition-all"
                                    title="Delete conversation"
                                >
                                    <Trash2 className="w-3 h-3 text-destructive" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </ScrollArea>

            {/* Footer */}
            <Separator />
            <div className="p-3">
                <Link to="/admin/ai" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <Settings className="w-3 h-3 inline mr-1" />
                    AI Settings
                </Link>
            </div>
        </div>
    );
}

// ============================================================
// Settings Panel
// ============================================================

function SettingsPanel({
    provider,
    model,
    systemPrompt,
    models,
    onProviderChange,
    onModelChange,
    onSystemPromptChange,
}: {
    provider: string;
    model: string;
    systemPrompt: string;
    models: ModelsResponse | null;
    onProviderChange: (v: string) => void;
    onModelChange: (v: string) => void;
    onSystemPromptChange: (v: string) => void;
}) {
    const providerModels = models?.models[provider] || [];

    return (
        <div className="space-y-4 p-4">
            <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Provider</label>
                <Select value={provider} onValueChange={onProviderChange}>
                    <SelectTrigger className="w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {models?.providers.map((p) => (
                            <SelectItem key={p.key} value={p.key}>
                                {p.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Model</label>
                <Select value={model} onValueChange={onModelChange}>
                    <SelectTrigger className="w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {providerModels.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                                <span>{m.name}</span>
                                <span className="text-muted-foreground ml-2 text-xs">({m.context})</span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">System Prompt</label>
                <Textarea
                    value={systemPrompt}
                    onChange={(e) => onSystemPromptChange(e.target.value)}
                    placeholder="You are a helpful assistant..."
                    rows={4}
                    className="text-sm resize-none"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                    Instructions that guide the AI&apos;s behavior for this conversation.
                </p>
            </div>
        </div>
    );
}

// ============================================================
// Streaming SSE helper
// ============================================================

/** Parse an SSE stream and call handlers for each event type */
async function readAiStream(
    response: Response,
    onMeta: (data: { conversationId: string; model: string; provider: string }) => void,
    onToken: (token: string) => void,
    onDone: (data: { message: Message; usage?: unknown }) => void,
    onError: (error: string) => void,
) {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (!raw || raw === '[DONE]') continue;
            try {
                const data = JSON.parse(raw);
                switch (data.type) {
                    case 'meta':
                        onMeta(data);
                        break;
                    case 'token':
                        onToken(data.token);
                        break;
                    case 'done':
                        onDone(data);
                        break;
                    case 'error':
                        onError(data.error);
                        break;
                }
            } catch {
                // skip non-JSON lines
            }
        }
    }
}

// ============================================================
// Main AI Chat Page
// ============================================================

export function AiChatPage() {
    const queryClient = useQueryClient();
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [inputValue, setInputValue] = useState('');
    const [provider, setProvider] = useState(DEFAULT_PROVIDER);
    const [model, setModel] = useState(DEFAULT_MODEL);
    const [systemPrompt, setSystemPrompt] = useState('');
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingContent, setStreamingContent] = useState('');
    const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch conversations list
    const conversationsQuery = useQuery({
        queryKey: ['ai-conversations'],
        queryFn: fetchConversations,
    });

    // Fetch models list
    const modelsQuery = useQuery({
        queryKey: ['ai-models'],
        queryFn: fetchModels,
    });

    // Fetch active conversation messages
    const conversationQuery = useQuery({
        queryKey: ['ai-conversation', activeConversationId],
        queryFn: () => fetchConversation(activeConversationId!),
        enabled: !!activeConversationId,
    });

    // Update messages when conversation loads
    useEffect(() => {
        if (conversationQuery.data?.messages) {
            setMessages(conversationQuery.data.messages);
            // Load conversation settings
            const conv = conversationQuery.data.conversation;
            if (conv) {
                setProvider(conv.provider || DEFAULT_PROVIDER);
                setModel(conv.model || DEFAULT_MODEL);
                setSystemPrompt(conv.systemPrompt || '');
            }
        }
    }, [conversationQuery.data]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingContent]);

    // Update model when provider changes
    useEffect(() => {
        if (modelsQuery.data?.models[provider]) {
            const firstModel = modelsQuery.data.models[provider][0];
            if (firstModel) {
                setModel(firstModel.id);
            }
        }
    }, [provider, modelsQuery.data]);

    // Send message with streaming
    const sendMessageMutation = useMutation({
        mutationFn: async (messageText: string) => {
            setIsStreaming(true);
            setStreamingContent('');

            const response = await fetch('/api/ai/chat/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversationId: activeConversationId,
                    message: messageText,
                    model,
                    provider,
                    systemPrompt: systemPrompt || undefined,
                    attachments: pendingAttachments.length > 0 ? pendingAttachments : undefined,
                }),
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: 'Stream request failed' }));
                throw new Error((err as { error?: string }).error || 'Stream request failed');
            }

            let resultConversationId = activeConversationId || '';

            await readAiStream(
                response,
                (meta) => {
                    resultConversationId = meta.conversationId;
                },
                (token) => {
                    setStreamingContent((prev) => prev + token);
                },
                (data) => {
                    // Streaming done — add the saved assistant message
                    setMessages((prev) => [...prev, data.message]);
                    setStreamingContent('');
                    setIsStreaming(false);

                    if (!activeConversationId && resultConversationId) {
                        setActiveConversationId(resultConversationId);
                    }
                    queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
                },
                (error) => {
                    setIsStreaming(false);
                    setStreamingContent('');
                    toast.error(error);
                },
            );

            return { conversationId: resultConversationId };
        },
        onError: (error) => {
            setIsStreaming(false);
            setStreamingContent('');
            toast.error(isApiError(error) ? error.message : 'Failed to send message');
        },
    });

    // Delete conversation mutation
    const deleteConversationMutation = useMutation({
        mutationFn: async (id: string) => {
            return api(`/api/ai/conversations/${id}`, { method: 'DELETE' });
        },
        onSuccess: (_, deletedId) => {
            queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
            if (activeConversationId === deletedId) {
                setActiveConversationId(null);
                setMessages([]);
            }
            toast.success('Conversation deleted');
        },
    });

    const handleSend = useCallback(() => {
        const text = inputValue.trim();
        if (!text || sendMessageMutation.isPending || isStreaming) return;

        // Add user message to local state immediately for responsiveness
        const tempMessage: Message = {
            id: `temp-${Date.now()}`,
            conversationId: activeConversationId || '',
            role: 'user',
            content: text,
            model: null,
            provider: null,
            usage: null,
            attachments: pendingAttachments.length > 0 ? JSON.stringify(pendingAttachments) : null,
            createdAt: Date.now(),
        };
        setMessages((prev) => [...prev, tempMessage]);
        setInputValue('');
        setPendingAttachments([]);

        sendMessageMutation.mutate(text);
    }, [
        inputValue,
        activeConversationId,
        sendMessageMutation.isPending,
        isStreaming,
        model,
        provider,
        systemPrompt,
        pendingAttachments,
    ]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleNewChat = () => {
        setActiveConversationId(null);
        setMessages([]);
        setInputValue('');
        setPendingAttachments([]);
        setStreamingContent('');
        setIsStreaming(false);
        inputRef.current?.focus();
    };

    const handleSelectConversation = (id: string) => {
        setActiveConversationId(id);
    };

    const handleExampleClick = (text: string) => {
        setInputValue(text);
        inputRef.current?.focus();
    };

    /** Handle file selection for attachments */
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        for (const file of Array.from(files)) {
            // Upload file via the existing /api/upload endpoint
            const formData = new FormData();
            formData.append('file', file);

            try {
                const result = await fetch('/api/upload', { method: 'POST', body: formData });
                const data = (await result.json()) as { success: boolean; url?: string; key?: string };
                if (data.success && data.url) {
                    setPendingAttachments((prev) => [
                        ...prev,
                        { url: data.url!, name: file.name, type: file.type, size: file.size },
                    ]);
                } else {
                    toast.error(`Failed to upload ${file.name}`);
                }
            } catch {
                toast.error(`Failed to upload ${file.name}`);
            }
        }

        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeAttachment = (index: number) => {
        setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
    };

    const conversations = conversationsQuery.data || [];

    return (
        <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
            {/* Desktop Sidebar */}
            {sidebarOpen && (
                <div className="hidden md:flex w-64 border-r border-border flex-col bg-card">
                    <ConversationList
                        conversations={conversations}
                        activeId={activeConversationId}
                        onSelect={handleSelectConversation}
                        onDelete={(id) => deleteConversationMutation.mutate(id)}
                        onNewChat={handleNewChat}
                        isLoading={conversationsQuery.isLoading}
                    />
                </div>
            )}

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
                    <div className="flex items-center gap-2">
                        {/* Toggle sidebar (desktop) */}
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setSidebarOpen(!sidebarOpen)}
                                        className="hidden md:flex h-8 w-8"
                                    >
                                        {sidebarOpen ? (
                                            <PanelLeftClose className="w-4 h-4" />
                                        ) : (
                                            <PanelLeftOpen className="w-4 h-4" />
                                        )}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>{sidebarOpen ? 'Close sidebar' : 'Open sidebar'}</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        {/* Mobile sidebar trigger */}
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="md:hidden h-8 w-8">
                                    <PanelLeftOpen className="w-4 h-4" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-72 p-0">
                                <SheetHeader className="sr-only">
                                    <SheetTitle>Conversations</SheetTitle>
                                </SheetHeader>
                                <ConversationList
                                    conversations={conversations}
                                    activeId={activeConversationId}
                                    onSelect={(id) => {
                                        handleSelectConversation(id);
                                    }}
                                    onDelete={(id) => deleteConversationMutation.mutate(id)}
                                    onNewChat={handleNewChat}
                                    isLoading={conversationsQuery.isLoading}
                                />
                            </SheetContent>
                        </Sheet>

                        <h1 className="text-sm font-semibold truncate">
                            {conversationQuery.data?.conversation?.title || 'AI Chat'}
                        </h1>
                    </div>

                    <div className="flex items-center gap-1">
                        {/* Model quick-switcher */}
                        {modelsQuery.data?.models[provider] && (
                            <Select value={model} onValueChange={setModel}>
                                <SelectTrigger className="h-7 w-auto gap-1 border-none bg-transparent text-[11px] text-muted-foreground hover:text-foreground px-2 [&>svg]:w-3 [&>svg]:h-3">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {modelsQuery.data.models[provider]?.map((m) => (
                                        <SelectItem key={m.id} value={m.id} className="text-xs">
                                            {m.name}
                                            <span className="text-muted-foreground ml-1">({m.context})</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}

                        {/* Provider/model badge */}
                        <Badge variant="secondary" className="text-[10px] hidden sm:flex">
                            {provider === 'workers-ai' ? 'Workers AI' : provider}
                        </Badge>

                        {/* Settings dropdown */}
                        <DropdownMenu open={settingsOpen} onOpenChange={setSettingsOpen}>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <Settings className="w-4 h-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-72 p-0">
                                <SettingsPanel
                                    provider={provider}
                                    model={model}
                                    systemPrompt={systemPrompt}
                                    models={modelsQuery.data || null}
                                    onProviderChange={setProvider}
                                    onModelChange={setModel}
                                    onSystemPromptChange={setSystemPrompt}
                                />
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNewChat}>
                            <MessageSquarePlus className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* Messages Area */}
                <ScrollArea className="flex-1 px-4">
                    {messages.length === 0 && !conversationQuery.isLoading ? (
                        <EmptyChat onExampleClick={handleExampleClick} />
                    ) : conversationQuery.isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="max-w-3xl mx-auto py-4">
                            {messages.map((msg, idx) => (
                                <MessageBubble key={msg.id} message={msg} isLast={idx === messages.length - 1} />
                            ))}
                            {/* Streaming response in progress */}
                            {isStreaming && streamingContent && (
                                <div className="flex gap-3 py-4">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Bot className="w-4 h-4 text-primary" />
                                    </div>
                                    <div className="flex flex-col max-w-[80%] md:max-w-[70%]">
                                        <div className="bg-muted text-foreground rounded-2xl rounded-bl-md px-4 py-3 text-sm leading-relaxed">
                                            <div className="whitespace-pre-wrap break-words">{streamingContent}</div>
                                            <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5" />
                                        </div>
                                    </div>
                                </div>
                            )}
                            {/* Typing indicator before first token arrives */}
                            {(sendMessageMutation.isPending || isStreaming) && !streamingContent && <TypingIndicator />}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </ScrollArea>

                {/* Input Area */}
                <div className="border-t border-border bg-card p-4">
                    <div className="max-w-3xl mx-auto">
                        {/* Pending attachment previews */}
                        {pendingAttachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                                {pendingAttachments.map((att, idx) => (
                                    <div
                                        key={idx}
                                        className="relative group/att flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border bg-muted/50 text-xs"
                                    >
                                        {att.type.startsWith('image/') ? (
                                            <ImagePlus className="w-3 h-3 text-muted-foreground" />
                                        ) : (
                                            <Paperclip className="w-3 h-3 text-muted-foreground" />
                                        )}
                                        <span className="truncate max-w-[100px]">{att.name}</span>
                                        <button
                                            onClick={() => removeAttachment(idx)}
                                            className="p-0.5 rounded-full hover:bg-destructive/10"
                                        >
                                            <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="relative flex items-end gap-2">
                            {/* Hidden file input */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                className="hidden"
                                multiple
                                accept="image/*,text/*,.pdf,.doc,.docx,.csv,.json,.md"
                                onChange={handleFileSelect}
                            />

                            {/* Attachment button */}
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 flex-shrink-0"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={sendMessageMutation.isPending || isStreaming}
                                        >
                                            <Paperclip className="w-4 h-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Attach file</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            <Textarea
                                ref={inputRef}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                                rows={1}
                                className="min-h-[44px] max-h-[200px] resize-none pr-12 text-sm"
                                disabled={sendMessageMutation.isPending || isStreaming}
                            />
                            <Button
                                onClick={handleSend}
                                disabled={!inputValue.trim() || sendMessageMutation.isPending || isStreaming}
                                size="icon"
                                className="absolute right-2 bottom-2 h-8 w-8 rounded-full"
                            >
                                {sendMessageMutation.isPending || isStreaming ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Send className="w-4 h-4" />
                                )}
                            </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                            AI can make mistakes. Powered by{' '}
                            <a
                                href="https://developers.cloudflare.com/workers-ai/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline"
                            >
                                Cloudflare AI
                            </a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
