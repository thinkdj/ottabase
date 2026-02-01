/**
 * Public Blog Detail Page
 *
 * Displays a single blog post with full content using BlogRenderer.
 */
import { BlogRenderer, formatDate, type BlogPostData } from '@ottabase/ottablog';
import { useBlogStudio } from '@/ottabase/blog/BlogStudioContext';
import { SEOHead } from '@/components/SEOHead';
import { BLOG_DETAIL_QUERY_CONFIG, BLOG_LIST_QUERY_CONFIG } from '@/config/queryConfig';
import type { OutputData } from '@ottabase/ottaeditor';
import { createModelHooks } from '@ottabase/ottaorm/client';
import { Button } from '@ottabase/ui-shadcn';
import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, ChevronLeft } from 'lucide-react';

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
    } | null;
    footnotes: OutputData | null;
    authorId: string | null;
    authorName: string | null;
    authorAvatar: string | null;
    readingTimeMinutes: number | null;
    wordCount: number | null;
    isFeatured: boolean;
    publishedAt: string | null;
    seriesId: string | null;
    seriesOrder: number | null;
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
    const { isReady: studioReady } = useBlogStudio();

    // Fetch post by slug using the new useFind hook
    const { data: post, isLoading: isLoadingPost } = blogPostHooks.useFind('slug', slug || '', {
        enabled: !!slug,
        ...BLOG_DETAIL_QUERY_CONFIG,
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

    // Convert post to BlogPostData format
    const blogPostData: BlogPostData = {
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content,
        contentType: post.contentType,
        status: post.status,
        heroImage: post.heroImage,
        seoMeta: post.seoMeta,
        footnotes: post.footnotes,
        authorId: post.authorId,
        authorName: post.authorName,
        authorEmail: null,
        authorAvatar: post.authorAvatar,
        readingTimeMinutes: post.readingTimeMinutes,
        wordCount: post.wordCount,
        isFeatured: post.isFeatured,
        publishedAt: post.publishedAt,
        createdAt: null,
        seriesId: post.seriesId,
        seriesOrder: post.seriesOrder,
        seriesTitle: series?.title || null,
        seriesTotalParts: seriesPosts.length > 0 ? seriesPosts.length : null,
    };

    // Generate SEO meta tags
    const seoTitle = post.seoMeta?.title || post.title;
    const seoDescription = post.seoMeta?.description || post.excerpt || undefined;
    const seoKeywords = post.seoMeta?.keywords;
    const canonicalUrl =
        post.seoMeta?.canonicalUrl || (typeof window !== 'undefined' ? window.location.href : undefined);
    const ogImage = post.seoMeta?.ogImage || post.heroImage?.url;

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
                noIndex={post.seoMeta?.noIndex}
                noFollow={post.seoMeta?.noFollow}
                publishedTime={post.publishedAt || undefined}
                author={post.authorName || undefined}
            />

            {/* Back link */}
            <div className="mb-6">
                <Button variant="ghost" size="sm" asChild>
                    <Link to="/blog">
                        <ChevronLeft className="mr-1 h-4 w-4" />
                        Back to Blog
                    </Link>
                </Button>
            </div>

            {/* Blog Renderer with hooks and theme support; key forces re-mount when studio state is applied */}
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
                                <li key={p.id} className={p.id === post.id ? 'font-medium' : ''}>
                                    {p.id === post.id ? (
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
