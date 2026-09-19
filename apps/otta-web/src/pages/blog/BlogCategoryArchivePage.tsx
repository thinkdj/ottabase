/**
 * Public Blog Category Archive Page
 *
 * Shows category details and a list of posts in that category.
 */
import { SEOHead } from '@/components/SEOHead';
import { BLOG_LIST_QUERY_CONFIG } from '@/config/queryConfig';
import { formatDate, getActiveTheme, type BlogPostData } from '@ottabase/ottablog';
import { defaultTheme } from '@ottabase/ottablog/renderer';
import { useApiQuery } from '@ottabase/ottaorm/client';
import { Link, useParams } from '@tanstack/react-router';
import { useMemo } from 'react';
import { ArchiveMasthead, BlogBackLink, BlogEmpty, BlogListSkeleton, BlogMeasure, BlogNotFound } from './blogUi';

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

    const { data: category, isLoading: isLoadingCategory } = useApiQuery<CategoryInfo>({
        entity: 'categories',
        queryKey: ['by-slug', slug],
        endpoint: `/api/blog/categories/by-slug/${encodeURIComponent(slug ?? '')}`,
        queryOptions: { enabled: !!slug, staleTime: 60_000 },
    });

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
            <BlogMeasure className="space-y-8">
                <BlogListSkeleton />
            </BlogMeasure>
        );
    }

    if (!category) {
        return <BlogNotFound title="Category not found" body="That category doesn't exist on this site." />;
    }

    return (
        <BlogMeasure className={theme.config?.classes?.archiveContainer || 'space-y-10'}>
            <SEOHead title={category.name} description={category.description || `Writing in ${category.name}`} />

            <BlogBackLink />

            <ArchiveMasthead
                kicker="Category"
                title={category.name}
                description={category.description}
                countLabel={`${posts.length} ${posts.length === 1 ? 'piece' : 'pieces'}`}
            />

            {posts.length === 0 ? (
                <BlogEmpty>Nothing in {category.name} yet.</BlogEmpty>
            ) : (
                <div className="space-y-6">
                    {posts.map((post) => (
                        <Link
                            key={post.id}
                            to="/blog/$slug"
                            params={{ slug: post.slug }}
                            className="group block outline-none focus-visible:underline"
                        >
                            {renderCard ? (
                                renderCard(post, {
                                    post,
                                    showHeroImage: false,
                                    showExcerpt: true,
                                    showMetadata: true,
                                    formatDate,
                                })
                            ) : (
                                <article>
                                    <h2 className="font-serif text-xl tracking-tight">{post.title}</h2>
                                    {post.excerpt && (
                                        <p className="mt-1 text-[0.9375rem] leading-relaxed text-muted-foreground">
                                            {post.excerpt}
                                        </p>
                                    )}
                                </article>
                            )}
                        </Link>
                    ))}
                </div>
            )}
        </BlogMeasure>
    );
}

export default BlogCategoryArchivePage;
