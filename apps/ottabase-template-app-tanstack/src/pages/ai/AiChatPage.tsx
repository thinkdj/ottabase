/**
 * AI Chat Page — Full-featured chat interface with conversation history.
 *
 * Features:
 * - Conversation sidebar with create/delete/rename
 * - Multi-turn chat with message history
 * - Model & provider selection
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
    Loader2,
    MessageSquarePlus,
    MoreVertical,
    PanelLeftClose,
    PanelLeftOpen,
    Send,
    Settings,
    Trash2,
    User,
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
    createdAt: number;
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
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

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
    }, [messages]);

    // Update model when provider changes
    useEffect(() => {
        if (modelsQuery.data?.models[provider]) {
            const firstModel = modelsQuery.data.models[provider][0];
            if (firstModel) {
                setModel(firstModel.id);
            }
        }
    }, [provider, modelsQuery.data]);

    // Send message mutation
    const sendMessageMutation = useMutation({
        mutationFn: async (messageText: string) => {
            const result = await api('/api/ai/chat', {
                method: 'POST',
                body: JSON.stringify({
                    conversationId: activeConversationId,
                    message: messageText,
                    model,
                    provider,
                    systemPrompt: systemPrompt || undefined,
                }),
            });
            return result as { conversationId: string; message: Message; provider: string; model: string };
        },
        onSuccess: (data) => {
            // Add assistant message to local state
            setMessages((prev) => [...prev, data.message]);
            // Set conversation ID if new
            if (!activeConversationId && data.conversationId) {
                setActiveConversationId(data.conversationId);
            }
            // Refresh conversations list (for title updates)
            queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
        },
        onError: (error) => {
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
        if (!text || sendMessageMutation.isPending) return;

        // Add user message to local state immediately for responsiveness
        const tempMessage: Message = {
            id: `temp-${Date.now()}`,
            conversationId: activeConversationId || '',
            role: 'user',
            content: text,
            model: null,
            provider: null,
            usage: null,
            createdAt: Date.now(),
        };
        setMessages((prev) => [...prev, tempMessage]);
        setInputValue('');

        sendMessageMutation.mutate(text);
    }, [inputValue, activeConversationId, sendMessageMutation.isPending, model, provider, systemPrompt]);

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
        inputRef.current?.focus();
    };

    const handleSelectConversation = (id: string) => {
        setActiveConversationId(id);
    };

    const handleExampleClick = (text: string) => {
        setInputValue(text);
        inputRef.current?.focus();
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
                            {sendMessageMutation.isPending && <TypingIndicator />}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </ScrollArea>

                {/* Input Area */}
                <div className="border-t border-border bg-card p-4">
                    <div className="max-w-3xl mx-auto">
                        <div className="relative flex items-end gap-2">
                            <Textarea
                                ref={inputRef}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                                rows={1}
                                className="min-h-[44px] max-h-[200px] resize-none pr-12 text-sm"
                                disabled={sendMessageMutation.isPending}
                            />
                            <Button
                                onClick={handleSend}
                                disabled={!inputValue.trim() || sendMessageMutation.isPending}
                                size="icon"
                                className="absolute right-2 bottom-2 h-8 w-8 rounded-full"
                            >
                                {sendMessageMutation.isPending ? (
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
