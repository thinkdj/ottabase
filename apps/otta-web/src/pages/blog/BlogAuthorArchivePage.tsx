/**
 * Public Blog Author Archive Page
 *
 * Shows an author (name, avatar) and their published posts. The author card comes from
 * /api/blog/authors/:id, which only answers for users with a published post in this blog.
 */
import { SEOHead } from '@/components/SEOHead';
import { BLOG_LIST_QUERY_CONFIG } from '@/config/queryConfig';
import type { PostAuthor } from '@/types/blog';
import { formatDate, getActiveTheme, type BlogPostData } from '@ottabase/ottablog';
import { defaultTheme } from '@ottabase/ottablog/renderer';
import { useApiQuery } from '@ottabase/ottaorm/client';
import { Avatar, AvatarFallback, AvatarImage, Button } from '@ottabase/ui-shadcn';
import { sanitizeUrl } from '@ottabase/utils/sanitize';
import { Link, useParams, useSearch } from '@tanstack/react-router';
import { localizedPostSearch } from './blogLinks';
import { ArrowLeft, PenLine } from 'lucide-react';
import { useMemo } from 'react';

interface BlogPostsResponse {
    data: BlogPostData[];
    pagination: { page: number; perPage: number; total: number; totalPages: number };
}

export function BlogAuthorArchivePage() {
    const params = useParams({ strict: false });
    const authorId = (params as { authorId?: string }).authorId;
    const searchParams = useSearch({ strict: false }) as { lang?: string };
    const requestedLanguage = searchParams.lang || '';
    const theme = useMemo(() => getActiveTheme() ?? defaultTheme, []);
    const renderCard = theme.renderers.renderCard ?? defaultTheme.renderers.renderCard;

    const { data: author, isLoading: isLoadingAuthor } = useApiQuery<PostAuthor>({
        entity: 'blog_authors',
        queryKey: ['by-id', authorId],
        endpoint: `/api/blog/authors/${encodeURIComponent(authorId ?? '')}`,
        queryOptions: { enabled: !!authorId, staleTime: 60_000 },
    });

    // ponytail: first 50 posts, same as the tag/category archives; add paging when an author outgrows it.
    const { data: postsResponse, isLoading: isLoadingPosts } = useApiQuery<BlogPostsResponse>({
        entity: 'posts',
        queryKey: ['author-archive', authorId, requestedLanguage],
        endpoint:
            `/api/blog/posts?authorId=${encodeURIComponent(author?.id ?? '')}&perPage=50` +
            (requestedLanguage ? '&lang=' + encodeURIComponent(requestedLanguage) : ''),
        queryOptions: { enabled: !!author?.id, ...BLOG_LIST_QUERY_CONFIG },
    });

    const posts = postsResponse?.data ?? [];
    const total = postsResponse?.pagination.total ?? posts.length;
    const name = author?.name || 'Anonymous';
    const isLoading = isLoadingAuthor || isLoadingPosts;

    if (isLoading) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-8 space-y-8" aria-busy="true">
                <span className="sr-only">Loading author...</span>
                <div className="h-8 w-32 animate-pulse rounded-lg bg-muted/40" />
                <div className="flex items-center gap-4">
                    <div className="h-16 w-16 animate-pulse rounded-full bg-muted/40" />
                    <div className="h-9 w-64 animate-pulse rounded-lg bg-muted/40" />
                </div>
                <div className="space-y-4">
                    <div className="h-28 animate-pulse rounded-xl bg-muted/40" />
                    <div className="h-28 animate-pulse rounded-xl bg-muted/40" />
                </div>
            </div>
        );
    }

    if (!author) {
        return (
            <div className="mx-auto max-w-md rounded-xl bg-muted/40 px-6 py-12 text-center">
                <h1 className="text-lg font-semibold tracking-tight">Author Not Found</h1>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    This author hasn't published anything here yet.
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
            <SEOHead title={`Posts by ${name}`} description={`All blog posts written by ${name}`} />

            <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit gap-1.5 text-muted-foreground">
                <Link to="/blog">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Blog
                </Link>
            </Button>

            <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 ring-1 ring-border">
                    {author.image && <AvatarImage src={sanitizeUrl(author.image)} alt="" />}
                    <AvatarFallback className="text-lg font-medium">{name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="space-y-1.5">
                    <p className="flex items-center gap-1.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                        <PenLine className="h-3.5 w-3.5" />
                        Author
                    </p>
                    <h1 className={theme.config?.classes?.archiveTitle || 'text-3xl font-bold tracking-tight'}>
                        {name}
                    </h1>
                    <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                        {total} {total === 1 ? 'post' : 'posts'}
                    </p>
                </div>
            </div>

            {posts.length === 0 ? (
                <div className="rounded-xl bg-muted/40 py-12 text-center">
                    <p className="text-sm text-muted-foreground">No posts in this language yet.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {posts.map((post) => (
                        <Link
                            key={post.id}
                            to="/blog/$slug"
                            params={{ slug: post.slug }}
                            search={localizedPostSearch(post, requestedLanguage)}
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

export default BlogAuthorArchivePage;
