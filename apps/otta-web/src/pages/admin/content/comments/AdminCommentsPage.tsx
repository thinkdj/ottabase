// /admin/content/comments: the moderation queue. A guest's comment waits here as `pending` until a
// moderator approves it; a hidden one can be brought back. The list is the moderator's own scope,
// which the server takes from the org switcher: the active org's posts, or in platform scope the
// platform blog (null org).

import type { CommentType } from '@/hooks/commentHooks';
import { api, getErrorMessage } from '@/lib/api';
import type { PaginatedResponse } from '@/lib/api-types';
import {
    Button,
    Card,
    ConfirmDialog,
    Empty,
    EmptyDescription,
    EmptyIcon,
    EmptyTitle,
    PageHeader,
    StatusChip,
    Tag,
    toast,
} from '@ottabase/ui';
import { formatDateForUser } from '@ottabase/utils/timezone';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, EyeOff, MessageSquare, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ContentType } from '@ottabase/ottablog';
import { getPublicContentPath } from '../blog/blogAdminPaths';

type QueueStatus = 'pending' | 'hidden';
// The few post fields a row links with. Declared here, not picked from @/types/blog: that module
// pulls the editor's browser types into the wiring tests, which load this page through its descriptor.
interface QueuePost {
    id: string;
    title: string;
    slug: string;
    contentType: ContentType;
}
type QueuePage = PaginatedResponse<CommentType> & { posts: QueuePost[] };

const FILTERS: { status: QueueStatus; label: string }[] = [
    { status: 'pending', label: 'Awaiting review' },
    { status: 'hidden', label: 'Hidden' },
];
const PER_PAGE = 25;
const COMMENTS_QUEUE_QUERY_KEY = ['admin-comments'] as const;

/** One page of the queue, with the titles of the posts it is on in one batched request. */
async function fetchQueuePage(status: QueueStatus, page: number): Promise<QueuePage> {
    const comments = await api<PaginatedResponse<CommentType>>(
        `/api/ottaorm/comments?${new URLSearchParams({
            where: JSON.stringify({ status }),
            // The longest wait first; the most recently hidden first.
            orderBy: 'createdAt',
            orderDirection: status === 'pending' ? 'asc' : 'desc',
            page: String(page),
            perPage: String(PER_PAGE),
        })}`,
    );
    const postIds = [...new Set(comments.data.filter((c) => c.targetType === 'post').map((c) => c.targetId))];
    // Titles are a label, not the queue: a post the moderator cannot read just shows as unknown.
    const posts = postIds.length
        ? await api<PaginatedResponse<QueuePost>>(
              `/api/ottaorm/posts?${new URLSearchParams({
                  where: JSON.stringify({ id: { $in: postIds } }),
                  perPage: String(postIds.length),
              })}`,
          )
              .then((r) => r.data)
              .catch(() => [])
        : [];
    return { ...comments, posts };
}

export function AdminCommentsPage() {
    const [status, setStatus] = useState<QueueStatus>('pending');
    const queue = useInfiniteQuery({
        queryKey: [...COMMENTS_QUEUE_QUERY_KEY, status],
        queryFn: ({ pageParam }) => fetchQueuePage(status, pageParam),
        initialPageParam: 1,
        getNextPageParam: (last) =>
            last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
        meta: { errorPresentation: 'local' },
    });
    const pages = queue.data?.pages ?? [];
    const items = pages.flatMap((p) => p.data);
    const postsById = new Map(pages.flatMap((p) => p.posts).map((post) => [post.id, post]));

    return (
        <div className="max-w-4xl space-y-8">
            <PageHeader
                title="Comments"
                description="A signed-out visitor's comment waits here until you approve it. Hidden comments stay out of sight until you restore them."
            />

            <div role="radiogroup" aria-label="Show" className="inline-flex rounded-lg border border-border p-1">
                {FILTERS.map((f) => (
                    <button
                        key={f.status}
                        type="button"
                        role="radio"
                        aria-checked={status === f.status}
                        onClick={() => setStatus(f.status)}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${status === f.status ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {queue.isLoading ? (
                <div className="h-48 animate-pulse rounded-lg bg-muted/40" aria-busy="true" />
            ) : queue.error ? (
                <Empty tone="red">
                    <EmptyTitle>The comments couldn't be loaded.</EmptyTitle>
                    <EmptyDescription>{getErrorMessage(queue.error)}</EmptyDescription>
                    <Button className="mt-2" variant="outline" onClick={() => queue.refetch()}>
                        Try again
                    </Button>
                </Empty>
            ) : items.length === 0 ? (
                <Empty tone={status === 'pending' ? 'green' : undefined}>
                    <EmptyIcon>
                        <MessageSquare aria-hidden />
                    </EmptyIcon>
                    <EmptyTitle>
                        {status === 'pending' ? 'Nothing waiting for review' : 'No hidden comments'}
                    </EmptyTitle>
                    <EmptyDescription>
                        {status === 'pending'
                            ? 'When a signed-out visitor comments on a post, the comment shows up here.'
                            : 'Comments you hide show up here, so you can restore them.'}
                    </EmptyDescription>
                </Empty>
            ) : (
                <Card>
                    <ul className="divide-y divide-border">
                        {items.map((comment) => (
                            <CommentRow
                                key={comment.id}
                                comment={comment}
                                post={postsById.get(comment.targetId)}
                                status={status}
                            />
                        ))}
                    </ul>
                </Card>
            )}

            {queue.hasNextPage && (
                <div className="text-center">
                    <Button variant="outline" onClick={() => queue.fetchNextPage()} loading={queue.isFetchingNextPage}>
                        Load more
                    </Button>
                </div>
            )}
        </div>
    );
}

function CommentRow({
    comment,
    post,
    status,
}: {
    comment: CommentType;
    post: QueuePost | undefined;
    status: QueueStatus;
}) {
    const queryClient = useQueryClient();
    const [confirming, setConfirming] = useState(false);
    const isGuest = !comment.userId;
    const author = comment._user?.name || comment.authorName || 'Anonymous';

    // Delete is a soft delete: the server blanks the body and keeps the row so replies stay threaded.
    const setCommentStatus = useMutation({
        mutationFn: (next: 'active' | 'hidden' | 'deleted') =>
            api(`/api/ottaorm/comments/${encodeURIComponent(comment.id)}`, { method: 'PATCH', body: { status: next } }),
        onSuccess: (_data, next) => {
            toast.success(
                next === 'active' ? 'Comment published' : next === 'hidden' ? 'Comment hidden' : 'Comment deleted',
            );
            void queryClient.invalidateQueries({ queryKey: COMMENTS_QUEUE_QUERY_KEY });
        },
        onError: (err) => toast.error(getErrorMessage(err)),
    });

    return (
        <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span className="font-medium text-foreground">{author}</span>
                    {isGuest && <Tag>Guest</Tag>}
                    <StatusChip tone={status === 'pending' ? 'amber' : 'smoke'}>
                        {status === 'pending' ? 'Pending' : 'Hidden'}
                    </StatusChip>
                    <span className="text-xs text-muted-foreground">{formatDateForUser(comment.createdAt)}</span>
                </div>
                {/* Plain text: React escapes it, and pre-wrap keeps the commenter's line breaks. */}
                <p className="whitespace-pre-wrap break-words text-sm text-foreground">{comment.body}</p>
                <p className="text-xs text-muted-foreground">
                    On{' '}
                    {post ? (
                        <a
                            href={getPublicContentPath(post.slug, post.contentType)}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-foreground underline-offset-4 hover:underline"
                        >
                            {post.title || 'Untitled post'}
                        </a>
                    ) : comment.targetType === 'post' ? (
                        'a post you cannot open'
                    ) : (
                        <Tag mono>{comment.targetType}</Tag>
                    )}
                </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
                <Button
                    size="sm"
                    variant="outline"
                    disabled={setCommentStatus.isPending}
                    onClick={() => setCommentStatus.mutate('active')}
                >
                    <Check className="mr-1.5 h-4 w-4" aria-hidden />
                    {status === 'pending' ? 'Approve' : 'Restore'}
                </Button>
                {status === 'pending' && (
                    <Button
                        size="sm"
                        variant="ghost"
                        disabled={setCommentStatus.isPending}
                        onClick={() => setCommentStatus.mutate('hidden')}
                    >
                        <EyeOff className="mr-1.5 h-4 w-4" aria-hidden />
                        Hide
                    </Button>
                )}
                <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={setCommentStatus.isPending}
                    onClick={() => setConfirming(true)}
                    aria-label={`Delete comment from ${author}`}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
            <ConfirmDialog
                open={confirming}
                onOpenChange={setConfirming}
                title="Delete this comment?"
                description={`The comment from ${author} will be removed for good. Replies to it stay, under a deleted placeholder.`}
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText="Delete"
                onConfirm={() => {
                    setCommentStatus.mutate('deleted');
                    setConfirming(false);
                }}
            />
        </li>
    );
}
