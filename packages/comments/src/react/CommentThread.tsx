// The one comment thread: used by the blog, the demo, and anything else with comments.
// Data in, callbacks out. The host owns fetching, mutations and error toasts.

import { Alert, Avatar, AvatarFallback, AvatarImage, Badge, Button, Skeleton, Textarea } from '@ottabase/ui-shadcn';
import { EyeOff, Flag, Loader2, Pencil, RotateCcw, SmilePlus, Trash2 } from 'lucide-react';
import { memo, useMemo, useState, type ReactNode } from 'react';
import { buildCommentTree, countVisible, type CommentTree, type ThreadComment } from '../thread';
import { DEFAULT_REACTIONS } from '../types';

export type CommentModeration = 'hide' | 'restore' | 'delete';

export interface CommentThreadProps {
    comments: ThreadComment[];
    /** The signed in user, or null for a reader who can only look */
    currentUserId: string | null;
    /** Moderators see hidden and reported comments and can hide, restore and delete any */
    canModerate?: boolean;
    reactions?: readonly string[];
    /** How deep replies may go; 0 is a top level comment */
    maxDepth?: number;
    isLoading?: boolean;
    error?: string | null;
    /** Disables composers while a request is in flight */
    busy?: boolean;
    /** Shown in place of the composer when nobody is signed in */
    signInPrompt?: ReactNode;
    /** Rejections keep the draft in place, so hosts should report the error themselves */
    onPost: (body: string, parentId: string | null) => Promise<unknown>;
    onEdit: (id: string, body: string) => Promise<unknown>;
    onReact: (id: string, emoji: string) => void;
    onReport: (id: string) => void;
    onModerate: (id: string, action: CommentModeration) => void;
}

const ROOT_PAGE = 10;
const REPLY_PAGE = 3;

export function CommentThread({
    comments,
    currentUserId,
    canModerate = false,
    reactions = DEFAULT_REACTIONS,
    maxDepth = 3,
    isLoading = false,
    error,
    busy = false,
    signInPrompt,
    onPost,
    onEdit,
    onReact,
    onReport,
    onModerate,
}: CommentThreadProps) {
    const tree = useMemo(() => buildCommentTree(comments), [comments]);
    const [rootLimit, setRootLimit] = useState(ROOT_PAGE);
    const count = countVisible(comments);
    const ctx: ItemContext = {
        currentUserId,
        canModerate,
        reactions,
        maxDepth,
        busy,
        onPost,
        onEdit,
        onReact,
        onReport,
        onModerate,
    };
    const hiddenRoots = tree.roots.length - rootLimit;

    return (
        <section className="space-y-4" aria-label="Comments">
            <div className="flex items-center justify-between">
                <h2 className="text-[0.9375rem] font-semibold">Comments</h2>
                <span className="text-xs text-muted-foreground">
                    {count} {count === 1 ? 'comment' : 'comments'}
                </span>
            </div>

            {error && <Alert variant="destructive">{error}</Alert>}

            {currentUserId ? (
                <Composer
                    placeholder="Write a comment"
                    submitLabel="Post comment"
                    busy={busy}
                    onSubmit={(body) => onPost(body, null)}
                />
            ) : (
                signInPrompt
            )}

            {isLoading ? (
                <div className="space-y-4 py-2" role="status" aria-label="Loading comments">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="flex gap-3">
                            <Skeleton className="h-8 w-8 rounded-full" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-3 w-24" />
                                <Skeleton className="h-3 w-full" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : tree.roots.length === 0 ? (
                <p className="rounded-xl bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                    No comments yet. Start the conversation.
                </p>
            ) : (
                <div className="divide-y divide-border/60">
                    {tree.roots.slice(0, rootLimit).map((comment) => (
                        <CommentItem key={comment.id} comment={comment} depth={0} tree={tree} ctx={ctx} />
                    ))}
                </div>
            )}

            {hiddenRoots > 0 && (
                <button
                    type="button"
                    onClick={() => setRootLimit((n) => n + ROOT_PAGE)}
                    className="w-full rounded-lg p-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                >
                    Show {hiddenRoots} more
                </button>
            )}
        </section>
    );
}

interface ItemContext {
    currentUserId: string | null;
    canModerate: boolean;
    reactions: readonly string[];
    maxDepth: number;
    busy: boolean;
    onPost: CommentThreadProps['onPost'];
    onEdit: CommentThreadProps['onEdit'];
    onReact: CommentThreadProps['onReact'];
    onReport: CommentThreadProps['onReport'];
    onModerate: CommentThreadProps['onModerate'];
}

const pill = (active: boolean) =>
    `inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs ring-1 transition-colors disabled:opacity-60 ${
        active
            ? 'bg-primary text-primary-foreground ring-transparent'
            : 'bg-background text-muted-foreground ring-border hover:text-foreground'
    }`;

const CommentItem = memo(function CommentItem({
    comment,
    depth,
    tree,
    ctx,
}: {
    comment: ThreadComment;
    depth: number;
    tree: CommentTree;
    ctx: ItemContext;
}) {
    const [mode, setMode] = useState<'idle' | 'reply' | 'edit' | 'confirm-delete'>('idle');
    const [allReplies, setAllReplies] = useState(false);
    const [picker, setPicker] = useState(false);

    const replies = tree.childrenOf.get(comment.id) ?? [];
    const shownReplies = allReplies ? replies : replies.slice(0, REPLY_PAGE);
    const moreReplies = replies.length - shownReplies.length;
    const own = !!ctx.currentUserId && comment.userId === ctx.currentUserId;
    // Readers get a placeholder for hidden comments; moderators see the body so they can judge it
    const gone = comment.status === 'deleted' || (comment.status === 'hidden' && !ctx.canModerate);
    const name = comment._user?.name || (comment.userId ? 'Member' : 'Anonymous');
    const reactionMap = comment.reactions ?? {};
    const reacted = Object.entries(reactionMap).filter(([, users]) => users.length > 0);
    const canReact = !!ctx.currentUserId && !gone;
    const signedIn = !!ctx.currentUserId;

    return (
        <article
            className={depth > 0 ? 'ml-1 border-l border-border/60 pl-4 pt-4' : 'py-4'}
            data-comment-id={comment.id}
        >
            <div className="flex gap-3">
                <Avatar className="h-8 w-8 ring-1 ring-border">
                    <AvatarImage src={comment._user?.image || undefined} alt="" />
                    <AvatarFallback className="text-xs font-medium">{gone ? '' : initials(name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <span className="font-medium">{gone ? 'Removed' : name}</span>
                        <time className="text-xs text-muted-foreground">{timeAgo(comment.createdAt)}</time>
                        {ctx.canModerate && comment.status === 'flagged' && (
                            <Badge variant="outline" className="rounded-full text-[0.6875rem] font-medium">
                                Reported
                            </Badge>
                        )}
                        {ctx.canModerate && comment.status === 'hidden' && (
                            <Badge variant="secondary" className="rounded-full text-[0.6875rem] font-medium">
                                Hidden
                            </Badge>
                        )}
                        {tree.orphans.has(comment.id) && (
                            <span className="text-xs text-muted-foreground">
                                in reply to a comment that is no longer here
                            </span>
                        )}
                    </div>

                    {gone ? (
                        <p className="mt-1 text-sm italic text-muted-foreground">
                            {comment.status === 'deleted'
                                ? 'This comment was deleted.'
                                : 'This comment was hidden by a moderator.'}
                        </p>
                    ) : mode === 'edit' ? (
                        <div className="mt-2">
                            <Composer
                                initial={comment.body}
                                submitLabel="Save"
                                busy={ctx.busy}
                                onSubmit={async (body) => {
                                    await ctx.onEdit(comment.id, body);
                                    setMode('idle');
                                }}
                                onCancel={() => setMode('idle')}
                            />
                        </div>
                    ) : (
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{comment.body}</p>
                    )}

                    {!gone && mode !== 'edit' && (
                        <div className="mt-2 flex flex-wrap items-center gap-1">
                            {reacted.map(([emoji, users]) => {
                                const active = !!ctx.currentUserId && users.includes(ctx.currentUserId);
                                return (
                                    <button
                                        key={emoji}
                                        type="button"
                                        disabled={!canReact}
                                        aria-pressed={active}
                                        aria-label={`${emoji} ${users.length}`}
                                        onClick={() => ctx.onReact(comment.id, emoji)}
                                        className={pill(active)}
                                    >
                                        {emoji}
                                        <span>{users.length}</span>
                                    </button>
                                );
                            })}
                            {canReact && (
                                <button
                                    type="button"
                                    aria-label="Add reaction"
                                    aria-expanded={picker}
                                    onClick={() => setPicker((open) => !open)}
                                    className={pill(false)}
                                >
                                    <SmilePlus className="h-3.5 w-3.5" />
                                </button>
                            )}
                            {picker &&
                                canReact &&
                                ctx.reactions
                                    .filter((emoji) => !reactionMap[emoji]?.length)
                                    .map((emoji) => (
                                        <button
                                            key={emoji}
                                            type="button"
                                            aria-label={`React with ${emoji}`}
                                            onClick={() => {
                                                ctx.onReact(comment.id, emoji);
                                                setPicker(false);
                                            }}
                                            className={pill(false)}
                                        >
                                            {emoji}
                                        </button>
                                    ))}

                            {mode === 'confirm-delete' ? (
                                <span className="ml-1 inline-flex items-center gap-1 text-xs">
                                    <span className="text-muted-foreground">Delete this comment?</span>
                                    <TextButton
                                        tone="destructive"
                                        onClick={() => {
                                            ctx.onModerate(comment.id, 'delete');
                                            setMode('idle');
                                        }}
                                    >
                                        Delete
                                    </TextButton>
                                    <TextButton onClick={() => setMode('idle')}>Keep</TextButton>
                                </span>
                            ) : (
                                <span className="ml-1 inline-flex flex-wrap items-center gap-0.5">
                                    {signedIn && depth < ctx.maxDepth && (
                                        <TextButton onClick={() => setMode(mode === 'reply' ? 'idle' : 'reply')}>
                                            {mode === 'reply' ? 'Cancel' : 'Reply'}
                                        </TextButton>
                                    )}
                                    {own && comment.status === 'active' && (
                                        <TextButton icon={Pencil} onClick={() => setMode('edit')}>
                                            Edit
                                        </TextButton>
                                    )}
                                    {signedIn && !own && comment.status === 'active' && (
                                        <TextButton icon={Flag} onClick={() => ctx.onReport(comment.id)}>
                                            Report
                                        </TextButton>
                                    )}
                                    {ctx.canModerate && !own && comment.status !== 'hidden' && (
                                        <TextButton icon={EyeOff} onClick={() => ctx.onModerate(comment.id, 'hide')}>
                                            Hide
                                        </TextButton>
                                    )}
                                    {ctx.canModerate &&
                                        (comment.status === 'hidden' || comment.status === 'flagged') && (
                                            <TextButton
                                                icon={RotateCcw}
                                                onClick={() => ctx.onModerate(comment.id, 'restore')}
                                            >
                                                Restore
                                            </TextButton>
                                        )}
                                    {(own || ctx.canModerate) && (
                                        <TextButton
                                            icon={Trash2}
                                            tone="destructive"
                                            onClick={() => setMode('confirm-delete')}
                                        >
                                            Delete
                                        </TextButton>
                                    )}
                                </span>
                            )}
                        </div>
                    )}

                    {mode === 'reply' && (
                        <div className="mt-3">
                            <Composer
                                placeholder={`Reply to ${name}`}
                                submitLabel="Post reply"
                                busy={ctx.busy}
                                onSubmit={async (body) => {
                                    await ctx.onPost(body, comment.id);
                                    setMode('idle');
                                }}
                                onCancel={() => setMode('idle')}
                            />
                        </div>
                    )}
                </div>
            </div>

            {shownReplies.map((reply) => (
                <CommentItem key={reply.id} comment={reply} depth={depth + 1} tree={tree} ctx={ctx} />
            ))}
            {moreReplies > 0 && (
                <button
                    type="button"
                    onClick={() => setAllReplies(true)}
                    className="ml-5 mt-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                    Show {moreReplies} more {moreReplies === 1 ? 'reply' : 'replies'}
                </button>
            )}
        </article>
    );
});

function TextButton({
    icon: Icon,
    tone,
    onClick,
    children,
}: {
    icon?: typeof Pencil;
    tone?: 'destructive';
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 ${
                tone === 'destructive' ? 'hover:text-destructive' : 'hover:text-foreground'
            }`}
        >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {children}
        </button>
    );
}

function Composer({
    initial = '',
    placeholder,
    submitLabel,
    busy,
    onSubmit,
    onCancel,
}: {
    initial?: string;
    placeholder?: string;
    submitLabel: string;
    busy: boolean;
    onSubmit: (body: string) => Promise<unknown>;
    onCancel?: () => void;
}) {
    const [text, setText] = useState(initial);
    const [sending, setSending] = useState(false);

    const submit = async () => {
        const body = text.trim();
        if (!body || sending) return;
        setSending(true);
        try {
            await onSubmit(body);
            setText('');
        } catch {
            // The host reports the failure; the draft stays so nothing typed is lost
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="space-y-2 rounded-xl bg-muted/40 p-3">
            <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={placeholder}
                aria-label={placeholder ?? submitLabel}
                className="min-h-20 bg-background text-sm"
                onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void submit();
                }}
            />
            <div className="flex justify-end gap-2">
                {onCancel && (
                    <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
                        Cancel
                    </Button>
                )}
                <Button
                    type="button"
                    size="sm"
                    onClick={() => void submit()}
                    disabled={!text.trim() || sending || busy}
                >
                    {sending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    {submitLabel}
                </Button>
            </div>
        </div>
    );
}

function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

function timeAgo(value: unknown): string {
    const ms = typeof value === 'number' ? value : new Date(value as string).getTime();
    if (!Number.isFinite(ms)) return '';
    const seconds = Math.round((ms - Date.now()) / 1000);
    const away = Math.abs(seconds);
    if (away < 60) return 'just now';
    if (away < 3600) return relative.format(Math.round(seconds / 60), 'minute');
    if (away < 86400) return relative.format(Math.round(seconds / 3600), 'hour');
    if (away < 86400 * 30) return relative.format(Math.round(seconds / 86400), 'day');
    return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
