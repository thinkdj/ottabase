/**
 * Public Blog List Page
 *
 * Displays published blog posts with filtering and pagination.
 * Uses public API so protected posts only return excerpt (no full body).
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
    Badge,
    Button,
    Card,
    CardContent,
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
    Calendar,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Clock,
    Lock,
    Plus,
    Search,
    Tag,
    User,
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
    // Author from User relationship
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

const blogSeriesHooks = createModelHooks<BlogSeries>({
    entityName: 'series',
});

const POSTS_PER_PAGE = 12;

export function BlogListPage() {
    const { user } = useSession();
    // Editorial CTAs are for people who can actually write: /studio is gated on posts:update, and
    // every write is re-checked server-side. "Signed in" is not a content permission — showing the
    // buttons to every visitor with an account just walks them into a privilege fallback.
    const canWrite = hasGrantedPermission(user?.permissions, 'posts:update');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [contentType, setContentType] = useState<ContentType | ''>('');
    const [seriesFilter, setSeriesFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Debounce search input (300ms)
    useEffect(() => {
        debounceRef.current = setTimeout(() => {
            setDebouncedSearch(search);
            setCurrentPage(1);
        }, 300);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [search]);

    // Build query params for the public blog API
    const blogListParams = new URLSearchParams();
    blogListParams.set('page', String(currentPage));
    blogListParams.set('perPage', String(POSTS_PER_PAGE));
    if (contentType) blogListParams.set('contentType', contentType);
    if (seriesFilter) blogListParams.set('seriesId', seriesFilter);
    if (debouncedSearch) blogListParams.set('search', debouncedSearch);

    // useApiQuery with entity:'posts' namespaces the key as ['posts', 'list', { ... }].
    // Any mutation on the posts entity (admin create/update/delete) auto-busts this cache
    // via the global mutation observer in OttaQueryProvider — no manual coordination needed.
    const { data: listResponse, isLoading } = useApiQuery<BlogListResponse>({
        entity: 'posts',
        queryKey: ['list', { page: currentPage, contentType, seriesFilter, search: debouncedSearch }],
        endpoint: `/api/blog/posts?${blogListParams.toString()}`,
        queryOptions: BLOG_LIST_QUERY_CONFIG,
    });

    // Fetch series for filter dropdown
    const { data: seriesData } = blogSeriesHooks.useList(undefined, SERIES_LIST_QUERY_CONFIG);

    const posts = listResponse?.data ?? [];
    const pagination = listResponse?.pagination ?? { page: 1, perPage: POSTS_PER_PAGE, total: 0, totalPages: 1 };
    const series = seriesData || [];

    // Reset to page 1 when filters change
    const handleFilterChange = (callback: () => void) => {
        callback();
        setCurrentPage(1);
    };

    // Blurbs remain chronological; highlight-capable articles and photo journals can enter the featured rail.
    const { featuredPosts, timelinePosts } = partitionBlogTimeline(posts);

    return (
        // One measure for the whole page, matching the detail view: the default theme's container
        // is `max-w-3xl mx-auto`, so a reader moving between list and post keeps the same column.
        // Rhythm is two steps only — space-y-12 between page sections, space-y-6 between items.
        <div className="mx-auto w-full max-w-3xl space-y-12">
            {/* SEO Meta Tags */}
            <SEOHead
                title="Blog - Stories, Thoughts, and Photo Journals"
                description="Photo journals, short thoughts, articles, tutorials, and updates from our team."
                ogType="website"
                twitterCard="summary_large_image"
            />

            {/* Header */}
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
                <div className="space-y-1.5">
                    <h1 className="text-3xl font-bold tracking-tight">Blog</h1>
                    <p className="text-lg text-muted-foreground">
                        Photo journals, short thoughts, articles, tutorials, and updates from our team.
                    </p>
                </div>
                {canWrite && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button className="shrink-0">
                                <Plus className="mr-2 h-4 w-4" />
                                Write
                                <ChevronDown className="ml-1 h-4 w-4" />
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

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search posts..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-9 pl-10"
                    />
                </div>

                <div className="flex gap-2">
                    <NativeSelect
                        value={contentType}
                        onChange={(e) => handleFilterChange(() => setContentType(e.target.value as ContentType | ''))}
                        aria-label="Filter by content type"
                    >
                        <NativeSelectOption value="">All Types</NativeSelectOption>
                        {Object.entries(CONTENT_TYPES).map(([value, { label }]) => (
                            <NativeSelectOption key={value} value={value}>
                                {label}
                            </NativeSelectOption>
                        ))}
                    </NativeSelect>

                    {series.length > 0 && (
                        <NativeSelect
                            value={seriesFilter}
                            onChange={(e) => handleFilterChange(() => setSeriesFilter(e.target.value))}
                            aria-label="Filter by series"
                        >
                            <NativeSelectOption value="">All Series</NativeSelectOption>
                            {series.map((s) => (
                                <NativeSelectOption key={s.id} value={s.id}>
                                    {s.title}
                                </NativeSelectOption>
                            ))}
                        </NativeSelect>
                    )}
                </div>
            </div>

            {/* Loading: same stack and rhythm as the timeline it becomes, so nothing jumps. */}
            {isLoading && (
                <div className="space-y-6" aria-busy="true">
                    <span className="sr-only">Loading posts...</span>
                    {Array.from({ length: 4 }, (_, index) => (
                        <div key={index} className="h-40 animate-pulse rounded-2xl bg-muted/40" />
                    ))}
                </div>
            )}

            {/* No posts */}
            {!isLoading && posts.length === 0 && (
                <div className="rounded-2xl bg-muted/40 py-12 text-center">
                    <p className="text-sm text-muted-foreground">No posts found.</p>
                </div>
            )}

            {/* Featured Posts */}
            {featuredPosts.length > 0 && (
                <section className="space-y-5">
                    <h2 className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                        Featured
                    </h2>
                    <div className="grid gap-6 md:grid-cols-2">
                        {featuredPosts.map((post) => (
                            <FeaturedPostCard key={post.id} post={post} />
                        ))}
                    </div>
                </section>
            )}

            {/* Chronological timeline: blurbs stay interleaved with full posts. */}
            {timelinePosts.length > 0 && (
                <section className="space-y-5">
                    <h2 className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                        Latest
                    </h2>
                    {/* Mixed shapes sit here — a bordered thought, an image collage, an article card.
                        They need more air between them than a uniform list would. */}
                    <div className="space-y-6">
                        {/* A protected post ships no body (the API blanks it), so it falls back to
                            PostCard, which renders the lock affordance instead of an empty frame. */}
                        {timelinePosts.map((post) =>
                            post.isProtected ? (
                                <PostCard key={post.id} post={post} />
                            ) : post.contentType === 'blurb' ? (
                                <Link
                                    key={post.id}
                                    to="/blog/$slug"
                                    params={{ slug: post.slug }}
                                    aria-label={`Open thought from ${post.author?.name || 'author'}`}
                                    // Matches the blurb card's bound edge so the focus ring traces the card, not a rounded box around it.
                                    className="group block rounded-l-sm rounded-r-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                    <BlurbRenderer post={post} variant="timeline" formatDate={formatDate} />
                                </Link>
                            ) : post.contentType === 'photo' ? (
                                <Link
                                    key={post.id}
                                    to="/blog/$slug"
                                    params={{ slug: post.slug }}
                                    aria-label={`Open photo journal ${post.title}`}
                                    className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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

            {/* Pagination Controls */}
            {!isLoading && posts.length > 0 && (
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
                        Page {currentPage}
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

function FeaturedPostCard({ post }: { post: BlogPost }) {
    const heroUrl = post.heroImage?.url ? sanitizeUrl(post.heroImage.url) : '#';
    const photoCount = post.photoAlbum?.length ?? 0;
    return (
        <Link
            to="/blog/$slug"
            params={{ slug: post.slug }}
            className="group block h-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
            <Card className="h-full overflow-hidden rounded-2xl border-transparent bg-muted/40 shadow-none transition-colors duration-normal group-hover:bg-muted/70">
                {heroUrl !== '#' && (
                    <div className="relative h-48 overflow-hidden">
                        <img
                            src={heroUrl}
                            alt={post.heroImage?.alt || post.title}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover"
                        />
                        <div className="absolute right-3 top-3 rounded-full bg-background/80 px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border">
                            {post.contentType === 'photo' ? `Featured · ${photoCount} frames` : 'Featured'}
                        </div>
                    </div>
                )}
                <CardContent className="p-6">
                    {post.contentType !== 'blog' && (
                        <span className="mb-2 inline-flex items-center rounded-full bg-background px-2.5 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border">
                            {contentTypeLabel(post.contentType)}
                        </span>
                    )}
                    <h3 className="mb-2 flex items-center gap-2 font-serif text-xl font-semibold leading-snug tracking-[-0.02em] line-clamp-2">
                        {post.title}
                        {post.isProtected && (
                            <Lock className="h-4 w-4 text-muted-foreground shrink-0" aria-label="Password protected" />
                        )}
                    </h3>
                    {post.excerpt && (
                        <p className="mb-4 text-sm leading-relaxed text-muted-foreground line-clamp-3">
                            {post.excerpt}
                        </p>
                    )}
                    {post.tags && post.tags.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-1.5">
                            {post.tags.map((tag) => (
                                <Badge
                                    key={tag.id}
                                    variant="outline"
                                    className="rounded-full border-transparent bg-background text-[0.6875rem] font-medium text-muted-foreground ring-1 ring-border"
                                >
                                    <Tag className="h-2.5 w-2.5 mr-1" />
                                    {tag.name}
                                </Badge>
                            ))}
                        </div>
                    )}
                    {post.categories && post.categories.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-1.5">
                            {post.categories.map((cat) => (
                                <Badge
                                    key={cat.id}
                                    variant="secondary"
                                    className="rounded-full border-transparent bg-background text-[0.6875rem] font-medium text-muted-foreground ring-1 ring-border"
                                >
                                    {cat.name}
                                </Badge>
                            ))}
                        </div>
                    )}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                        {post.author?.name && (
                            <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {post.author.name}
                            </span>
                        )}
                        {post.publishedAt && (
                            <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(post.publishedAt)}
                            </span>
                        )}
                        {post.contentType === 'photo' ? (
                            <span className="flex items-center gap-1">{photoCount} photographs</span>
                        ) : post.readingTimeMinutes ? (
                            <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {post.readingTimeMinutes} min
                            </span>
                        ) : null}
                    </div>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                        {post.contentType === 'photo' ? 'Open journal' : 'Read post'}
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                </CardContent>
            </Card>
        </Link>
    );
}

function PostCard({ post }: { post: BlogPost }) {
    const heroUrl = post.heroImage?.url ? sanitizeUrl(post.heroImage.url) : '#';
    return (
        <Link
            to="/blog/$slug"
            params={{ slug: post.slug }}
            className="group block h-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
            <Card className="h-full overflow-hidden rounded-2xl border-transparent bg-muted/40 shadow-none transition-colors duration-normal group-hover:bg-muted/70">
                {heroUrl !== '#' && (
                    // Print-edge frame, matching the photo journal's tiles and the article hero:
                    // a fixed ratio so the timeline does not reflow as images arrive, a hairline so
                    // a pale photo still has an edge, and the same slow lift on hover.
                    <div className="relative aspect-[16/9] overflow-hidden bg-muted/40">
                        <img
                            src={heroUrl}
                            alt={post.heroImage?.alt || post.title}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.015]"
                        />
                        <span
                            className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/5"
                            aria-hidden="true"
                        />
                    </div>
                )}
                <CardContent className="p-5">
                    {post.contentType !== 'blog' && (
                        <span className="mb-2 inline-flex items-center rounded-full bg-background px-2 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border">
                            {contentTypeLabel(post.contentType)}
                        </span>
                    )}
                    {/* Serif, like the article masthead it opens — a list of articles should look
                        like a contents page, not a row of app tiles. */}
                    <h3 className="mb-2 flex items-center gap-2 font-serif text-lg font-semibold leading-snug tracking-[-0.015em] line-clamp-2">
                        {post.title}
                        {post.isProtected && (
                            <Lock className="h-3 w-3 text-muted-foreground shrink-0" aria-label="Password protected" />
                        )}
                    </h3>
                    {post.excerpt && (
                        <p className="mb-3 text-sm leading-relaxed text-muted-foreground line-clamp-2">
                            {post.excerpt}
                        </p>
                    )}
                    {post.tags && post.tags.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1.5">
                            {post.tags.slice(0, 3).map((tag) => (
                                <Badge
                                    key={tag.id}
                                    variant="outline"
                                    className="rounded-full border-transparent bg-background px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground ring-1 ring-border"
                                >
                                    {tag.name}
                                </Badge>
                            ))}
                            {post.tags.length > 3 && (
                                <span className="text-[0.6875rem] text-muted-foreground">+{post.tags.length - 3}</span>
                            )}
                        </div>
                    )}
                    {post.categories && post.categories.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1.5">
                            {post.categories.slice(0, 2).map((cat) => (
                                <Badge
                                    key={cat.id}
                                    variant="secondary"
                                    className="rounded-full border-transparent bg-background px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground ring-1 ring-border"
                                >
                                    {cat.name}
                                </Badge>
                            ))}
                            {post.categories.length > 2 && (
                                <span className="text-[0.6875rem] text-muted-foreground">
                                    +{post.categories.length - 2}
                                </span>
                            )}
                        </div>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                        {post.publishedAt && (
                            <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(post.publishedAt)}
                            </span>
                        )}
                        {post.readingTimeMinutes && (
                            <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {post.readingTimeMinutes} min
                            </span>
                        )}
                    </div>
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                        Read post
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                </CardContent>
            </Card>
        </Link>
    );
}

export default BlogListPage;
