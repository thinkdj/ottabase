/**
 * Demo page for the @ottabase/comments package.
 * Showcases threaded comments, reactions, moderation, and the Model API.
 * Supports in-memory (default) and database-backed modes via a toggle.
 */
import { DEFAULT_REACTIONS } from '@ottabase/comments';
import { Badge, Button, Card, CardContent, Skeleton, Textarea, toast } from '@ottabase/ui-shadcn';
import { Alert, AlertDescription } from '@ottabase/ui-shadcn/alert';
import {
    IconDatabase,
    IconFlag,
    IconLoader2,
    IconMessageCircle,
    IconMessageReply,
    IconRefresh,
    IconShieldCheck,
    IconTrash,
} from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';

import {
    useComments,
    useCreateComment,
    useUpdateComment,
    type CommentType,
    type CommentUser,
} from '@/hooks/commentHooks';
import { useSession } from '@/lib/auth';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEMO_TARGET_TYPE = 'demo';
const DEMO_TARGET_ID = 'comments-demo-page';
const REACTIONS = DEFAULT_REACTIONS.slice(0, 4); // 👍 👎 ❤️ 😂

/** Max root-level comments shown before "load more" */
const ROOT_PAGE_SIZE = 5;
/** Max nested replies shown per parent before "show more" */
const REPLY_PAGE_SIZE = 3;

// ---------------------------------------------------------------------------
// Mock data for in-memory demo
// ---------------------------------------------------------------------------

const MOCK_USERS: Record<string, CommentUser> = {
    'user-alice': { id: 'user-alice', name: 'Alice Martin', image: null, createdAt: Date.now() - 86400000 * 120 },
    'user-bob': { id: 'user-bob', name: 'Bob Chen', image: null, createdAt: Date.now() - 86400000 * 60 },
    'user-carol': { id: 'user-carol', name: 'Carol Diaz', image: null, createdAt: Date.now() - 86400000 * 30 },
    'user-dave': { id: 'user-dave', name: 'Dave Kim', image: null, createdAt: Date.now() - 86400000 * 10 },
};

function makeMock(id: string, body: string, userId: string, opts: Partial<CommentType> = {}): CommentType {
    return {
        id,
        body,
        targetType: DEMO_TARGET_TYPE,
        targetId: DEMO_TARGET_ID,
        parentId: null,
        userId,
        status: 'active',
        reactions: {},
        depth: 0,
        appId: null,
        organizationId: null,
        createdAt: Date.now() - Math.random() * 600000,
        updatedAt: Date.now(),
        _user: MOCK_USERS[userId] ?? null,
        ...opts,
    };
}

function createInitialMockComments(): CommentType[] {
    return [
        makeMock('m1', 'Great article! Polymorphic targeting is exactly what I needed.', 'user-alice', {
            createdAt: Date.now() - 300000,
            reactions: { '👍': ['user-bob', 'user-carol'], '❤️': ['user-dave'] },
        }),
        makeMock('m2', 'How does this compare to a separate table per target type?', 'user-bob', {
            createdAt: Date.now() - 240000,
        }),
        makeMock('m3', 'It saves a lot of schema boilerplate — one table covers all target types.', 'user-alice', {
            parentId: 'm2',
            depth: 1,
            createdAt: Date.now() - 180000,
        }),
        makeMock('m4', 'Agreed! And you get cross-entity queries for free.', 'user-carol', {
            parentId: 'm2',
            depth: 1,
            createdAt: Date.now() - 150000,
            reactions: { '👍': ['user-alice'] },
        }),
        makeMock('m5', 'The trade-off is you lose strict FK constraints though.', 'user-dave', {
            parentId: 'm2',
            depth: 1,
            createdAt: Date.now() - 120000,
        }),
        makeMock('m6', 'True, but the flexibility is worth it in most cases.', 'user-bob', {
            parentId: 'm5',
            depth: 2,
            createdAt: Date.now() - 90000,
        }),
        makeMock('m7', 'The reaction system with per-user tracking is clever. 🎉', 'user-carol', {
            createdAt: Date.now() - 60000,
            reactions: { '😂': ['user-alice', 'user-bob'] },
        }),
        makeMock('m8', 'Would love to see pagination support for deeply nested threads.', 'user-dave', {
            createdAt: Date.now() - 30000,
        }),
        makeMock('m9', '[deleted]', 'user-alice', {
            createdAt: Date.now() - 20000,
            status: 'deleted',
            reactions: {},
        }),
        makeMock('m10', 'This comment was flagged for review.', 'user-bob', {
            createdAt: Date.now() - 10000,
            status: 'flagged',
        }),
    ];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string) {
    return name
        .split(' ')
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

function formatRelative(ts: number) {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
}

function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const AVATAR_COLORS = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'];

function avatarColor(seed: string | null | undefined) {
    if (!seed) return AVATAR_COLORS[0];
    const idx = seed.charCodeAt(seed.length - 1) % AVATAR_COLORS.length;
    return AVATAR_COLORS[idx];
}

function statusBadge(status: string) {
    if (status === 'active') return null;
    const variantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
        flagged: 'outline',
        hidden: 'secondary',
        deleted: 'destructive',
    };
    return (
        <Badge variant={variantMap[status] ?? 'outline'} className="ml-2 text-[10px]">
            {status}
        </Badge>
    );
}

// ---------------------------------------------------------------------------
// UserAvatar — shows image or initials with "member since" tooltip
// ---------------------------------------------------------------------------

function UserAvatar({ user, userId }: { user?: CommentUser | null; userId?: string | null }) {
    const displayName = user?.name ?? userId ?? 'Anonymous';
    const initials = getInitials(displayName);
    const title = user?.createdAt ? `${displayName} · Member since ${formatDate(user.createdAt)}` : displayName;

    if (user?.image) {
        return (
            <img
                src={user.image}
                alt={displayName}
                title={title}
                className="h-7 w-7 shrink-0 rounded-full object-cover"
            />
        );
    }

    return (
        <div
            title={title}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(user?.id ?? userId)}`}
        >
            {initials}
        </div>
    );
}

// ---------------------------------------------------------------------------
// CommentNode — single comment with nested replies + load-more for children
// ---------------------------------------------------------------------------

interface CommentNodeProps {
    comment: CommentType;
    allComments: CommentType[];
    currentUserId: string | null;
    /** Show user name/avatar from `_user` enrichment (default true) */
    fetchUser?: boolean;
    onReact: (id: string, emoji: string) => void;
    onReply: (parentId: string) => void;
    onModerate: (id: string, action: 'flag' | 'hide' | 'delete') => void;
    replyingTo: string | null;
    replyText: string;
    onReplyTextChange: (v: string) => void;
    onSubmitReply: () => void;
    isSubmittingReply: boolean;
}

function CommentNode({
    comment,
    allComments,
    currentUserId,
    fetchUser = true,
    onReact,
    onReply,
    onModerate,
    replyingTo,
    replyText,
    onReplyTextChange,
    onSubmitReply,
    isSubmittingReply,
}: CommentNodeProps) {
    const [showAllReplies, setShowAllReplies] = useState(false);

    const children = allComments.filter((c) => c.parentId === comment.id);
    const visibleChildren = showAllReplies ? children : children.slice(0, REPLY_PAGE_SIZE);
    const hiddenCount = children.length - REPLY_PAGE_SIZE;

    const isDeleted = comment.status === 'deleted';
    const reactions = (comment.reactions ?? {}) as Record<string, string[]>;
    const depth = comment.depth ?? 0;

    const user = fetchUser ? comment._user : undefined;
    const displayName = user?.name ?? comment.userId ?? 'Anonymous';

    return (
        <div className={depth > 0 ? 'ml-8 border-l-2 border-border pl-4' : ''}>
            <div className="py-3">
                {/* Header */}
                <div className="flex items-center gap-2 mb-1">
                    <UserAvatar user={fetchUser ? comment._user : undefined} userId={comment.userId} />
                    <span className="text-sm font-semibold text-foreground">{displayName}</span>
                    {statusBadge(comment.status)}
                    <span className="text-xs text-muted-foreground ml-auto">{formatRelative(comment.createdAt)}</span>
                </div>

                {/* Body */}
                <p className={`text-sm ml-9 ${isDeleted ? 'italic text-muted-foreground' : 'text-foreground'}`}>
                    {comment.body}
                </p>

                {/* Actions */}
                {!isDeleted && (
                    <div className="ml-9 mt-2 flex flex-wrap items-center gap-1">
                        {REACTIONS.map((emoji) => {
                            const users = reactions[emoji] ?? [];
                            const active = currentUserId ? users.includes(currentUserId) : false;
                            return (
                                <button
                                    key={emoji}
                                    onClick={() => onReact(comment.id, emoji)}
                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                                        active
                                            ? 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
                                            : 'border-border bg-background text-muted-foreground hover:border-blue-300 hover:text-foreground'
                                    }`}
                                >
                                    {emoji}
                                    {users.length > 0 && <span>{users.length}</span>}
                                </button>
                            );
                        })}

                        {depth < 3 && (
                            <button
                                onClick={() => onReply(comment.id)}
                                className="ml-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <IconMessageReply size={13} />
                                Reply
                            </button>
                        )}

                        {comment.status === 'active' && (
                            <button
                                onClick={() => onModerate(comment.id, 'flag')}
                                className="ml-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-yellow-600 transition-colors"
                                title="Flag comment"
                                aria-label="Flag comment"
                            >
                                <IconFlag size={13} />
                            </button>
                        )}
                        {comment.status === 'flagged' && (
                            <button
                                onClick={() => onModerate(comment.id, 'hide')}
                                className="ml-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-gray-600 transition-colors"
                                title="Hide comment"
                                aria-label="Hide comment"
                            >
                                <IconShieldCheck size={13} />
                                Hide
                            </button>
                        )}
                        <button
                            onClick={() => onModerate(comment.id, 'delete')}
                            className="ml-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors"
                            title="Soft-delete comment"
                            aria-label="Soft-delete comment"
                        >
                            <IconTrash size={13} />
                        </button>
                    </div>
                )}

                {/* Inline reply form */}
                {replyingTo === comment.id && (
                    <div className="ml-9 mt-3 flex flex-col gap-2">
                        <Textarea
                            placeholder={`Reply to ${displayName}…`}
                            value={replyText}
                            onChange={(e) => onReplyTextChange(e.target.value)}
                            className="min-h-[60px] text-sm"
                        />
                        <div className="flex gap-2">
                            <Button size="sm" onClick={onSubmitReply} disabled={!replyText.trim() || isSubmittingReply}>
                                {isSubmittingReply && <IconLoader2 size={14} className="mr-1 animate-spin" />}
                                Post reply
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => onReply('')}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Nested children with load-more */}
            {visibleChildren.map((child) => (
                <CommentNode
                    key={child.id}
                    comment={child}
                    allComments={allComments}
                    currentUserId={currentUserId}
                    fetchUser={fetchUser}
                    onReact={onReact}
                    onReply={onReply}
                    onModerate={onModerate}
                    replyingTo={replyingTo}
                    replyText={replyText}
                    onReplyTextChange={onReplyTextChange}
                    onSubmitReply={onSubmitReply}
                    isSubmittingReply={isSubmittingReply}
                />
            ))}

            {!showAllReplies && hiddenCount > 0 && (
                <button
                    onClick={() => setShowAllReplies(true)}
                    className="ml-8 py-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                >
                    Show {hiddenCount} more {hiddenCount === 1 ? 'reply' : 'replies'}…
                </button>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// In-memory comment engine — local state, no server calls
// ---------------------------------------------------------------------------

function useInMemoryComments() {
    const [comments, setComments] = useState<CommentType[]>(createInitialMockComments);

    const createComment = useCallback((data: Partial<CommentType>) => {
        const id = `m${Date.now()}`;
        const userId = data.userId ?? 'user-alice';
        const newComment: CommentType = {
            id,
            body: data.body ?? '',
            targetType: DEMO_TARGET_TYPE,
            targetId: DEMO_TARGET_ID,
            parentId: data.parentId ?? null,
            userId,
            status: 'active',
            reactions: {},
            depth: data.depth ?? 0,
            appId: null,
            organizationId: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            _user: MOCK_USERS[userId] ?? { id: userId, name: userId, image: null, createdAt: Date.now() },
        };
        setComments((prev) => [...prev, newComment]);
    }, []);

    const updateComment = useCallback((id: string, data: Record<string, unknown>) => {
        setComments((prev) => prev.map((c) => (c.id === id ? { ...c, ...data, updatedAt: Date.now() } : c)));
    }, []);

    return { comments, createComment, updateComment };
}

// ---------------------------------------------------------------------------
// CommentThread — shared UI for both modes
// ---------------------------------------------------------------------------

interface CommentThreadProps {
    comments: CommentType[];
    currentUserId: string | null;
    isLoading?: boolean;
    error?: Error | null;
    fetchUser?: boolean;
    onRefetch?: () => void;
    onCreateComment: (body: string) => void;
    onCreateReply: (body: string, parentId: string, depth: number) => void;
    onReact: (id: string, emoji: string) => void;
    onModerate: (id: string, action: 'flag' | 'hide' | 'delete') => void;
    isPending?: boolean;
    mutationError?: string | null;
    onDismissError?: () => void;
}

function CommentThread({
    comments,
    currentUserId,
    isLoading = false,
    error,
    fetchUser = true,
    onRefetch,
    onCreateComment,
    onCreateReply,
    onReact,
    onModerate,
    isPending = false,
    mutationError,
    onDismissError,
}: CommentThreadProps) {
    const [newComment, setNewComment] = useState('');
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [visibleRootCount, setVisibleRootCount] = useState(ROOT_PAGE_SIZE);

    const rootComments = useMemo(
        () => comments.filter((c) => c.parentId === null || c.parentId === undefined),
        [comments],
    );
    const visibleRoots = rootComments.slice(0, visibleRootCount);
    const moreRoots = rootComments.length - visibleRootCount;

    function getDepth(parentId: string | null): number {
        if (!parentId) return 0;
        const parent = comments.find((c) => c.id === parentId);
        return parent ? (parent.depth ?? 0) + 1 : 0;
    }

    function handleSubmitNew() {
        if (!newComment.trim()) return;
        onCreateComment(newComment.trim());
        setNewComment('');
    }

    function handleSubmitReply() {
        if (!replyText.trim() || !replyingTo) return;
        onCreateReply(replyText.trim(), replyingTo, getDepth(replyingTo));
        setReplyText('');
        setReplyingTo(null);
    }

    function handleReply(parentId: string) {
        setReplyingTo(parentId || null);
        setReplyText('');
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground">Comment Thread</h2>
                {onRefetch && (
                    <Button size="sm" variant="ghost" onClick={onRefetch} disabled={isLoading}>
                        <IconRefresh size={14} className={isLoading ? 'animate-spin' : ''} />
                    </Button>
                )}
            </div>

            {/* Mutation error banner */}
            {mutationError && (
                <Alert variant="destructive">
                    <AlertDescription className="flex items-center justify-between">
                        <span>{mutationError}</span>
                        <Button variant="ghost" size="sm" onClick={onDismissError}>
                            Dismiss
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            {/* Mock target entity card */}
            <Card className="border-dashed">
                <CardContent className="py-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                        Target: {DEMO_TARGET_TYPE} / {DEMO_TARGET_ID}
                    </p>
                    <h3 className="font-semibold text-foreground">
                        Understanding Polymorphic Relationships in OttaORM
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        A deep dive into attaching behaviour to any entity type without changing the core schema…
                    </p>
                </CardContent>
            </Card>

            {/* Query error */}
            {error && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                    {error.message ?? 'Failed to load comments'}
                </div>
            )}

            {/* New comment form */}
            <div className="flex flex-col gap-2">
                <Textarea
                    placeholder="Write a comment…"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="min-h-[80px] text-sm"
                />
                <div className="flex justify-end">
                    <Button size="sm" onClick={handleSubmitNew} disabled={!newComment.trim() || isPending}>
                        {isPending && <IconLoader2 size={14} className="mr-1 animate-spin" />}
                        Post comment
                    </Button>
                </div>
            </div>

            {/* Comment list */}
            {isLoading ? (
                <div className="flex flex-col gap-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex gap-3 p-4">
                            <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-4 w-full" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="divide-y divide-border rounded-lg border bg-card">
                    {visibleRoots.map((c) => (
                        <div key={c.id} className="px-4">
                            <CommentNode
                                comment={c}
                                allComments={comments}
                                currentUserId={currentUserId}
                                fetchUser={fetchUser}
                                onReact={onReact}
                                onReply={handleReply}
                                onModerate={onModerate}
                                replyingTo={replyingTo}
                                replyText={replyText}
                                onReplyTextChange={setReplyText}
                                onSubmitReply={handleSubmitReply}
                                isSubmittingReply={isPending}
                            />
                        </div>
                    ))}

                    {comments.length === 0 && !isLoading && (
                        <p className="p-6 text-center text-sm text-muted-foreground">
                            No comments yet. Be the first to comment!
                        </p>
                    )}

                    {moreRoots > 0 && (
                        <button
                            onClick={() => setVisibleRootCount((n) => n + ROOT_PAGE_SIZE)}
                            className="w-full p-3 text-center text-sm text-blue-600 hover:bg-muted/50 dark:text-blue-400 transition-colors"
                        >
                            Load more comments… ({moreRoots} remaining)
                        </button>
                    )}
                </div>
            )}

            {/* Stat bar */}
            {!isLoading && comments.length > 0 && (
                <p className="text-xs text-muted-foreground">
                    {comments.filter((c) => c.status === 'active').length} active ·{' '}
                    {comments.filter((c) => c.status === 'flagged').length} flagged ·{' '}
                    {comments.filter((c) => c.status === 'deleted').length} deleted · {comments.length} total
                </p>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// InMemoryDemo — wraps CommentThread with local state
// ---------------------------------------------------------------------------

function InMemoryDemo() {
    const currentUserId = 'user-alice';
    const { comments, createComment, updateComment } = useInMemoryComments();

    function handleReact(id: string, emoji: string) {
        const comment = comments.find((c) => c.id === id);
        if (!comment) return;
        const reactions = { ...((comment.reactions as Record<string, string[]>) ?? {}) };
        const users = reactions[emoji] ?? [];
        const has = users.includes(currentUserId);
        reactions[emoji] = has ? users.filter((u) => u !== currentUserId) : [...users, currentUserId];
        if (reactions[emoji].length === 0) delete reactions[emoji];
        updateComment(id, { reactions });
    }

    function handleModerate(id: string, action: 'flag' | 'hide' | 'delete') {
        const statusMap: Record<string, string> = { flag: 'flagged', hide: 'hidden', delete: 'deleted' };
        if (action === 'delete') {
            updateComment(id, { status: statusMap[action], body: '[deleted]', reactions: {} });
        } else {
            updateComment(id, { status: statusMap[action] });
        }
    }

    return (
        <CommentThread
            comments={comments}
            currentUserId={currentUserId}
            onCreateComment={(body) => createComment({ body, userId: currentUserId })}
            onCreateReply={(body, parentId, depth) => createComment({ body, userId: currentUserId, parentId, depth })}
            onReact={handleReact}
            onModerate={handleModerate}
        />
    );
}

// ---------------------------------------------------------------------------
// DatabaseDemo — wraps CommentThread with real CRUD hooks
// ---------------------------------------------------------------------------

function DatabaseDemo() {
    const { user } = useSession({ skipAutoSync: true });
    const currentUserId = user?.id ?? null;
    const [mutationError, setMutationError] = useState<string | null>(null);

    const {
        data: comments = [],
        isLoading,
        error,
        refetch,
    } = useComments({
        where: { targetType: DEMO_TARGET_TYPE, targetId: DEMO_TARGET_ID },
        orderBy: 'createdAt',
        orderDirection: 'asc',
    });

    const createMutation = useCreateComment();
    const updateMutation = useUpdateComment();

    function onError(err: Error) {
        setMutationError(err.message || 'Something went wrong');
    }

    function handleCreate(body: string) {
        setMutationError(null);
        createMutation.mutate(
            { body, targetType: DEMO_TARGET_TYPE, targetId: DEMO_TARGET_ID },
            { onSuccess: () => toast.success('Comment posted'), onError },
        );
    }

    function handleReply(body: string, parentId: string, depth: number) {
        setMutationError(null);
        createMutation.mutate(
            { body, targetType: DEMO_TARGET_TYPE, targetId: DEMO_TARGET_ID, parentId, depth },
            { onSuccess: () => toast.success('Reply posted'), onError },
        );
    }

    function handleReact(id: string, emoji: string) {
        // Send only the emoji to toggle — the server validates and applies the change
        // for the current user, preventing manipulation of other users' reactions.
        if (!currentUserId) return;
        updateMutation.mutate({ id, data: { _reaction: emoji } as Record<string, unknown> }, { onError });
    }

    function handleModerate(id: string, action: 'flag' | 'hide' | 'delete') {
        const statusMap: Record<string, string> = { flag: 'flagged', hide: 'hidden', delete: 'deleted' };
        if (action === 'delete') {
            updateMutation.mutate(
                {
                    id,
                    data: { status: statusMap[action], body: '[deleted]', reactions: {} } as Record<string, unknown>,
                },
                { onError },
            );
        } else {
            updateMutation.mutate({ id, data: { status: statusMap[action] } as Record<string, unknown> }, { onError });
        }
    }

    return (
        <CommentThread
            comments={comments}
            currentUserId={currentUserId}
            isLoading={isLoading}
            error={error}
            onRefetch={() => refetch()}
            onCreateComment={handleCreate}
            onCreateReply={handleReply}
            onReact={handleReact}
            onModerate={handleModerate}
            isPending={createMutation.isPending}
            mutationError={mutationError}
            onDismissError={() => setMutationError(null)}
        />
    );
}

// ---------------------------------------------------------------------------
// Main demo page
// ---------------------------------------------------------------------------

export function CommentsDemoPage() {
    const [mode, setMode] = useState<'memory' | 'database'>('memory');

    return (
        <div className="flex flex-col gap-8">
            {/* Page header */}
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <IconMessageCircle size={22} className="text-blue-500" />
                    <h1 className="text-2xl font-bold text-foreground">Comments</h1>
                </div>
                <p className="text-muted-foreground text-sm">
                    Threaded comment system with reactions, moderation, and polymorphic targeting via{' '}
                    <code className="rounded bg-muted px-1 py-0.5 text-xs">@ottabase/comments</code>.
                </p>
            </div>

            {/* Mode toggle */}
            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Data source:</span>
                <div className="inline-flex rounded-lg border bg-muted p-0.5">
                    <button
                        onClick={() => setMode('memory')}
                        className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                            mode === 'memory'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        In-memory
                    </button>
                    <button
                        onClick={() => setMode('database')}
                        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                            mode === 'database'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <IconDatabase size={14} />
                        Database
                    </button>
                </div>
                <span className="text-xs text-muted-foreground">
                    {mode === 'memory'
                        ? 'Using local state with mock data'
                        : 'Reading & writing to the actual D1 database'}
                </span>
            </div>

            {/* Active demo */}
            <section>{mode === 'memory' ? <InMemoryDemo /> : <DatabaseDemo />}</section>

            {/* Model API */}
            <section className="flex flex-col gap-4">
                <h2 className="text-base font-semibold text-foreground">Model API</h2>
                <Card>
                    <CardContent className="p-0">
                        <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed text-foreground">
                            {`// Create a comment
const comment = await Comment.create({
    body: 'Great article!',
    targetType: 'post',
    targetId: 'post-123',
    userId: 'user-456',
});

// Reply to a comment
const reply = await Comment.create({
    body: 'Thanks!',
    targetType: 'post',
    targetId: 'post-123',
    parentId: comment.get('id'),
    userId: 'user-789',
    depth: 1,
});

// Toggle reaction
await comment.toggleReaction('👍', 'user-789');

// Moderation
await comment.flag();
await comment.softDelete();`}
                        </pre>
                    </CardContent>
                </Card>
            </section>

            {/* Features grid */}
            <section className="flex flex-col gap-4">
                <h2 className="text-base font-semibold text-foreground">Features</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                        {
                            icon: '🎯',
                            title: 'Polymorphic targeting',
                            desc: 'Attach comments to any entity type (post, product, video) without schema changes.',
                        },
                        {
                            icon: '🧵',
                            title: 'Threaded replies',
                            desc: 'Unlimited nesting depth tracked via parentId + depth columns.',
                        },
                        {
                            icon: '😄',
                            title: 'Emoji reactions',
                            desc: 'Toggle-able per-user reactions stored as JSON. Supports any Unicode emoji.',
                        },
                        {
                            icon: '🛡️',
                            title: 'Moderation',
                            desc: 'Flag, hide, and soft-delete comments with status transitions and audit trail.',
                        },
                        {
                            icon: '⚡',
                            title: 'OttaORM CRUD API',
                            desc: 'Generic CRUD via /api/ottaorm/comments — no custom endpoints required.',
                        },
                        {
                            icon: '🔒',
                            title: 'RLS-aware',
                            desc: 'Tenant and user rules enforced at the OttaORM level automatically.',
                        },
                    ].map((f) => (
                        <Card key={f.title} className="flex flex-col gap-2 p-4">
                            <div className="text-2xl">{f.icon}</div>
                            <h3 className="text-sm font-semibold text-foreground">{f.title}</h3>
                            <p className="text-xs text-muted-foreground">{f.desc}</p>
                        </Card>
                    ))}
                </div>
            </section>
        </div>
    );
}
