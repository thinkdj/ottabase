/**
 * Public Blog Tag Archive Page
 *
 * Shows tag details and a list of posts tagged with it.
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

    const { data: tag, isLoading: isLoadingTag } = useApiQuery<TagInfo>({
        entity: 'post_tags',
        queryKey: ['by-slug', slug],
        endpoint: `/api/blog/tags/by-slug/${encodeURIComponent(slug ?? '')}`,
        queryOptions: { enabled: !!slug, staleTime: 60_000 },
    });

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
            <BlogMeasure className="space-y-8">
                <BlogListSkeleton />
            </BlogMeasure>
        );
    }

    if (!tag) {
        return <BlogNotFound title="Tag not found" body="That tag doesn't exist on this site." />;
    }

    return (
        <BlogMeasure className={theme.config?.classes?.archiveContainer || 'space-y-10'}>
            <SEOHead title={`#${tag.name}`} description={`Writing tagged ${tag.name}`} />

            <BlogBackLink />

            <ArchiveMasthead
                kicker="Tag"
                title={tag.name}
                countLabel={`${posts.length} ${posts.length === 1 ? 'piece' : 'pieces'}`}
            />

            {posts.length === 0 ? (
                <BlogEmpty>Nothing tagged {tag.name} yet.</BlogEmpty>
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

export default BlogTagArchivePage;
