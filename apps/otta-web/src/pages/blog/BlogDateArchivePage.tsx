/**
 * Public Blog Date Archive Page
 *
 * Shows posts from a given year or year+month, with prev/next navigation and pagination.
 */
import { SEOHead } from '@/components/SEOHead';
import { BLOG_LIST_QUERY_CONFIG } from '@/config/queryConfig';
import { formatDate, getActiveTheme, type BlogPostData } from '@ottabase/ottablog';
import { defaultTheme } from '@ottabase/ottablog/renderer';
import { useApiQuery } from '@ottabase/ottaorm/client';
import { Button } from '@ottabase/ui-shadcn';
import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const MONTH_NAMES = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

const POSTS_PER_PAGE = 20;

interface BlogPostsResponse {
    data: BlogPostData[];
    pagination: { page: number; perPage: number; total: number; totalPages: number };
}

function parseArchiveParams(params: Record<string, string | undefined>) {
    const yearRaw = Number(params.year);
    const year = Number.isInteger(yearRaw) && yearRaw >= 1970 && yearRaw <= 2100 ? yearRaw : null;
    // Track whether a month param was provided at all (even if invalid)
    const monthProvided = params.month !== undefined;
    const monthRaw = params.month ? Number(params.month) : null;
    const month = monthRaw && Number.isInteger(monthRaw) && monthRaw >= 1 && monthRaw <= 12 ? monthRaw : null;
    // Invalid month: param was provided but didn't parse to 1-12
    const invalidMonth = monthProvided && month === null;
    return { year, month, invalidMonth };
}

export function BlogDateArchivePage() {
    const params = useParams({ strict: false }) as { year?: string; month?: string };
    const { year, month, invalidMonth } = parseArchiveParams(params);
    const theme = useMemo(() => getActiveTheme() ?? defaultTheme, []);
    const renderCard = theme.renderers.renderCard ?? defaultTheme.renderers.renderCard;
    const [currentPage, setCurrentPage] = useState(1);
    // Reset to page 1 when navigating between archive routes
    useEffect(() => setCurrentPage(1), [year, month]);

    const endpoint =
        year && !invalidMonth
            ? `/api/blog/posts?year=${year}${month ? `&month=${month}` : ''}&page=${currentPage}&perPage=${POSTS_PER_PAGE}`
            : null;

    const { data: postsResponse, isLoading } = useApiQuery<BlogPostsResponse>({
        entity: 'posts',
        queryKey: ['date-archive', year, month, currentPage],
        endpoint: endpoint ?? '',
        queryOptions: { enabled: !!year && !invalidMonth, ...BLOG_LIST_QUERY_CONFIG },
    });

    const posts = postsResponse?.data ?? [];
    const pagination = postsResponse?.pagination;

    // Build title: "August 2026" or "2026"
    const title = month ? `${MONTH_NAMES[month - 1]} ${year}` : `${year}`;

    // Prev/next month params for navigation
    const prevParams = useMemo(() => {
        if (!year || !month || (year === 1970 && month === 1)) return null;
        return month === 1 ? { year: String(year - 1), month: '12' } : { year: String(year), month: String(month - 1) };
    }, [year, month]);

    const nextParams = useMemo(() => {
        if (!year || !month) return null;
        const now = new Date();
        const nm = month === 12 ? 1 : month + 1;
        const ny = month === 12 ? year + 1 : year;
        // Don't link into the future
        if (ny > now.getFullYear() || (ny === now.getFullYear() && nm > now.getMonth() + 1)) return null;
        return { year: String(ny), month: String(nm) };
    }, [year, month]);

    if (isLoading) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-8 space-y-8" aria-busy="true">
                <span className="sr-only">Loading archive...</span>
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

    if (!year || invalidMonth) {
        return (
            <div className="mx-auto max-w-md rounded-xl bg-muted/40 px-6 py-12 text-center">
                <h1 className="text-lg font-semibold tracking-tight">Invalid Date</h1>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {invalidMonth ? 'The month must be between 1 and 12.' : 'The archive date is not valid.'}
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
            <SEOHead title={`Archive: ${title}`} description={`Blog posts from ${title}`} />

            {/* Back link */}
            <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit gap-1.5 text-muted-foreground">
                <Link to="/blog">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Blog
                </Link>
            </Button>

            {/* Archive header */}
            <div className="space-y-1.5">
                <p className="flex items-center gap-1.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    Archive
                </p>
                <h1 className={theme.config?.classes?.archiveTitle || 'text-3xl font-bold tracking-tight'}>{title}</h1>
                <p className="pt-1 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                    {pagination ? pagination.total : posts.length}{' '}
                    {(pagination?.total ?? posts.length) === 1 ? 'post' : 'posts'} from {title}
                </p>
            </div>

            {/* Month navigation */}
            {month && year && (
                <div className="flex items-center gap-2">
                    {prevParams ? (
                        <Button asChild variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                            <Link to="/blog/archive/$year/$month" params={prevParams}>
                                <ChevronLeft className="h-4 w-4" />
                                Previous month
                            </Link>
                        </Button>
                    ) : (
                        <span />
                    )}
                    <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                        <Link to="/blog/archive/$year" params={{ year: String(year) }}>
                            View all of {year}
                        </Link>
                    </Button>
                    {nextParams && (
                        <Button asChild variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                            <Link to="/blog/archive/$year/$month" params={nextParams}>
                                Next month
                                <ChevronRight className="h-4 w-4" />
                            </Link>
                        </Button>
                    )}
                </div>
            )}

            {/* Posts list */}
            {posts.length === 0 ? (
                <div className="rounded-xl bg-muted/40 py-12 text-center">
                    <p className="text-sm text-muted-foreground">No posts found from {title}.</p>
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

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                    </Button>
                    <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                        Page {currentPage} of {pagination.totalPages}
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => setCurrentPage((p) => p + 1)}
                        disabled={currentPage >= pagination.totalPages}
                    >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                </div>
            )}
        </div>
    );
}

export default BlogDateArchivePage;
