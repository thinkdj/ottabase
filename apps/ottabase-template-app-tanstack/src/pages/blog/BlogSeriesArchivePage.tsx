/**
 * Public Blog Series Archive Page
 *
 * Shows series details (title, description) and an ordered list of posts in the series.
 */
import { SEOHead } from '@/components/SEOHead';
import { BLOG_LIST_QUERY_CONFIG } from '@/config/queryConfig';
import { defaultTheme, formatDate, getActiveTheme, type BlogPostData } from '@ottabase/ottablog';
import { useApiQuery } from '@ottabase/ottaorm/client';
import { Badge, Button } from '@ottabase/ui-shadcn';
import { Link, useParams } from '@tanstack/react-router';
import { BookOpen, ChevronLeft } from 'lucide-react';
import { useMemo } from 'react';

interface BlogPostsResponse {
    data: BlogPostData[];
    pagination: { page: number; perPage: number; total: number; totalPages: number };
}

interface SeriesInfo {
    id: string;
    title: string;
    slug: string;
    description?: string | null;
    status?: string;
}

export function BlogSeriesArchivePage() {
    const params = useParams({ strict: false });
    const slug = (params as { slug?: string }).slug;
    const theme = useMemo(() => getActiveTheme() ?? defaultTheme, []);
    const renderCard = theme.renderers.renderCard ?? defaultTheme.renderers.renderCard;

    // Fetch series info
    const { data: series, isLoading: isLoadingSeries } = useApiQuery<SeriesInfo>({
        entity: 'post_series',
        queryKey: ['by-slug', slug],
        endpoint: `/api/blog/series/by-slug/${encodeURIComponent(slug ?? '')}`,
        queryOptions: { enabled: !!slug, staleTime: 60_000 },
    });

    // Fetch posts in this series, ordered by seriesOrder
    const { data: postsResponse, isLoading: isLoadingPosts } = useApiQuery<BlogPostsResponse>({
        entity: 'posts',
        queryKey: ['series-archive', slug],
        endpoint: `/api/blog/posts?seriesId=${encodeURIComponent(series?.id ?? '')}&orderBy=seriesOrder&orderDirection=asc&perPage=50`,
        queryOptions: { enabled: !!series?.id, ...BLOG_LIST_QUERY_CONFIG },
    });

    const posts = postsResponse?.data ?? [];
    const isLoading = isLoadingSeries || isLoadingPosts;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!series) {
        return (
            <div className="text-center py-16">
                <h1 className="text-2xl font-bold mb-4">Series Not Found</h1>
                <p className="text-muted-foreground mb-6">The series you're looking for doesn't exist.</p>
                <Button asChild>
                    <Link to="/blog">
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back to Blog
                    </Link>
                </Button>
            </div>
        );
    }

    return (
        <div className={theme.config?.classes?.archiveContainer || 'max-w-4xl mx-auto px-4 py-8 space-y-8'}>
            <SEOHead
                title={`${series.title} — Blog Series`}
                description={series.description || `All posts in the "${series.title}" series`}
            />

            {/* Back link */}
            <Button variant="ghost" size="sm" asChild>
                <Link to="/blog">
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Back to Blog
                </Link>
            </Button>

            {/* Series header */}
            <div className="space-y-2">
                <div className="flex items-center gap-3">
                    <BookOpen className="h-6 w-6 text-muted-foreground" />
                    <h1 className={theme.config?.classes?.archiveTitle || 'text-3xl font-bold'}>{series.title}</h1>
                    {series.status && (
                        <Badge variant={series.status === 'completed' ? 'default' : 'secondary'}>{series.status}</Badge>
                    )}
                </div>
                {series.description && <p className="text-muted-foreground">{series.description}</p>}
                <p className="text-sm text-muted-foreground">
                    {posts.length} {posts.length === 1 ? 'part' : 'parts'}
                </p>
            </div>

            {/* Posts list (ordered) */}
            {posts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No posts in this series yet.</p>
            ) : (
                <div className="space-y-4">
                    {posts.map((post, index) => {
                        // Ensure series order is always set for renderCard
                        const postWithOrder = { ...post, seriesOrder: post.seriesOrder ?? index + 1 };
                        return (
                            <Link key={post.id} to="/blog/$slug" params={{ slug: post.slug }}>
                                {renderCard ? (
                                    renderCard(postWithOrder, {
                                        post: postWithOrder,
                                        showHeroImage: true,
                                        showExcerpt: true,
                                        showMetadata: true,
                                        formatDate,
                                    })
                                ) : (
                                    <article className="p-4 border rounded hover:shadow-sm transition-shadow">
                                        <h2 className="font-semibold">{post.title}</h2>
                                        {post.excerpt && (
                                            <p className="text-sm text-muted-foreground mt-1">{post.excerpt}</p>
                                        )}
                                    </article>
                                )}
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default BlogSeriesArchivePage;
