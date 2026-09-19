/**
 * Public Blog List Page
 *
 * A personal writing index: date, title, excerpt. Home uses the same list
 * with a short intro instead of a page title.
 */
import { SEOHead } from '@/components/SEOHead';
import { BLOG_LIST_QUERY_CONFIG, SERIES_LIST_QUERY_CONFIG } from '@/config/queryConfig';
import { useSession } from '@/lib/auth';
import type { PostAuthor } from '@/types/blog';
import { CONTENT_TYPES, formatDate, type ContentType, type PhotoJournalItem } from '@ottabase/ottablog';
import { BlurbRenderer, PhotoJournalRenderer } from '@ottabase/ottablog/renderer';
import { createModelHooks, useApiQuery } from '@ottabase/ottaorm/client';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Input } from '@ottabase/ui-shadcn';
import { hasGrantedPermission } from '@ottabase/utils/permissions';
import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { groupPostsByYear, partitionBlogTimeline } from './blogTimeline';
import {
    BlogEmpty,
    BlogListSkeleton,
    BlogMeasure,
    FilterLink,
    TextPager,
    YearHeading,
    publicKindLabel,
} from './blogUi';
import { BLOG_SITE } from './site';

interface BlogPostTag {
    id: string;
    name: string;
    slug: string;
}

interface BlogPost {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    blurbText: string | null;
    photoNote: string | null;
    photoAlbum: PhotoJournalItem[] | null;
    contentType: ContentType;
    status: string;
    heroImage: { url: string; alt?: string } | null;
    authorId?: string | null;
    author?: PostAuthor | null;
    readingTimeMinutes: number | null;
    isFeatured: boolean;
    isProtected?: boolean;
    publishedAt: string | null;
    seriesId: string | null;
    seriesTitle?: string | null;
    categoryName?: string | null;
    categories?: { id: string; name: string; slug: string }[];
    tags?: BlogPostTag[];
    viewCount?: number;
}

interface BlogSeries {
    id: string;
    title: string;
    slug: string;
}

interface BlogListResponse {
    data: BlogPost[];
    pagination: { page: number; perPage: number; total: number; totalPages: number };
}

const blogSeriesHooks = createModelHooks<BlogSeries>({
    entityName: 'series',
});

const POSTS_PER_PAGE = 20;

const TYPE_FILTERS: Array<{ value: ContentType | ''; label: string }> = [
    { value: '', label: 'All' },
    { value: 'blog', label: 'Essays' },
    { value: 'blurb', label: 'Notes' },
    { value: 'photo', label: 'Journals' },
];

export function BlogListPage({ variant = 'index' }: { variant?: 'home' | 'index' }) {
    const { user } = useSession();
    const canWrite = hasGrantedPermission(user?.permissions, 'posts:update');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [contentType, setContentType] = useState<ContentType | ''>('');
    const [seriesFilter, setSeriesFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isHome = variant === 'home';

    useEffect(() => {
        debounceRef.current = setTimeout(() => {
            setDebouncedSearch(search);
            setCurrentPage(1);
        }, 300);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [search]);

    const blogListParams = new URLSearchParams();
    blogListParams.set('page', String(currentPage));
    blogListParams.set('perPage', String(POSTS_PER_PAGE));
    if (contentType) blogListParams.set('contentType', contentType);
    if (seriesFilter) blogListParams.set('seriesId', seriesFilter);
    if (debouncedSearch) blogListParams.set('search', debouncedSearch);

    const { data: listResponse, isLoading } = useApiQuery<BlogListResponse>({
        entity: 'posts',
        queryKey: ['list', { page: currentPage, contentType, seriesFilter, search: debouncedSearch }],
        endpoint: `/api/blog/posts?${blogListParams.toString()}`,
        queryOptions: BLOG_LIST_QUERY_CONFIG,
    });

    const { data: seriesData } = blogSeriesHooks.useList(undefined, SERIES_LIST_QUERY_CONFIG);

    const posts = listResponse?.data ?? [];
    const pagination = listResponse?.pagination ?? { page: 1, perPage: POSTS_PER_PAGE, total: 0, totalPages: 1 };
    const series = seriesData || [];

    const { featuredPosts, timelinePosts } = partitionBlogTimeline(posts);
    const yearGroups = useMemo(() => groupPostsByYear(timelinePosts), [timelinePosts]);

    const seoTitle = isHome ? BLOG_SITE.name : 'Writing';
    const seoDescription = isHome ? BLOG_SITE.about : 'Essays, notes, and photo journals.';

    return (
        <BlogMeasure className="space-y-12">
            <SEOHead title={seoTitle} description={seoDescription} ogType="website" twitterCard="summary_large_image" />

            <header className="space-y-5">
                {isHome ? (
                    <>
                        <h1 className="font-serif text-4xl font-medium tracking-[-0.035em] text-foreground sm:text-5xl">
                            {BLOG_SITE.name}
                        </h1>
                        <p className="max-w-[34rem] font-serif text-lg leading-relaxed text-muted-foreground sm:text-xl">
                            {BLOG_SITE.intro} {BLOG_SITE.about}
                        </p>
                    </>
                ) : (
                    <>
                        <h1 className="font-serif text-3xl font-medium tracking-[-0.03em] text-foreground sm:text-4xl">
                            Writing
                        </h1>
                        <p className="font-serif text-lg leading-relaxed text-muted-foreground">{BLOG_SITE.intro}</p>
                    </>
                )}

                {canWrite && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                New
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            {Object.entries(CONTENT_TYPES).map(([value, { label }]) => (
                                <DropdownMenuItem key={value} asChild>
                                    <Link to="/studio/new" search={{ contentType: value }}>
                                        {label}
                                    </Link>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </header>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-baseline sm:justify-between">
                <nav className="flex flex-wrap gap-x-4 gap-y-2 text-[0.8125rem]" aria-label="Filter by type">
                    {TYPE_FILTERS.map((filter) => (
                        <FilterLink
                            key={filter.value || 'all'}
                            active={contentType === filter.value}
                            onClick={() => {
                                setContentType(filter.value);
                                setCurrentPage(1);
                            }}
                        >
                            {filter.label}
                        </FilterLink>
                    ))}
                    {series.length > 0 &&
                        series.map((item) => (
                            <FilterLink
                                key={item.id}
                                active={seriesFilter === item.id}
                                onClick={() => {
                                    setSeriesFilter((current) => (current === item.id ? '' : item.id));
                                    setCurrentPage(1);
                                }}
                            >
                                {item.title}
                            </FilterLink>
                        ))}
                </nav>

                <div className="relative w-full sm:w-52">
                    <Input
                        placeholder="Search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-8 border-0 border-b border-border/70 bg-transparent px-0 shadow-none focus-visible:ring-0"
                        aria-label="Search posts"
                    />
                </div>
            </div>

            {isLoading && <BlogListSkeleton />}

            {!isLoading && posts.length === 0 && <BlogEmpty>Nothing here yet.</BlogEmpty>}

            {featuredPosts.length > 0 && (
                <section className="space-y-4">
                    <YearHeading year="Pinned" />
                    <ul className="space-y-5">
                        {featuredPosts.map((post) => (
                            <li key={post.id}>
                                <IndexPostLink post={post} />
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {yearGroups.map((group) => (
                <section key={group.year} className="space-y-5">
                    <YearHeading year={group.year} />
                    <ul className="space-y-6">
                        {group.posts.map((post) => (
                            <li key={post.id}>
                                {post.isProtected ? (
                                    <IndexPostLink post={post} />
                                ) : post.contentType === 'blurb' ? (
                                    <Link
                                        to="/blog/$slug"
                                        params={{ slug: post.slug }}
                                        aria-label={`Open note from ${post.author?.name || 'author'}`}
                                        className="group block outline-none focus-visible:underline"
                                    >
                                        <BlurbRenderer post={post} variant="timeline" formatDate={formatDate} />
                                    </Link>
                                ) : post.contentType === 'photo' ? (
                                    <Link
                                        to="/blog/$slug"
                                        params={{ slug: post.slug }}
                                        aria-label={`Open journal ${post.title}`}
                                        className="group block outline-none focus-visible:underline"
                                    >
                                        <PhotoJournalRenderer post={post} variant="timeline" formatDate={formatDate} />
                                    </Link>
                                ) : (
                                    <IndexPostLink post={post} />
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            ))}

            {!isLoading && posts.length > 0 && (
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

function IndexPostLink({ post }: { post: BlogPost }) {
    const dateLabel = post.publishedAt
        ? formatDate(post.publishedAt, { month: 'short', day: 'numeric', timeZone: 'UTC' })
        : '';

    return (
        <Link
            to="/blog/$slug"
            params={{ slug: post.slug }}
            className="group grid grid-cols-[4.25rem_minmax(0,1fr)] items-baseline gap-x-5 sm:gap-x-8"
        >
            <time className="text-[0.8125rem] tabular-nums text-muted-foreground">{dateLabel}</time>
            <span>
                <span className="font-serif text-[1.2rem] leading-snug tracking-[-0.02em] text-foreground underline-offset-[5px] decoration-foreground/25 group-hover:underline sm:text-[1.35rem]">
                    {post.title}
                    {post.isProtected ? <span className="ml-2 text-xs text-muted-foreground">lock</span> : null}
                </span>
                {post.excerpt ? (
                    <span className="mt-1.5 block line-clamp-2 text-[0.9375rem] leading-relaxed text-muted-foreground">
                        {post.excerpt}
                    </span>
                ) : null}
                {(post.contentType !== 'blog' || post.readingTimeMinutes) && (
                    <span className="mt-1.5 block text-[0.75rem] text-muted-foreground">
                        {post.contentType !== 'blog' ? publicKindLabel(post.contentType) : null}
                        {post.contentType !== 'blog' && post.readingTimeMinutes ? ' · ' : null}
                        {post.readingTimeMinutes ? `${post.readingTimeMinutes} min` : null}
                    </span>
                )}
            </span>
        </Link>
    );
}

export default BlogListPage;
