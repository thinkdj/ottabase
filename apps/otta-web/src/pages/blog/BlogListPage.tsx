/**
 * Public personal-blog index.
 *
 * The data contract intentionally stays on the public blog API: list filtering, series selection,
 * pagination, content-type renderers, protected-post affordances, and the editorial write CTA all
 * remain available while the surface reads like a personal publication.
 */
import { SEOHead } from '@/components/SEOHead';
import { BLOG_LIST_QUERY_CONFIG, SERIES_LIST_QUERY_CONFIG } from '@/config/queryConfig';
import { useSession } from '@/lib/auth';
import type { PostAuthor } from '@/types/blog';
import {
    CONTENT_TYPES,
    contentTypeLabel,
    formatDate,
    type ContentType,
    type PhotoJournalItem,
} from '@ottabase/ottablog';
import { BlurbRenderer, PhotoJournalRenderer } from '@ottabase/ottablog/renderer';
import { createModelHooks, useApiQuery } from '@ottabase/ottaorm/client';
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    Input,
    NativeSelect,
    NativeSelectOption,
} from '@ottabase/ui-shadcn';
import { hasGrantedPermission } from '@ottabase/utils/permissions';
import { sanitizeUrl } from '@ottabase/utils/sanitize';
import { Link } from '@tanstack/react-router';
import {
    ArrowRight,
    CalendarDays,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Clock3,
    LockKeyhole,
    Plus,
    Search,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { partitionBlogTimeline } from './blogTimeline';

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
    isComplete: boolean;
}

interface BlogListResponse {
    data: BlogPost[];
    pagination: { page: number; perPage: number; total: number; totalPages: number };
}

const blogSeriesHooks = createModelHooks<BlogSeries>({ entityName: 'series' });
const POSTS_PER_PAGE = 12;

function formatPublishedDate(value: string) {
    return formatDate(value, { timeZone: 'UTC' });
}

function PublishedDateLink({ publishedAt }: { publishedAt: string }) {
    const date = new Date(publishedAt);
    const year = String(date.getUTCFullYear());
    const month = String(date.getUTCMonth() + 1);
    return (
        <Link
            to="/blog/archive/$year/$month"
            params={{ year, month }}
            className="personal-meta-link"
            aria-label={`View posts from ${year}-${month.padStart(2, '0')}`}
        >
            <CalendarDays size={14} />
            {formatPublishedDate(publishedAt)}
        </Link>
    );
}

export function BlogListPage() {
    const { user } = useSession();
    const canWrite = hasGrantedPermission(user?.permissions, 'posts:update');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [contentType, setContentType] = useState<ContentType | ''>('');
    const [seriesFilter, setSeriesFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        debounceRef.current = setTimeout(() => {
            setDebouncedSearch(search);
            setCurrentPage(1);
        }, 300);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [search]);

    const params = new URLSearchParams({ page: String(currentPage), perPage: String(POSTS_PER_PAGE) });
    if (contentType) params.set('contentType', contentType);
    if (seriesFilter) params.set('seriesId', seriesFilter);
    if (debouncedSearch) params.set('search', debouncedSearch);

    const { data: listResponse, isLoading } = useApiQuery<BlogListResponse>({
        entity: 'posts',
        queryKey: ['list', { page: currentPage, contentType, seriesFilter, search: debouncedSearch }],
        endpoint: `/api/blog/posts?${params.toString()}`,
        queryOptions: BLOG_LIST_QUERY_CONFIG,
    });
    const { data: seriesData } = blogSeriesHooks.useList(undefined, SERIES_LIST_QUERY_CONFIG);

    const posts = listResponse?.data ?? [];
    const pagination = listResponse?.pagination ?? { page: 1, perPage: POSTS_PER_PAGE, total: 0, totalPages: 1 };
    const { featuredPosts, timelinePosts } = partitionBlogTimeline(posts);
    const setFilter = (callback: () => void) => {
        callback();
        setCurrentPage(1);
    };

    return (
        <div className="personal-blog-page">
            <SEOHead
                title="Writing — essays, observations, and photographs"
                description="Essays, observations, photographs, and occasional dispatches from a personal notebook."
                ogType="website"
                twitterCard="summary_large_image"
            />

            <section className="personal-blog-hero">
                <div className="personal-blog-hero__copy">
                    <p className="personal-eyebrow">Journal · Essays · Photographs</p>
                    <h1>Notes on making, noticing, and figuring things out.</h1>
                    <p className="personal-blog-hero__lede">
                        A personal archive of ideas in progress, small observations, and the things worth remembering.
                    </p>
                </div>
                <div className="personal-blog-hero__aside" aria-label="About this journal">
                    <span className="personal-blog-hero__number">01</span>
                    <p>New notes arrive when they are ready. The archive keeps everything in one quiet place.</p>
                    <Link to="/about" className="personal-text-link">
                        A little more about this space <ArrowRight size={15} />
                    </Link>
                </div>
            </section>

            <div className="personal-blog-toolbar" aria-label="Filter writing">
                <div className="personal-blog-search">
                    <Search size={16} aria-hidden="true" />
                    <Input
                        aria-label="Search posts"
                        placeholder="Search the archive"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </div>
                <div className="personal-blog-filters">
                    <NativeSelect
                        value={contentType}
                        onChange={(event) => setFilter(() => setContentType(event.target.value as ContentType | ''))}
                        aria-label="Filter by content type"
                    >
                        <NativeSelectOption value="">Everything</NativeSelectOption>
                        {Object.entries(CONTENT_TYPES).map(([value, { label }]) => (
                            <NativeSelectOption key={value} value={value}>
                                {label}
                            </NativeSelectOption>
                        ))}
                    </NativeSelect>
                    {seriesData && seriesData.length > 0 && (
                        <NativeSelect
                            value={seriesFilter}
                            onChange={(event) => setFilter(() => setSeriesFilter(event.target.value))}
                            aria-label="Filter by series"
                        >
                            <NativeSelectOption value="">All series</NativeSelectOption>
                            {seriesData.map((series) => (
                                <NativeSelectOption key={series.id} value={series.id}>
                                    {series.title}
                                </NativeSelectOption>
                            ))}
                        </NativeSelect>
                    )}
                </div>
                {canWrite && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button className="personal-write-button">
                                <Plus size={16} /> Write <ChevronDown size={14} />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
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
            </div>

            {isLoading && (
                <div className="personal-blog-loading" aria-busy="true">
                    <span className="sr-only">Loading posts...</span>
                    {Array.from({ length: 4 }, (_, index) => (
                        <div key={index} className="personal-skeleton" />
                    ))}
                </div>
            )}

            {!isLoading && posts.length === 0 && (
                <div className="personal-empty-state">
                    <span className="personal-eyebrow">Nothing here yet</span>
                    <p>No writing matches these filters. Try another search or return to the full archive.</p>
                    <Button
                        variant="outline"
                        onClick={() => {
                            setSearch('');
                            setContentType('');
                            setSeriesFilter('');
                            setCurrentPage(1);
                        }}
                    >
                        Clear filters
                    </Button>
                </div>
            )}

            {featuredPosts.length > 0 && (
                <section className="personal-blog-section">
                    <div className="personal-section-heading">
                        <p className="personal-eyebrow">Worth lingering over</p>
                        <span>Selected notes</span>
                    </div>
                    <div className="personal-featured-grid">
                        {featuredPosts.slice(0, 3).map((post, index) => (
                            <FeaturedPostCard key={post.id} post={post} featured={index === 0} />
                        ))}
                    </div>
                </section>
            )}

            {timelinePosts.length > 0 && (
                <section className="personal-blog-section personal-latest-section">
                    <div className="personal-section-heading">
                        <p className="personal-eyebrow">The archive</p>
                        <span>Latest writing</span>
                    </div>
                    <div className="personal-feed-list">
                        {timelinePosts.map((post) =>
                            post.isProtected ? (
                                <ProtectedPostCard key={post.id} post={post} />
                            ) : post.contentType === 'blurb' ? (
                                <Link
                                    key={post.id}
                                    to="/blog/$slug"
                                    params={{ slug: post.slug }}
                                    className="personal-feed-blurb"
                                >
                                    <BlurbRenderer post={post} variant="timeline" formatDate={formatDate} />
                                </Link>
                            ) : post.contentType === 'photo' ? (
                                <Link
                                    key={post.id}
                                    to="/blog/$slug"
                                    params={{ slug: post.slug }}
                                    className="personal-feed-photo"
                                >
                                    <PhotoJournalRenderer post={post} variant="timeline" formatDate={formatDate} />
                                </Link>
                            ) : (
                                <PostCard key={post.id} post={post} />
                            ),
                        )}
                    </div>
                </section>
            )}

            {!isLoading && posts.length > 0 && pagination.totalPages > 1 && (
                <nav className="personal-pagination" aria-label="Pagination">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                        disabled={currentPage === 1}
                    >
                        <ChevronLeft size={16} /> Previous
                    </Button>
                    <span>
                        Page {currentPage}{' '}
                        <span className="personal-pagination__muted">of {pagination.totalPages}</span>
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentPage((page) => page + 1)}
                        disabled={currentPage >= pagination.totalPages}
                    >
                        Next <ChevronRight size={16} />
                    </Button>
                </nav>
            )}
        </div>
    );
}

function PostMeta({ post }: { post: BlogPost }) {
    return (
        <div className="personal-post-meta">
            {post.publishedAt && <PublishedDateLink publishedAt={post.publishedAt} />}
            {post.readingTimeMinutes && (
                <span>
                    <Clock3 size={14} /> {post.readingTimeMinutes} min read
                </span>
            )}
            {post.author?.name && <span>{post.author.name}</span>}
        </div>
    );
}

function TypeLabel({ post }: { post: BlogPost }) {
    return post.contentType !== 'blog' ? (
        <span className="personal-type-label">{contentTypeLabel(post.contentType)}</span>
    ) : null;
}

function FeaturedPostCard({ post, featured }: { post: BlogPost; featured: boolean }) {
    const heroUrl = post.heroImage?.url ? sanitizeUrl(post.heroImage.url) : null;
    return (
        <article className={`personal-featured-card ${featured ? 'is-featured' : ''}`}>
            {heroUrl && (
                <Link to="/blog/$slug" params={{ slug: post.slug }} className="personal-featured-card__image">
                    <img src={heroUrl} alt={post.heroImage?.alt || post.title} loading="lazy" decoding="async" />
                </Link>
            )}
            <div className="personal-featured-card__body">
                <TypeLabel post={post} />
                <h2>
                    <Link to="/blog/$slug" params={{ slug: post.slug }}>
                        {post.title}
                        {post.isProtected && <LockKeyhole size={16} aria-label="Password protected" />}
                    </Link>
                </h2>
                {post.excerpt && <p>{post.excerpt}</p>}
                <PostMeta post={post} />
                <Link to="/blog/$slug" params={{ slug: post.slug }} className="personal-text-link">
                    {post.contentType === 'photo' ? 'Open journal' : 'Read note'} <ArrowRight size={15} />
                </Link>
            </div>
        </article>
    );
}

function ProtectedPostCard({ post }: { post: BlogPost }) {
    return (
        <article className="personal-protected-card">
            <div className="personal-protected-card__icon">
                <LockKeyhole size={17} />
            </div>
            <div>
                <TypeLabel post={post} />
                <h2>
                    <Link to="/blog/$slug" params={{ slug: post.slug }}>
                        {post.title}
                    </Link>
                </h2>
                {post.excerpt && <p>{post.excerpt}</p>}
                <PostMeta post={post} />
            </div>
            <ArrowRight size={17} aria-hidden="true" />
        </article>
    );
}

function PostCard({ post }: { post: BlogPost }) {
    const heroUrl = post.heroImage?.url ? sanitizeUrl(post.heroImage.url) : null;
    return (
        <article className="personal-post-card">
            <div className="personal-post-card__date">
                {post.publishedAt ? new Date(post.publishedAt).getUTCFullYear() : 'Note'}
            </div>
            <div className="personal-post-card__body">
                <TypeLabel post={post} />
                <h2>
                    <Link to="/blog/$slug" params={{ slug: post.slug }}>
                        {post.title}
                    </Link>
                </h2>
                {post.excerpt && <p>{post.excerpt}</p>}
                <PostMeta post={post} />
            </div>
            {heroUrl && (
                <Link to="/blog/$slug" params={{ slug: post.slug }} className="personal-post-card__image">
                    <img src={heroUrl} alt={post.heroImage?.alt || ''} loading="lazy" decoding="async" />
                </Link>
            )}
            <Link
                to="/blog/$slug"
                params={{ slug: post.slug }}
                className="personal-post-card__arrow"
                aria-label={`Read ${post.title}`}
            >
                <ArrowRight size={17} />
            </Link>
        </article>
    );
}

export default BlogListPage;
