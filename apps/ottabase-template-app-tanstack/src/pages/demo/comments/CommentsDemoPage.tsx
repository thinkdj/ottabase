/**
 * Demo page for the @ottabase/comments package.
 * Showcases threaded comments, reactions, moderation, and the Model API.
 * Uses local state only — no actual API calls.
 */
import { Button, Card, CardContent, Textarea } from '@ottabase/ui-shadcn';
import { IconFlag, IconMessageCircle, IconMessageReply, IconShieldCheck, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MockComment {
    id: string;
    body: string;
    userId: string;
    userName: string;
    status: 'active' | 'flagged' | 'hidden' | 'deleted';
    reactions: Record<string, string[]>;
    depth: number;
    parentId: string | null;
    createdAt: number;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_COMMENTS: MockComment[] = [
    {
        id: '1',
        body: 'This is a fantastic article! Really helped me understand the concept.',
        userId: 'user-1',
        userName: 'Alice Chen',
        status: 'active',
        reactions: { '👍': ['u2', 'u3'], '❤️': ['u3'] },
        depth: 0,
        parentId: null,
        createdAt: Date.now() - 3600000,
    },
    {
        id: '2',
        body: 'Totally agree! The examples were super clear.',
        userId: 'user-2',
        userName: 'Bob Smith',
        status: 'active',
        reactions: { '👍': ['u1'] },
        depth: 1,
        parentId: '1',
        createdAt: Date.now() - 1800000,
    },
    {
        id: '3',
        body: 'Could you elaborate on the threading implementation?',
        userId: 'user-3',
        userName: 'Carol Diaz',
        status: 'active',
        reactions: {},
        depth: 1,
        parentId: '1',
        createdAt: Date.now() - 900000,
    },
    {
        id: '4',
        body: 'I have a different perspective on this...',
        userId: 'user-4',
        userName: 'Dan Kim',
        status: 'flagged',
        reactions: { '😮': ['u1'] },
        depth: 0,
        parentId: null,
        createdAt: Date.now() - 7200000,
    },
    {
        id: '5',
        body: '[deleted]',
        userId: 'user-5',
        userName: 'Eve Park',
        status: 'deleted',
        reactions: {},
        depth: 0,
        parentId: null,
        createdAt: Date.now() - 10800000,
    },
];

const REACTIONS = ['👍', '❤️', '😂', '😮'];
const CURRENT_USER = 'u-demo';

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

const AVATAR_COLORS = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'];

function avatarColor(userId: string) {
    const idx = userId.charCodeAt(userId.length - 1) % AVATAR_COLORS.length;
    return AVATAR_COLORS[idx];
}

function statusBadge(status: MockComment['status']) {
    if (status === 'active') return null;
    const map: Record<string, string> = {
        flagged: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
        hidden: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
        deleted: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    return <span className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${map[status]}`}>{status}</span>;
}

// ---------------------------------------------------------------------------
// CommentNode
// ---------------------------------------------------------------------------

interface CommentNodeProps {
    comment: MockComment;
    allComments: MockComment[];
    onReact: (id: string, emoji: string) => void;
    onReply: (parentId: string) => void;
    onModerate: (id: string, action: 'flag' | 'hide' | 'delete') => void;
    replyingTo: string | null;
    replyText: string;
    onReplyTextChange: (v: string) => void;
    onSubmitReply: () => void;
}

function CommentNode({
    comment,
    allComments,
    onReact,
    onReply,
    onModerate,
    replyingTo,
    replyText,
    onReplyTextChange,
    onSubmitReply,
}: CommentNodeProps) {
    const children = allComments.filter((c) => c.parentId === comment.id);
    const isDeleted = comment.status === 'deleted';

    return (
        <div className={comment.depth > 0 ? 'ml-8 border-l-2 border-border pl-4' : ''}>
            <div className="py-3">
                {/* Header */}
                <div className="flex items-center gap-2 mb-1">
                    <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(comment.userId)}`}
                    >
                        {getInitials(comment.userName)}
                    </div>
                    <span className="text-sm font-semibold text-foreground">{comment.userName}</span>
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
                        {/* Reaction buttons */}
                        {REACTIONS.map((emoji) => {
                            const users = comment.reactions[emoji] ?? [];
                            const active = users.includes(CURRENT_USER);
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

                        {/* Reply */}
                        {comment.depth < 3 && (
                            <button
                                onClick={() => onReply(comment.id)}
                                className="ml-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <IconMessageReply size={13} />
                                Reply
                            </button>
                        )}

                        {/* Moderate */}
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
                            placeholder={`Reply to ${comment.userName}…`}
                            value={replyText}
                            onChange={(e) => onReplyTextChange(e.target.value)}
                            className="min-h-[60px] text-sm"
                        />
                        <div className="flex gap-2">
                            <Button size="sm" onClick={onSubmitReply} disabled={!replyText.trim()}>
                                Post reply
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => onReply('')}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Nested children */}
            {children.map((child) => (
                <CommentNode
                    key={child.id}
                    comment={child}
                    allComments={allComments}
                    onReact={onReact}
                    onReply={onReply}
                    onModerate={onModerate}
                    replyingTo={replyingTo}
                    replyText={replyText}
                    onReplyTextChange={onReplyTextChange}
                    onSubmitReply={onSubmitReply}
                />
            ))}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main demo page
// ---------------------------------------------------------------------------

export function CommentsDemoPage() {
    const [comments, setComments] = useState<MockComment[]>(MOCK_COMMENTS);
    const [newComment, setNewComment] = useState('');
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [showAll, setShowAll] = useState(false);

    // Find parent comment depth when replying
    function getDepth(parentId: string | null): number {
        if (!parentId) return 0;
        const parent = comments.find((c) => c.id === parentId);
        return parent ? parent.depth + 1 : 0;
    }

    function handleSubmitNew() {
        if (!newComment.trim()) return;
        setComments((prev) => [
            ...prev,
            {
                id: String(Date.now()),
                body: newComment.trim(),
                userId: CURRENT_USER,
                userName: 'You',
                status: 'active',
                reactions: {},
                depth: 0,
                parentId: null,
                createdAt: Date.now(),
            },
        ]);
        setNewComment('');
    }

    function handleSubmitReply() {
        if (!replyText.trim() || !replyingTo) return;
        setComments((prev) => [
            ...prev,
            {
                id: String(Date.now()),
                body: replyText.trim(),
                userId: CURRENT_USER,
                userName: 'You',
                status: 'active',
                reactions: {},
                depth: getDepth(replyingTo),
                parentId: replyingTo,
                createdAt: Date.now(),
            },
        ]);
        setReplyText('');
        setReplyingTo(null);
    }

    function handleReact(id: string, emoji: string) {
        setComments((prev) =>
            prev.map((c) => {
                if (c.id !== id) return c;
                const users = c.reactions[emoji] ?? [];
                const has = users.includes(CURRENT_USER);
                return {
                    ...c,
                    reactions: {
                        ...c.reactions,
                        [emoji]: has ? users.filter((u) => u !== CURRENT_USER) : [...users, CURRENT_USER],
                    },
                };
            }),
        );
    }

    function handleModerate(id: string, action: 'flag' | 'hide' | 'delete') {
        const statusMap: Record<string, MockComment['status']> = {
            flag: 'flagged',
            hide: 'hidden',
            delete: 'deleted',
        };
        setComments((prev) =>
            prev.map((c) => {
                if (c.id !== id) return c;
                // Mirror Comment.softDelete() behaviour: clear body and reactions on delete
                if (action === 'delete') {
                    return { ...c, status: statusMap[action], body: '[deleted]', reactions: {} };
                }
                return { ...c, status: statusMap[action] };
            }),
        );
    }

    function handleReply(parentId: string) {
        setReplyingTo(parentId || null);
        setReplyText('');
    }

    // Top-level comments only for rendering root nodes
    const rootComments = comments.filter((c) => c.parentId === null);
    const visibleRoots = showAll ? rootComments : rootComments.slice(0, 4);

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

            {/* ---------------------------------------------------------------- */}
            {/* Section 1 – Thread Demo                                           */}
            {/* ---------------------------------------------------------------- */}
            <section className="flex flex-col gap-4">
                <h2 className="text-base font-semibold text-foreground">Comment Thread Demo</h2>

                {/* Mock target entity */}
                <Card className="border-dashed">
                    <CardContent className="py-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                            Target: Blog Post
                        </p>
                        <h3 className="font-semibold text-foreground">
                            Understanding Polymorphic Relationships in OttaORM
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            A deep dive into attaching behaviour to any entity type without changing the core schema…
                        </p>
                    </CardContent>
                </Card>

                {/* New comment form */}
                <div className="flex flex-col gap-2">
                    <Textarea
                        placeholder="Write a comment…"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="min-h-[80px] text-sm"
                    />
                    <div className="flex justify-end">
                        <Button size="sm" onClick={handleSubmitNew} disabled={!newComment.trim()}>
                            Post comment
                        </Button>
                    </div>
                </div>

                {/* Comment list */}
                <div className="divide-y divide-border rounded-lg border bg-card">
                    {visibleRoots.map((c) => (
                        <div key={c.id} className="px-4">
                            <CommentNode
                                comment={c}
                                allComments={comments}
                                onReact={handleReact}
                                onReply={handleReply}
                                onModerate={handleModerate}
                                replyingTo={replyingTo}
                                replyText={replyText}
                                onReplyTextChange={setReplyText}
                                onSubmitReply={handleSubmitReply}
                            />
                        </div>
                    ))}

                    {rootComments.length === 0 && (
                        <p className="p-6 text-center text-sm text-muted-foreground">No comments yet.</p>
                    )}

                    {!showAll && rootComments.length > 4 && (
                        <button
                            onClick={() => setShowAll(true)}
                            className="w-full p-3 text-center text-sm text-blue-600 hover:bg-muted/50 dark:text-blue-400 transition-colors"
                        >
                            Load {rootComments.length - 4} more comment{rootComments.length - 4 > 1 ? 's' : ''}…
                        </button>
                    )}
                </div>

                {/* Live stat bar */}
                <p className="text-xs text-muted-foreground">
                    {comments.filter((c) => c.status === 'active').length} active ·{' '}
                    {comments.filter((c) => c.status === 'flagged').length} flagged ·{' '}
                    {comments.filter((c) => c.status === 'deleted').length} deleted
                </p>
            </section>

            {/* ---------------------------------------------------------------- */}
            {/* Section 2 – Model API                                             */}
            {/* ---------------------------------------------------------------- */}
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

            {/* ---------------------------------------------------------------- */}
            {/* Section 3 – Features grid                                         */}
            {/* ---------------------------------------------------------------- */}
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
