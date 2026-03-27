/**
 * Public Blog Detail Page
 *
 * Displays a single blog post with full content using BlogRenderer.
 * Uses public API so protected posts return without body until unlocked.
 */
import { SEOHead } from '@/components/SEOHead';
import { BLOG_DETAIL_QUERY_CONFIG, BLOG_LIST_QUERY_CONFIG } from '@/config/queryConfig';
import { api, isApiError } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { useBlogStudio } from '@/ottabase/blog/BlogStudioContext';
import { BlogRenderer, formatDate, type BlogPostData } from '@ottabase/ottablog';
import type { OutputData } from '@ottabase/ottaeditor';
import { createModelHooks, useApiQuery } from '@ottabase/ottaorm/client';
import { Badge, Button, Input } from '@ottabase/ui-shadcn';
import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, ChevronLeft, FolderTree, Loader2, Lock, Pencil, Tag } from 'lucide-react';
import { useState } from 'react';

interface BlogPost {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    content: OutputData | null;
    contentType: string;
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
    authorName: string | null;
    authorAvatar: string | null;
    readingTimeMinutes: number | null;
    wordCount: number | null;
    isFeatured: boolean;
    isProtected?: boolean;
    passwordHint?: string | null;
    publishedAt: string | null;
    seriesId: string | null;
    seriesOrder: number | null;
    tags?: { id: string; name: string; slug: string }[];
    categories?: { id: string; name: string; slug: string }[];
    categoryName?: string | null;
    viewCount?: number;
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

export function BlogDetailPage() {
    const params = useParams({ strict: false });
    const slug = (params as { slug?: string }).slug;
    const { user } = useSession({ skipAutoSync: true });
    const { isReady: studioReady } = useBlogStudio();
    const [unlockedPost, setUnlockedPost] = useState<BlogPost | null>(null);
    const [password, setPassword] = useState('');
    const [unlockError, setUnlockError] = useState<string | null>(null);
    const [isUnlocking, setIsUnlocking] = useState(false);

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

    // Loading state
    if (isLoadingPost) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    // Not found
    if (!post) {
        return (
            <div className="text-center py-16">
                <h1 className="text-2xl font-bold mb-4">Post Not Found</h1>
                <p className="text-muted-foreground mb-6">
                    The post you're looking for doesn't exist or has been removed.
                </p>
                <Button asChild>
                    <Link to="/blog">
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back to Blog
                    </Link>
                </Button>
            </div>
        );
    }

    const displayPost = unlockedPost ?? post;
    const isLocked = !!(displayPost.isProtected && !displayPost.content);

    const handleUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        setUnlockError(null);
        if (!password.trim() || !slug) return;
        setIsUnlocking(true);
        try {
            const full = await api<BlogPost>('/api/blog/posts/unlock', {
                method: 'POST',
                body: { slug, password: password.trim() },
                skipUnauthorizedHandler: true,
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

    // Convert post to BlogPostData format
    const blogPostData: BlogPostData = {
        id: displayPost.id,
        title: displayPost.title,
        slug: displayPost.slug,
        excerpt: displayPost.excerpt,
        content: displayPost.content,
        contentType: displayPost.contentType,
        status: displayPost.status,
        heroImage: displayPost.heroImage,
        seoMeta: displayPost.seoMeta,
        footnotes: displayPost.footnotes,
        authorId: displayPost.authorId,
        authorName: displayPost.authorName,
        authorEmail: null,
        authorAvatar: displayPost.authorAvatar,
        readingTimeMinutes: displayPost.readingTimeMinutes,
        wordCount: displayPost.wordCount,
        isFeatured: displayPost.isFeatured,
        publishedAt: displayPost.publishedAt,
        createdAt: null,
        seriesId: displayPost.seriesId,
        seriesOrder: displayPost.seriesOrder,
        seriesTitle: series?.title || null,
        seriesTotalParts: seriesPosts.length > 0 ? seriesPosts.length : null,
        isProtected: displayPost.isProtected,
        passwordHint: displayPost.passwordHint,
    };

    // Generate SEO meta tags
    const seoTitle = displayPost.seoMeta?.title || displayPost.title;
    const seoDescription = displayPost.seoMeta?.description || displayPost.excerpt || undefined;
    const seoKeywords = displayPost.seoMeta?.keywords;
    const canonicalUrl =
        displayPost.seoMeta?.canonicalUrl || (typeof window !== 'undefined' ? window.location.href : undefined);
    const ogImage = displayPost.seoMeta?.ogImage || displayPost.heroImage?.url;

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            {/* SEO Meta Tags */}
            <SEOHead
                title={seoTitle}
                description={seoDescription}
                keywords={seoKeywords}
                canonicalUrl={canonicalUrl}
                ogImage={ogImage}
                ogType="article"
                twitterCard="summary_large_image"
                noIndex={displayPost.seoMeta?.noIndex}
                noFollow={displayPost.seoMeta?.noFollow}
                publishedTime={displayPost.publishedAt || undefined}
                author={displayPost.authorName || undefined}
            />

            {/* Back link + Edit (author only) */}
            <div className="mb-6 flex items-center justify-between gap-4">
                <Button variant="ghost" size="sm" asChild>
                    <Link to="/blog">
                        <ChevronLeft className="mr-1 h-4 w-4" />
                        Back to Blog
                    </Link>
                </Button>
                {user?.id && displayPost.authorId && user.id === displayPost.authorId && (
                    <Button variant="outline" size="sm" asChild>
                        <Link to="/admin/blog/$postId/edit" params={{ postId: displayPost.id }}>
                            <Pencil className="mr-1.5 h-4 w-4" />
                            Edit
                        </Link>
                    </Button>
                )}
            </div>

            {/* Lock screen for password-protected posts */}
            {isLocked && (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <div className="rounded-full bg-muted p-6 mb-6 dark:bg-muted/50">
                        <Lock className="h-16 w-16 text-muted-foreground" aria-hidden />
                    </div>
                    <h1 className="text-2xl font-bold mb-2">{displayPost.title}</h1>
                    {displayPost.excerpt && (
                        <p className="text-muted-foreground max-w-lg mb-6">{displayPost.excerpt}</p>
                    )}
                    {displayPost.passwordHint && (
                        <p className="text-sm text-muted-foreground mb-4">Hint: {displayPost.passwordHint}</p>
                    )}
                    <form onSubmit={handleUnlock} className="w-full max-w-sm space-y-4">
                        <Input
                            type="password"
                            placeholder="Enter password"
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                setUnlockError(null);
                            }}
                            className="bg-background dark:bg-background"
                            autoComplete="current-password"
                            disabled={isUnlocking}
                        />
                        {unlockError && <p className="text-sm text-destructive">{unlockError}</p>}
                        <Button type="submit" className="w-full" disabled={isUnlocking || !password.trim()}>
                            {isUnlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Unlock with password'}
                        </Button>
                    </form>
                </div>
            )}

            {/* Blog Renderer (full content when not locked) */}
            {!isLocked && (
                <>
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
                        renderSeriesNav={(post) => {
                            if (!series || seriesPosts.length <= 1) return null;
                            return (
                                <div className="mt-4 pt-4 border-t">
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        {prevPost && (
                                            <Link
                                                to={`/blog/${prevPost.slug}`}
                                                className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                                            >
                                                <ArrowLeft className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                                <div className="min-w-0">
                                                    <div className="text-xs text-muted-foreground mb-1">Previous</div>
                                                    <div className="font-medium truncate">{prevPost.title}</div>
                                                </div>
                                            </Link>
                                        )}
                                        {nextPost && (
                                            <Link
                                                to={`/blog/${nextPost.slug}`}
                                                className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors sm:text-right sm:flex-row-reverse"
                                            >
                                                <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                                <div className="min-w-0">
                                                    <div className="text-xs text-muted-foreground mb-1">Next</div>
                                                    <div className="font-medium truncate">{nextPost.title}</div>
                                                </div>
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            );
                        }}
                    />

                    {/* Tags */}
                    {displayPost.tags && displayPost.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-8">
                            <Tag className="h-4 w-4 text-muted-foreground mt-0.5" />
                            {displayPost.tags.map((tag) => (
                                <Link key={tag.id} to="/blog/tag/$slug" params={{ slug: tag.slug }}>
                                    <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">
                                        {tag.name}
                                    </Badge>
                                </Link>
                            ))}
                        </div>
                    )}

                    {/* Categories */}
                    {displayPost.categories && displayPost.categories.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-4">
                            <FolderTree className="h-4 w-4 text-muted-foreground mt-0.5" />
                            {displayPost.categories.map((cat) => (
                                <Link key={cat.id} to="/blog/category/$slug" params={{ slug: cat.slug }}>
                                    <Badge variant="outline" className="cursor-pointer hover:bg-accent">
                                        {cat.name}
                                    </Badge>
                                </Link>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Series Navigation - All posts */}
            {series && seriesPosts.length > 1 && (
                <nav className="border-t pt-8 mt-12">
                    <h2 className="text-xl font-semibold mb-4">More in this series</h2>
                    <details className="mt-6">
                        <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                            View all {seriesPosts.length} posts in this series
                        </summary>
                        <ol className="mt-4 space-y-2 list-decimal list-inside">
                            {seriesPosts.map((p) => (
                                <li key={p.id} className={p.id === displayPost.id ? 'font-medium' : ''}>
                                    {p.id === displayPost.id ? (
                                        <span>{p.title} (current)</span>
                                    ) : (
                                        <Link to={`/blog/${p.slug}`} className="hover:text-primary transition-colors">
                                            {p.title}
                                        </Link>
                                    )}
                                </li>
                            ))}
                        </ol>
                    </details>
                </nav>
            )}

            {/* Back to blog */}
            <div className="border-t pt-8 mt-12">
                <Button variant="outline" asChild>
                    <Link to="/blog">
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back to all posts
                    </Link>
                </Button>
            </div>
        </div>
    );
}

export default BlogDetailPage;
