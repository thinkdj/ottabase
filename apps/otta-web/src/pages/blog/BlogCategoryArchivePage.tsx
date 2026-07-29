/**
 * Public Blog Category Archive Page
 *
 * Shows category details (name, description) and a list of posts in that category.
 */
import { SEOHead } from '@/components/SEOHead';
import { BLOG_LIST_QUERY_CONFIG } from '@/config/queryConfig';
import { formatDate, getActiveTheme, type BlogPostData } from '@ottabase/ottablog';
import { defaultTheme } from '@ottabase/ottablog/renderer';
import { useApiQuery } from '@ottabase/ottaorm/client';
import { Button } from '@ottabase/ui-shadcn';
import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, FolderTree } from 'lucide-react';
import { useMemo } from 'react';

interface BlogPostsResponse {
    data: BlogPostData[];
    pagination: { page: number; perPage: number; total: number; totalPages: number };
}

interface CategoryInfo {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
}

export function BlogCategoryArchivePage() {
    const params = useParams({ strict: false });
    const slug = (params as { slug?: string }).slug;
    const theme = useMemo(() => getActiveTheme() ?? defaultTheme, []);
    const renderCard = theme.renderers.renderCard ?? defaultTheme.renderers.renderCard;

    // Fetch category info
    const { data: category, isLoading: isLoadingCategory } = useApiQuery<CategoryInfo>({
        entity: 'categories',
        queryKey: ['by-slug', slug],
        endpoint: `/api/blog/categories/by-slug/${encodeURIComponent(slug ?? '')}`,
        queryOptions: { enabled: !!slug, staleTime: 60_000 },
    });

    // Fetch posts in this category
    const { data: postsResponse, isLoading: isLoadingPosts } = useApiQuery<BlogPostsResponse>({
        entity: 'posts',
        queryKey: ['category-archive', slug],
        endpoint: `/api/blog/posts?categoryId=${encodeURIComponent(category?.id ?? '')}&perPage=50`,
        queryOptions: { enabled: !!category?.id, ...BLOG_LIST_QUERY_CONFIG },
    });

    const posts = postsResponse?.data ?? [];
    const isLoading = isLoadingCategory || isLoadingPosts;

    if (isLoading) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-8 space-y-8" aria-busy="true">
                <span className="sr-only">Loading category...</span>
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

    if (!category) {
        return (
            <div className="mx-auto max-w-md rounded-xl bg-muted/40 px-6 py-12 text-center">
                <h1 className="text-lg font-semibold tracking-tight">Category Not Found</h1>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    The category you're looking for doesn't exist.
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
            <SEOHead
                title={`${category.name} — Blog`}
                description={category.description || `All blog posts in the ${category.name} category`}
            />

            {/* Back link */}
            <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit gap-1.5 text-muted-foreground">
                <Link to="/blog">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Blog
                </Link>
            </Button>

            {/* Category header */}
            <div className="space-y-1.5">
                <p className="flex items-center gap-1.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                    <FolderTree className="h-3.5 w-3.5" />
                    Category
                </p>
                <h1 className={theme.config?.classes?.archiveTitle || 'text-3xl font-bold tracking-tight'}>
                    {category.name}
                </h1>
                {category.description && <p className="max-w-3xl text-muted-foreground">{category.description}</p>}
                <p className="pt-1 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                    {posts.length} {posts.length === 1 ? 'post' : 'posts'}
                </p>
            </div>

            {/* Posts list */}
            {posts.length === 0 ? (
                <div className="rounded-xl bg-muted/40 py-12 text-center">
                    <p className="text-sm text-muted-foreground">No posts found in this category.</p>
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

export default BlogCategoryArchivePage;
