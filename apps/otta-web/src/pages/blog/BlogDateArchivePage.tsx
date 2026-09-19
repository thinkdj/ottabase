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
import { Link, useParams } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import {
    ArchiveMasthead,
    BlogBackLink,
    BlogEmpty,
    BlogListSkeleton,
    BlogMeasure,
    BlogNotFound,
    TextPager,
} from './blogUi';

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
            <BlogMeasure className="space-y-8">
                <BlogListSkeleton />
            </BlogMeasure>
        );
    }

    if (!year || invalidMonth) {
        return (
            <BlogNotFound
                title="Invalid date"
                body={invalidMonth ? 'The month must be between 1 and 12.' : 'The archive date is not valid.'}
            />
        );
    }

    return (
        <BlogMeasure className={theme.config?.classes?.archiveContainer || 'space-y-10'}>
            <SEOHead title={title} description={`Writing from ${title}`} />

            <BlogBackLink />

            <ArchiveMasthead
                kicker="Archive"
                title={title}
                countLabel={`${pagination ? pagination.total : posts.length} ${
                    (pagination?.total ?? posts.length) === 1 ? 'piece' : 'pieces'
                }`}
            />

            {month && year && (
                <nav className="flex flex-wrap items-baseline gap-x-5 gap-y-2 text-[0.8125rem] text-muted-foreground">
                    {prevParams ? (
                        <Link to="/blog/archive/$year/$month" params={prevParams} className="hover:text-foreground">
                            ← Previous
                        </Link>
                    ) : (
                        <span />
                    )}
                    <Link to="/blog/archive/$year" params={{ year: String(year) }} className="hover:text-foreground">
                        All of {year}
                    </Link>
                    {nextParams && (
                        <Link to="/blog/archive/$year/$month" params={nextParams} className="hover:text-foreground">
                            Next →
                        </Link>
                    )}
                </nav>
            )}

            {posts.length === 0 ? (
                <BlogEmpty>Nothing from {title}.</BlogEmpty>
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

            {pagination && pagination.totalPages > 1 && (
                <TextPager
                    page={currentPage}
                    totalPages={pagination.totalPages}
                    onPrev={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    onNext={() => setCurrentPage((p) => p + 1)}
                />
            )}
        </BlogMeasure>
    );
}

export default BlogDateArchivePage;
