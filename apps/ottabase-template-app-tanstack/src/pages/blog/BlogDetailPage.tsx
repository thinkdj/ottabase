/**
 * Public Blog Detail Page
 *
 * Displays a single blog post with full content using BlogRenderer.
 */
import type { OutputData } from '@ottabase/ottaeditor';
import { createModelHooks } from '@ottabase/ottaorm/client';
import { Blocks, customRenderers, defaultEJSRConfigs } from '@ottabase/ottarenderer';
import { Button, Card, CardContent } from '@ottabase/ui-shadcn';
import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, Calendar, ChevronLeft, Clock, Layers, User } from 'lucide-react';

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

const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};

export function BlogDetailPage() {
    const params = useParams({ strict: false });
    const slug = (params as { slug?: string }).slug;

    // Fetch post by slug using the new useFind hook
    const { data: post, isLoading: isLoadingPost } = blogPostHooks.useFind('slug', slug || '', {
        enabled: !!slug,
    });

    // Fetch series info if post is part of a series (using useDetail for primary key lookup)
    const { data: series } = blogSeriesHooks.useDetail(post?.seriesId || '', {
        enabled: !!post?.seriesId,
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

    const hasContent = post.content?.blocks && post.content.blocks.length > 0;
    const hasFootnotes = post.footnotes?.blocks && post.footnotes.blocks.length > 0;

    return (
        <article className="max-w-3xl mx-auto">
            {/* Back link */}
            <div className="mb-6">
                <Button variant="ghost" size="sm" asChild>
                    <Link to="/blog">
                        <ChevronLeft className="mr-1 h-4 w-4" />
                        Back to Blog
                    </Link>
                </Button>
            </div>

            {/* Series Banner */}
            {series && (
                <Card className="mb-6 bg-muted/50">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-sm">
                            <Layers className="h-4 w-4 text-primary" />
                            <span className="text-muted-foreground">Part of series:</span>
                            <span className="font-medium">{series.title}</span>
                            {post.seriesOrder && (
                                <span className="text-muted-foreground">
                                    (Part {post.seriesOrder} of {seriesPosts.length})
                                </span>
                            )}
                            {series.isComplete && (
                                <span className="ml-auto text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-0.5 rounded">
                                    Complete
                                </span>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Hero Image */}
            {post.heroImage?.url && (
                <figure className="mb-8">
                    <img
                        src={post.heroImage.url}
                        alt={post.heroImage.alt || post.title}
                        className="w-full rounded-lg object-cover aspect-video"
                    />
                    {post.heroImage.caption && (
                        <figcaption className="mt-2 text-center text-sm text-muted-foreground">
                            {post.heroImage.caption}
                        </figcaption>
                    )}
                </figure>
            )}

            {/* Content Type Badge */}
            {post.contentType !== 'blog' && (
                <span className="inline-block mb-4 px-3 py-1 bg-secondary text-secondary-foreground text-sm rounded-full capitalize">
                    {post.contentType}
                </span>
            )}

            {/* Title */}
            <h1 className="text-4xl font-bold mb-4 leading-tight">{post.title}</h1>

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-4 mb-8 text-sm text-muted-foreground">
                {post.authorName && (
                    <div className="flex items-center gap-2">
                        {post.authorAvatar ? (
                            <img
                                src={post.authorAvatar}
                                alt={post.authorName}
                                className="w-8 h-8 rounded-full object-cover"
                            />
                        ) : (
                            <User className="h-4 w-4" />
                        )}
                        <span className="font-medium text-foreground">{post.authorName}</span>
                    </div>
                )}
                {post.publishedAt && (
                    <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                    </div>
                )}
                {post.readingTimeMinutes && (
                    <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{post.readingTimeMinutes} min read</span>
                    </div>
                )}
                {post.isFeatured && (
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-medium">Featured</span>
                )}
            </div>

            {/* Excerpt */}
            {post.excerpt && <p className="text-xl text-muted-foreground mb-8 leading-relaxed">{post.excerpt}</p>}

            {/* Main Content */}
            {hasContent && (
                <div className="prose prose-slate dark:prose-invert max-w-none mb-12">
                    <Blocks data={post.content!} renderers={customRenderers} config={defaultEJSRConfigs} />
                </div>
            )}

            {/* Footnotes */}
            {hasFootnotes && (
                <aside className="border-t pt-8 mt-12">
                    <h2 className="text-xl font-semibold mb-4">Footnotes</h2>
                    <div className="prose prose-sm prose-slate dark:prose-invert max-w-none text-muted-foreground">
                        <Blocks data={post.footnotes!} renderers={customRenderers} config={defaultEJSRConfigs} />
                    </div>
                </aside>
            )}

            {/* Series Navigation */}
            {series && seriesPosts.length > 1 && (
                <nav className="border-t pt-8 mt-12">
                    <h2 className="text-xl font-semibold mb-4">More in this series</h2>
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

                    {/* All posts in series */}
                    <details className="mt-6">
                        <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                            View all {seriesPosts.length} posts in this series
                        </summary>
                        <ol className="mt-4 space-y-2 list-decimal list-inside">
                            {seriesPosts.map((p, index) => (
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
        </article>
    );
}

export default BlogDetailPage;
