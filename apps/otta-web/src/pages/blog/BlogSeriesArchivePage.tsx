/**
 * Public Blog Series Archive Page
 *
 * Shows series details and an ordered list of posts in the series.
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

    const { data: series, isLoading: isLoadingSeries } = useApiQuery<SeriesInfo>({
        entity: 'post_series',
        queryKey: ['by-slug', slug],
        endpoint: `/api/blog/series/by-slug/${encodeURIComponent(slug ?? '')}`,
        queryOptions: { enabled: !!slug, staleTime: 60_000 },
    });

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
            <BlogMeasure className="space-y-8">
                <BlogListSkeleton />
            </BlogMeasure>
        );
    }

    if (!series) {
        return <BlogNotFound title="Series not found" body="That series doesn't exist on this site." />;
    }

    const statusLabel = series.status && series.status !== 'published' ? series.status : null;

    return (
        <BlogMeasure className={theme.config?.classes?.archiveContainer || 'space-y-10'}>
            <SEOHead title={series.title} description={series.description || `The “${series.title}” series`} />

            <BlogBackLink />

            <ArchiveMasthead
                kicker={statusLabel ? `Series · ${statusLabel}` : 'Series'}
                title={series.title}
                description={series.description}
                countLabel={`${posts.length} ${posts.length === 1 ? 'part' : 'parts'}`}
            />

            {posts.length === 0 ? (
                <BlogEmpty>No parts in this series yet.</BlogEmpty>
            ) : (
                <div className="space-y-6">
                    {posts.map((post, index) => {
                        const postWithOrder = { ...post, seriesOrder: post.seriesOrder ?? index + 1 };
                        return (
                            <Link
                                key={post.id}
                                to="/blog/$slug"
                                params={{ slug: post.slug }}
                                className="group block outline-none focus-visible:underline"
                            >
                                {renderCard ? (
                                    renderCard(postWithOrder, {
                                        post: postWithOrder,
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
                        );
                    })}
                </div>
            )}
        </BlogMeasure>
    );
}

export default BlogSeriesArchivePage;
