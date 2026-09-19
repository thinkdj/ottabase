/**
 * Public Blog Detail Page
 *
 * Displays a single blog post with full content using BlogRenderer.
 * Uses public API so protected posts return without body until unlocked.
 */
import { SEOHead } from '@/components/SEOHead';
import { BLOG_DETAIL_QUERY_CONFIG, BLOG_LIST_QUERY_CONFIG } from '@/config/queryConfig';
import { useComments, useCreateComment, type CommentType } from '@/hooks/commentHooks';
import { api, isApiError } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { useBlogStudio } from '@/ottabase/blog/BlogStudioContext';
import type { PostAuthor } from '@/types/blog';
import { MediaLightboxProvider } from '@ottabase/medialibrary/react';
import {
    formatDate,
    formatShortDate,
    type BlogPostData,
    type ContentType,
    type PhotoJournalItem,
} from '@ottabase/ottablog';
import { BlogRenderer } from '@ottabase/ottablog/renderer';
import { ShareButton } from '@ottabase/ottablog/share';
import type { OutputData } from '@ottabase/ottaeditor';
import { createModelHooks, useApiQuery } from '@ottabase/ottaorm/client';
import { Avatar, AvatarFallback, AvatarImage, Button, Input, Skeleton, Textarea } from '@ottabase/ui-shadcn';
import { Link, useParams } from '@tanstack/react-router';
import { Loader2, Lock, Pencil } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { BlogBackLink, BlogListSkeleton, BlogMeasure, BlogNotFound } from './blogUi';

interface BlogPost {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    blurbText: string | null;
    photoNote: string | null;
    photoAlbum: PhotoJournalItem[] | null;
    content: OutputData | null;
    contentType: ContentType;
    status: string;
    heroImage: { url: string; alt?: string; caption?: string } | null;
    seoMeta: {
        title?: string;
        description?: string;
        keywords?: string[];
        canonicalUrl?: string;
        ogImage?: string;
        noIndex?: boolean;
        noFollow?: boolean;
    } | null;
    footnotes: OutputData | null;
    authorId: string | null;
    // Author from User relationship
    author?: PostAuthor | null;
    readingTimeMinutes: number | null;
    wordCount: number | null;
    isFeatured: boolean;
    allowComments: boolean;
    isProtected?: boolean;
    passwordHint?: string | null;
    publishedAt: string | null;
    seriesId: string | null;
    seriesOrder: number | null;
    tags?: { id: string; name: string; slug: string }[];
    categories?: { id: string; name: string; slug: string }[];
    categoryName?: string | null;
    viewCount?: number;
    originalDate?: {
        timestamp: number;
        resolution: string;
        part?: string;
        approximate?: boolean;
        earliest: number;
        latest: number;
        label: string;
    } | null;
}

interface BlogSeries {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    isComplete: boolean;
}

const blogPostHooks = createModelHooks<BlogPost>({ entityName: 'posts' });
const blogSeriesHooks = createModelHooks<BlogSeries>({
    entityName: 'series',
});

const COMMENTS_TARGET_TYPE = 'post';

function getInitials(name?: string | null): string {
    if (!name) return '??';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return '??';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

interface CommentNodeProps {
    comment: CommentType;
    depth: number;
    commentsByParent: Map<string | null, CommentType[]>;
    canReply: boolean;
    /** Shared "which comment's reply box is open" id — this comment's own isReplying is derived
     *  from comparing its id against this, so only the affected node's visible UI actually
     *  changes, even though the prop value itself is shared across the whole tree. */
    replyingToId: string | null;
    onToggleReply: (commentId: string) => void;
    onSubmitReply: (comment: CommentType, text: string) => void;
    isSubmittingReply: boolean;
}

/**
 * A single comment plus its nested replies. A real component (not a plain recursive function
 * called during BlogDetailPage's render) wrapped in React.memo, with its OWN local reply-draft
 * state — so typing in a reply box only re-renders this one leaf, not the entire (potentially
 * large) comment tree on every keystroke. commentsByParent/onToggleReply/onSubmitReply are
 * referentially stable across BlogDetailPage re-renders (memoized/useCallback), so memo actually
 * skips re-rendering siblings whose props haven't changed. Typing never changes replyingToId (it
 * only changes on open/cancel), so a keystroke never causes BlogDetailPage — or any sibling node
 * — to re-render at all.
 */
const CommentNode = memo(function CommentNode({
    comment,
    depth,
    commentsByParent,
    canReply,
    replyingToId,
    onToggleReply,
    onSubmitReply,
    isSubmittingReply,
}: CommentNodeProps) {
    const [replyText, setReplyText] = useState('');
    const isReplying = replyingToId === comment.id;
    const children = commentsByParent.get(comment.id) ?? [];
    // Nested replies indent with a quiet thread line instead of boxed nesting
    const indentClass = depth === 0 ? 'py-5' : 'ml-1 border-l border-border/50 pl-4 pt-5';

    return (
        <div className={indentClass}>
            <div className="flex gap-3">
                <Avatar className="h-8 w-8">
                    <AvatarImage src={comment._user?.image || undefined} />
                    <AvatarFallback className="text-xs font-medium">{getInitials(comment._user?.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                    <div className="flex items-baseline gap-2 text-sm">
                        <span className="font-medium">{comment._user?.name || 'Anonymous'}</span>
                        <span className="text-[0.75rem] text-muted-foreground">
                            {formatShortDate(comment.createdAt)}
                        </span>
                    </div>
                    <p className="mt-1.5 font-serif text-[0.975rem] leading-relaxed whitespace-pre-wrap text-foreground">
                        {comment.body}
                    </p>
                    {canReply && depth < 3 && (
                        <button
                            type="button"
                            className="mt-2 text-[0.75rem] text-muted-foreground transition-colors duration-normal hover:text-foreground"
                            onClick={() => onToggleReply(comment.id)}
                        >
                            {isReplying ? 'Cancel' : 'Reply'}
                        </button>
                    )}
                    {isReplying && (
                        <div className="mt-3 space-y-2">
                            <Textarea
                                placeholder="Write a reply…"
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                className="min-h-20 border-border/60 bg-transparent text-sm shadow-none"
                            />
                            <div className="flex justify-end">
                                <Button
                                    size="sm"
                                    onClick={() => onSubmitReply(comment, replyText)}
                                    disabled={!replyText.trim() || isSubmittingReply}
                                >
                                    {isSubmittingReply ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Post reply
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {children.map((child) => (
                <CommentNode
                    key={child.id}
                    comment={child}
                    depth={depth + 1}
                    commentsByParent={commentsByParent}
                    canReply={canReply}
                    replyingToId={replyingToId}
                    onToggleReply={onToggleReply}
                    onSubmitReply={onSubmitReply}
                    isSubmittingReply={isSubmittingReply}
                />
            ))}
        </div>
    );
});

export function BlogDetailPage() {
    const params = useParams({ strict: false });
    const slug = (params as { slug?: string }).slug;
    const { user } = useSession();
    const { isReady: studioReady } = useBlogStudio();
    const [unlockedPost, setUnlockedPost] = useState<BlogPost | null>(null);
    const [password, setPassword] = useState('');
    const [unlockError, setUnlockError] = useState<string | null>(null);
    const [isUnlocking, setIsUnlocking] = useState(false);
    const [commentDraft, setCommentDraft] = useState('');
    const [replyingToId, setReplyingToId] = useState<string | null>(null);
    const [commentError, setCommentError] = useState<string | null>(null);

    // useApiQuery with entity:'posts' namespaces the key as ['posts', 'by-slug', slug].
    // Any mutation on the posts entity auto-busts this cache via the global observer.
    const { data: post, isLoading: isLoadingPost } = useApiQuery<BlogPost>({
        entity: 'posts',
        queryKey: ['by-slug', slug],
        endpoint: `/api/blog/posts/by-slug/${encodeURIComponent(slug ?? '')}`,
        queryOptions: {
            enabled: !!slug,
            ...BLOG_DETAIL_QUERY_CONFIG,
        },
    });

    // Fetch series info if post is part of a series (using useDetail for primary key lookup)
    const { data: series } = blogSeriesHooks.useDetail(post?.seriesId || '', {
        enabled: !!post?.seriesId,
        ...BLOG_DETAIL_QUERY_CONFIG,
    });

    // Fetch other posts in the series for navigation
    const { data: seriesPostsData } = blogPostHooks.useList(
        {
            where: post?.seriesId ? { seriesId: post.seriesId, status: 'published' } : undefined,
            orderBy: 'seriesOrder',
            orderDirection: 'asc',
        },
        {
            enabled: !!post?.seriesId,
            ...BLOG_LIST_QUERY_CONFIG,
        },
    );
    const seriesPosts = seriesPostsData || [];

    // Find previous and next posts in series
    const currentIndex = seriesPosts.findIndex((p) => p.id === post?.id);
    const prevPost = currentIndex > 0 ? seriesPosts[currentIndex - 1] : null;
    const nextPost = currentIndex < seriesPosts.length - 1 ? seriesPosts[currentIndex + 1] : null;

    const postForComments = unlockedPost ?? post;
    const isLocked = !!(postForComments?.isProtected && !postForComments?.content);
    const allowComments = postForComments?.allowComments ?? true;
    const commentsTargetId = post?.id ?? unlockedPost?.id ?? null;

    const createComment = useCreateComment();
    const {
        data: commentsData,
        isLoading: isLoadingComments,
        error: commentsError,
        refetch: refetchComments,
    } = useComments(
        commentsTargetId
            ? {
                  where: { targetType: COMMENTS_TARGET_TYPE, targetId: commentsTargetId, status: 'active' },
                  orderBy: 'createdAt',
                  orderDirection: 'asc',
              }
            : undefined,
        {
            enabled: Boolean(commentsTargetId) && !isLocked && allowComments,
        },
    );

    const comments = useMemo<CommentType[]>(() => {
        if (Array.isArray(commentsData)) return commentsData;
        return (commentsData as { data?: CommentType[] } | undefined)?.data ?? [];
    }, [commentsData]);

    const commentsByParent = useMemo(() => {
        const map = new Map<string | null, CommentType[]>();
        for (const comment of comments) {
            const parentId = comment.parentId ?? null;
            const list = map.get(parentId) ?? [];
            list.push(comment);
            map.set(parentId, list);
        }
        return map;
    }, [comments]);

    // Stable references (useCallback) so CommentNode's React.memo can actually skip
    // re-rendering unaffected nodes — a new function identity on every BlogDetailPage render
    // would defeat memoization regardless of how the props are shaped.
    const toggleReply = useCallback((commentId: string) => {
        setReplyingToId((current) => (current === commentId ? null : commentId));
    }, []);

    const handleSubmitReply = useCallback(
        (parent: CommentType, text: string) => {
            if (!text.trim() || !commentsTargetId) return;
            if (!user?.id) {
                setCommentError('Please sign in to reply.');
                return;
            }
            setCommentError(null);
            createComment.mutate(
                {
                    body: text.trim(),
                    targetType: COMMENTS_TARGET_TYPE,
                    targetId: commentsTargetId,
                    parentId: parent.id,
                    depth: (parent.depth ?? 0) + 1,
                },
                {
                    onSuccess: () => {
                        setReplyingToId(null);
                        refetchComments();
                    },
                    onError: (err) => {
                        setCommentError(err instanceof Error ? err.message : 'Failed to post reply.');
                    },
                },
            );
        },
        [commentsTargetId, user?.id, createComment, refetchComments],
    );

    // Loading state — pulse skeleton matching the listing/archive pages
    if (isLoadingPost) {
        return (
            <BlogMeasure>
                <BlogListSkeleton rows={5} />
            </BlogMeasure>
        );
    }

    // Not found
    if (!post) {
        return (
            <BlogNotFound
                title="This page is gone"
                body="The post you're looking for doesn't exist, or it hasn't been published."
            />
        );
    }

    const displayPost = unlockedPost ?? post;

    const handleUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        setUnlockError(null);
        if (!password.trim() || !slug) return;
        setIsUnlocking(true);
        try {
            const full = await api<BlogPost>('/api/blog/posts/unlock', {
                method: 'POST',
                body: { slug, password: password.trim() },
            });
            setUnlockedPost(full);
            setPassword('');
        } catch (err) {
            if (isApiError(err) && err.status === 401) {
                setUnlockError('Invalid password. Please try again.');
            } else {
                setUnlockError('Something went wrong. Please try again.');
            }
        } finally {
            setIsUnlocking(false);
        }
    };

    const handleSubmitComment = () => {
        if (!commentDraft.trim() || !commentsTargetId) return;
        if (!user?.id) {
            setCommentError('Please sign in to comment.');
            return;
        }
        setCommentError(null);
        createComment.mutate(
            {
                body: commentDraft.trim(),
                targetType: COMMENTS_TARGET_TYPE,
                targetId: commentsTargetId,
            },
            {
                onSuccess: () => {
                    setCommentDraft('');
                    refetchComments();
                },
                onError: (err) => {
                    setCommentError(err instanceof Error ? err.message : 'Failed to post comment.');
                },
            },
        );
    };

    // Convert post to BlogPostData format
    const blogPostData: BlogPostData = {
        id: displayPost.id,
        title: displayPost.title,
        slug: displayPost.slug,
        excerpt: displayPost.excerpt,
        blurbText: displayPost.blurbText,
        photoNote: displayPost.photoNote,
        photoAlbum: displayPost.photoAlbum,
        content: displayPost.content,
        contentType: displayPost.contentType,
        status: displayPost.status,
        heroImage: displayPost.heroImage,
        seoMeta: displayPost.seoMeta,
        footnotes: displayPost.footnotes,
        authorId: displayPost.authorId,
        author: displayPost.author,
        readingTimeMinutes: displayPost.readingTimeMinutes,
        wordCount: displayPost.wordCount,
        isFeatured: displayPost.isFeatured,
        publishedAt: displayPost.publishedAt,
        createdAt: null,
        seriesId: displayPost.seriesId,
        seriesOrder: displayPost.seriesOrder,
        seriesTitle: series?.title || null,
        seriesTotalParts: seriesPosts.length > 0 ? seriesPosts.length : null,
        originalDate: displayPost.originalDate,
        isProtected: displayPost.isProtected,
        passwordHint: displayPost.passwordHint,
    };

    // Generate SEO meta tags
    const isBlurb = displayPost.contentType === 'blurb';
    const isPhotoJournal = displayPost.contentType === 'photo';
    const seoTitle =
        displayPost.seoMeta?.title ||
        (isBlurb ? `Thought${displayPost.author?.name ? ` by ${displayPost.author.name}` : ''}` : displayPost.title);
    const seoDescription =
        displayPost.seoMeta?.description ||
        (isBlurb
            ? displayPost.blurbText
            : isPhotoJournal
              ? displayPost.photoNote || displayPost.excerpt
              : displayPost.excerpt) ||
        undefined;
    const seoKeywords = displayPost.seoMeta?.keywords;
    const canonicalUrl =
        displayPost.seoMeta?.canonicalUrl || (typeof window !== 'undefined' ? window.location.href : undefined);
    const ogImage = displayPost.seoMeta?.ogImage || displayPost.heroImage?.url;

    return (
        <BlogMeasure>
            {/* SEO Meta Tags */}
            <SEOHead
                title={seoTitle}
                description={seoDescription}
                keywords={seoKeywords}
                canonicalUrl={canonicalUrl}
                ogImage={ogImage}
                ogType="article"
                twitterCard={isBlurb ? 'summary' : 'summary_large_image'}
                noIndex={displayPost.seoMeta?.noIndex}
                noFollow={displayPost.seoMeta?.noFollow}
                publishedTime={displayPost.publishedAt || undefined}
                author={displayPost.author?.name || undefined}
            />

            {/* Back link + Share + Edit (author only) */}
            <div className="mb-10 flex items-center justify-between gap-4">
                <BlogBackLink />
                <div className="flex items-center gap-3">
                    <ShareButton
                        url={typeof window !== 'undefined' ? window.location.href : ''}
                        title={displayPost.title}
                        description={displayPost.excerpt ?? undefined}
                    />
                    {user?.id && displayPost.authorId && user.id === displayPost.authorId && (
                        // /studio is the editorial surface gated on posts:update — the author of this
                        // post holds it. /admin/content/blog additionally requires org:admin, which an
                        // author does not have, so it would send them to a privilege fallback instead.
                        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-muted-foreground" asChild>
                            <Link to="/studio/$postId/edit" params={{ postId: displayPost.id }}>
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                            </Link>
                        </Button>
                    )}
                </div>
            </div>

            {/* Original date — when the content was originally written (diary, republished essay, etc.) */}
            {displayPost.originalDate && (
                <p className="mb-6 text-[0.8125rem] text-muted-foreground">
                    Originally written {displayPost.originalDate.label}
                </p>
            )}

            {/* Lock screen for password-protected posts */}
            {isLocked && (
                <div className="flex flex-col py-16">
                    <Lock className="mb-6 h-5 w-5 text-muted-foreground" aria-hidden />
                    <h1 className="font-serif text-3xl tracking-[-0.03em]">{displayPost.title}</h1>
                    {displayPost.excerpt && (
                        <p className="mt-4 max-w-lg font-serif text-lg leading-relaxed text-muted-foreground">
                            {displayPost.excerpt}
                        </p>
                    )}
                    {displayPost.passwordHint && (
                        <p className="mt-4 text-[0.8125rem] text-muted-foreground">Hint: {displayPost.passwordHint}</p>
                    )}
                    <form onSubmit={handleUnlock} className="mt-8 w-full max-w-sm space-y-4">
                        <Input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                setUnlockError(null);
                            }}
                            className="border-0 border-b border-border/70 bg-transparent px-0 shadow-none focus-visible:ring-0"
                            autoComplete="current-password"
                            disabled={isUnlocking}
                        />
                        {unlockError && <p className="text-sm text-destructive">{unlockError}</p>}
                        <Button
                            type="submit"
                            variant="ghost"
                            className="-ml-3"
                            disabled={isUnlocking || !password.trim()}
                        >
                            {isUnlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Unlock'}
                        </Button>
                    </form>
                </div>
            )}

            {/* Blog Renderer (full content when not locked) */}
            {!isLocked && (
                <>
                    <MediaLightboxProvider variant="immersive">
                        <BlogRenderer
                            key={studioReady ? 'studio-ready' : 'studio-loading'}
                            post={blogPostData}
                            showHeroImage
                            showTitle
                            showMetadata
                            showExcerpt
                            showFootnotes
                            showSeries
                            formatDate={formatDate}
                            renderSeriesNav={(_post) => {
                                if (!series || seriesPosts.length <= 1) return null;
                                return (
                                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                        {prevPost && (
                                            <Link
                                                to="/blog/$slug"
                                                params={{ slug: prevPost.slug }}
                                                className="group min-w-0 text-[0.8125rem] text-muted-foreground outline-none hover:text-foreground"
                                            >
                                                <span className="block text-[0.75rem]">Previous</span>
                                                <span className="mt-1 block truncate font-serif text-base text-foreground underline-offset-4 group-hover:underline">
                                                    {prevPost.title}
                                                </span>
                                            </Link>
                                        )}
                                        {nextPost && (
                                            <Link
                                                to="/blog/$slug"
                                                params={{ slug: nextPost.slug }}
                                                className="group min-w-0 text-[0.8125rem] text-muted-foreground outline-none hover:text-foreground sm:text-right"
                                            >
                                                <span className="block text-[0.75rem]">Next</span>
                                                <span className="mt-1 block truncate font-serif text-base text-foreground underline-offset-4 group-hover:underline">
                                                    {nextPost.title}
                                                </span>
                                            </Link>
                                        )}
                                    </div>
                                );
                            }}
                        />
                    </MediaLightboxProvider>

                    {(displayPost.tags && displayPost.tags.length > 0) ||
                    (displayPost.categories && displayPost.categories.length > 0) ? (
                        <div className="mt-10 flex flex-wrap gap-x-4 gap-y-2 text-[0.8125rem] text-muted-foreground">
                            {displayPost.tags?.map((tag) => (
                                <Link
                                    key={tag.id}
                                    to="/blog/tag/$slug"
                                    params={{ slug: tag.slug }}
                                    className="hover:text-foreground"
                                >
                                    #{tag.name}
                                </Link>
                            ))}
                            {displayPost.categories?.map((cat) => (
                                <Link
                                    key={cat.id}
                                    to="/blog/category/$slug"
                                    params={{ slug: cat.slug }}
                                    className="hover:text-foreground"
                                >
                                    {cat.name}
                                </Link>
                            ))}
                        </div>
                    ) : null}

                    {allowComments && (
                        <section className="mt-16 border-t border-border/70 pt-10">
                            <div className="flex items-baseline justify-between gap-4">
                                <h2 className="font-serif text-xl tracking-tight">Comments</h2>
                                <span className="text-[0.75rem] tabular-nums text-muted-foreground">
                                    {comments.length}
                                </span>
                            </div>

                            {commentError && <p className="mt-4 text-sm text-destructive">{commentError}</p>}

                            {!user?.id && (
                                <p className="mt-5 text-sm text-muted-foreground">
                                    <Link to="/login" className="underline underline-offset-4 hover:text-foreground">
                                        Sign in
                                    </Link>{' '}
                                    to leave a note.
                                </p>
                            )}

                            <div className="mt-6 space-y-3">
                                <Textarea
                                    placeholder="Write a comment…"
                                    value={commentDraft}
                                    onChange={(e) => setCommentDraft(e.target.value)}
                                    className="min-h-24 border-border/60 bg-transparent text-sm shadow-none"
                                    disabled={!user?.id}
                                />
                                <div className="flex justify-end">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={handleSubmitComment}
                                        disabled={!commentDraft.trim() || !user?.id || createComment.isPending}
                                    >
                                        {createComment.isPending ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : null}
                                        Post
                                    </Button>
                                </div>
                            </div>

                            {commentsError && (
                                <p className="mt-4 text-sm text-destructive">
                                    {commentsError.message || 'Failed to load comments.'}
                                </p>
                            )}

                            <div className="mt-6">
                                {isLoadingComments ? (
                                    <div className="space-y-4 py-4">
                                        {[1, 2, 3].map((i) => (
                                            <div key={i} className="flex gap-3">
                                                <Skeleton className="h-8 w-8 rounded-full" />
                                                <div className="flex-1 space-y-2">
                                                    <Skeleton className="h-4 w-24" />
                                                    <Skeleton className="h-4 w-full" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : comments.length === 0 ? (
                                    <p className="py-6 text-sm text-muted-foreground">No comments yet.</p>
                                ) : (
                                    <div>
                                        {(commentsByParent.get(null) ?? []).map((comment) => (
                                            <CommentNode
                                                key={comment.id}
                                                comment={comment}
                                                depth={0}
                                                commentsByParent={commentsByParent}
                                                canReply={!!user?.id}
                                                replyingToId={replyingToId}
                                                onToggleReply={toggleReply}
                                                onSubmitReply={handleSubmitReply}
                                                isSubmittingReply={createComment.isPending}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </section>
                    )}
                </>
            )}

            {/* Series Navigation - All posts */}
            {series && seriesPosts.length > 1 && (
                <nav className="mt-16 border-t border-border/70 pt-10">
                    <h2 className="font-serif text-xl tracking-tight">This series</h2>
                    <ol className="mt-5 space-y-2">
                        {seriesPosts.map((p, index) => (
                            <li key={p.id} className="flex gap-4 text-[0.975rem]">
                                <span className="w-6 shrink-0 tabular-nums text-muted-foreground">
                                    {String(index + 1).padStart(2, '0')}
                                </span>
                                {p.id === displayPost.id ? (
                                    <span className="font-medium">{p.title}</span>
                                ) : (
                                    <Link
                                        to="/blog/$slug"
                                        params={{ slug: p.slug }}
                                        className="text-muted-foreground hover:text-foreground"
                                    >
                                        {p.title}
                                    </Link>
                                )}
                            </li>
                        ))}
                    </ol>
                </nav>
            )}

            <div className="mt-16 border-t border-border/70 pt-8">
                <BlogBackLink label="All writing" />
            </div>
        </BlogMeasure>
    );
}

export default BlogDetailPage;
