/**
 * Public Blog Tag Archive Page
 *
 * Shows tag details (name, description) and a list of posts tagged with it.
 */
import { SEOHead } from '@/components/SEOHead';
import { BLOG_LIST_QUERY_CONFIG } from '@/config/queryConfig';
import { defaultTheme, formatDate, getActiveTheme, type BlogPostData } from '@ottabase/ottablog';
import { useApiQuery } from '@ottabase/ottaorm/client';
import { Button } from '@ottabase/ui-shadcn';
import { Link, useParams } from '@tanstack/react-router';
import { ChevronLeft, Tag } from 'lucide-react';
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
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!tag) {
        return (
            <div className="text-center py-16">
                <h1 className="text-2xl font-bold mb-4">Tag Not Found</h1>
                <p className="text-muted-foreground mb-6">The tag you're looking for doesn't exist.</p>
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
            <SEOHead title={`Posts tagged "${tag.name}"`} description={`All blog posts tagged with ${tag.name}`} />

            {/* Back link */}
            <Button variant="ghost" size="sm" asChild>
                <Link to="/blog">
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Back to Blog
                </Link>
            </Button>

            {/* Tag header */}
            <div className="space-y-2">
                <div className="flex items-center gap-3">
                    <Tag className="h-6 w-6 text-muted-foreground" />
                    <h1 className={theme.config?.classes?.archiveTitle || 'text-3xl font-bold'}>{tag.name}</h1>
                </div>
                <p className="text-muted-foreground">
                    {posts.length} {posts.length === 1 ? 'post' : 'posts'} tagged with &quot;{tag.name}&quot;
                </p>
            </div>

            {/* Posts list */}
            {posts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No posts found with this tag.</p>
            ) : (
                <div className="space-y-4">
                    {posts.map((post) => (
                        <Link key={post.id} to="/blog/$slug" params={{ slug: post.slug }}>
                            {renderCard ? (
                                renderCard(post, {
                                    post,
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
                    ))}
                </div>
            )}
        </div>
    );
}

export default BlogTagArchivePage;
