/**
 * Public Blog Tag Archive Page
 *
 * Shows tag details (name, description) and a list of posts tagged with it.
 */
import { SEOHead } from '@/components/SEOHead';
import { BLOG_LIST_QUERY_CONFIG } from '@/config/queryConfig';
import { formatDate, getActiveTheme, type BlogPostData } from '@ottabase/ottablog';
import { defaultTheme } from '@ottabase/ottablog/renderer';
import { useApiQuery } from '@ottabase/ottaorm/client';
import { Button } from '@ottabase/ui-shadcn';
import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, Tag } from 'lucide-react';
import { useMemo } from 'react';

interface BlogPostsResponse {
    data: BlogPostData[];
    pagination: { page: number; perPage: number; total: number; totalPages: number };
}

interface TagInfo {
    id: string;
    name: string;
    slug: string;
    color?: string;
    type?: string;
}

export function BlogTagArchivePage() {
    const params = useParams({ strict: false });
    const slug = (params as { slug?: string }).slug;
    const theme = useMemo(() => getActiveTheme() ?? defaultTheme, []);
    const renderCard = theme.renderers.renderCard ?? defaultTheme.renderers.renderCard;

    // Fetch tag info
    const { data: tag, isLoading: isLoadingTag } = useApiQuery<TagInfo>({
        entity: 'post_tags',
        queryKey: ['by-slug', slug],
        endpoint: `/api/blog/tags/by-slug/${encodeURIComponent(slug ?? '')}`,
        queryOptions: { enabled: !!slug, staleTime: 60_000 },
    });

    // Fetch posts with this tag
    const { data: postsResponse, isLoading: isLoadingPosts } = useApiQuery<BlogPostsResponse>({
        entity: 'posts',
        queryKey: ['tag-archive', slug],
        endpoint: `/api/blog/posts?tagId=${encodeURIComponent(tag?.id ?? '')}&perPage=50`,
        queryOptions: { enabled: !!tag?.id, ...BLOG_LIST_QUERY_CONFIG },
    });

    const posts = postsResponse?.data ?? [];
    const isLoading = isLoadingTag || isLoadingPosts;

    if (isLoading) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-8 space-y-8" aria-busy="true">
                <span className="sr-only">Loading tag...</span>
                <div className="h-8 w-32 animate-pulse rounded-lg bg-muted/40" />
                <div className="space-y-2">
                    <div className="h-3 w-24 animate-pulse rounded-full bg-muted/40" />
                    <div className="h-9 w-64 animate-pulse rounded-lg bg-muted/40" />
                </div>
                <div className="space-y-4">
                    <div className="h-28 animate-pulse rounded-xl bg-muted/40" />
                    <div className="h-28 animate-pulse rounded-xl bg-muted/40" />
                    <div className="h-28 animate-pulse rounded-xl bg-muted/40" />
                </div>
            </div>
        );
    }

    if (!tag) {
        return (
            <div className="mx-auto max-w-md rounded-xl bg-muted/40 px-6 py-12 text-center">
                <h1 className="text-lg font-semibold tracking-tight">Tag Not Found</h1>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    The tag you're looking for doesn't exist.
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-4 gap-1.5 text-muted-foreground">
                    <Link to="/blog">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Blog
                    </Link>
                </Button>
            </div>
        );
    }

    return (
        <div className={theme.config?.classes?.archiveContainer || 'max-w-4xl mx-auto px-4 py-8 space-y-8'}>
            <SEOHead title={`Posts tagged "${tag.name}"`} description={`All blog posts tagged with ${tag.name}`} />

            {/* Back link */}
            <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit gap-1.5 text-muted-foreground">
                <Link to="/blog">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Blog
                </Link>
            </Button>

            {/* Tag header */}
            <div className="space-y-1.5">
                <p className="flex items-center gap-1.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                    <Tag className="h-3.5 w-3.5" />
                    Tag
                </p>
                <h1 className={theme.config?.classes?.archiveTitle || 'text-3xl font-bold tracking-tight'}>
                    {tag.name}
                </h1>
                <p className="pt-1 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                    {posts.length} {posts.length === 1 ? 'post' : 'posts'} tagged with &quot;{tag.name}&quot;
                </p>
            </div>

            {/* Posts list */}
            {posts.length === 0 ? (
                <div className="rounded-xl bg-muted/40 py-12 text-center">
                    <p className="text-sm text-muted-foreground">No posts found with this tag.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {posts.map((post) => (
                        <Link
                            key={post.id}
                            to="/blog/$slug"
                            params={{ slug: post.slug }}
                            className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                            {renderCard ? (
                                renderCard(post, {
                                    post,
                                    showHeroImage: true,
                                    showExcerpt: true,
                                    showMetadata: true,
                                    formatDate,
                                })
                            ) : (
                                <article className="rounded-xl bg-muted/40 p-5 transition-colors duration-normal group-hover:bg-muted/70">
                                    <h2 className="text-[0.9375rem] font-semibold">{post.title}</h2>
                                    {post.excerpt && (
                                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                                            {post.excerpt}
                                        </p>
                                    )}
                                </article>
                            )}
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}

export default BlogTagArchivePage;
