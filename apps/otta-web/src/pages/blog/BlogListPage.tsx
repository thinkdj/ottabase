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
import { CONTENT_TYPES, formatDate, type ContentType } from '@ottabase/ottablog';
import { createModelHooks, useApiQuery } from '@ottabase/ottaorm/client';
import { Badge, Button, Card, CardContent, Input, NativeSelect, NativeSelectOption } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Calendar, ChevronLeft, ChevronRight, Clock, Lock, Plus, Search, Tag, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

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
    contentType: string;
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
    const { isAuthenticated } = useSession({ skipAutoSync: true });
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [contentType, setContentType] = useState<ContentType | ''>('');
    const [seriesFilter, setSeriesFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>();

    // Debounce search input (300ms)
    useEffect(() => {
        debounceRef.current = setTimeout(() => {
            setDebouncedSearch(search);
            setCurrentPage(1);
        }, 300);
        return () => clearTimeout(debounceRef.current);
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

    // Separate featured posts
    const featuredPosts = posts.filter((p) => p.isFeatured);
    const regularPosts = posts.filter((p) => !p.isFeatured);

    return (
        <div className="space-y-8">
            {/* SEO Meta Tags */}
            <SEOHead
                title="Blog - Latest Articles and Updates"
                description="Thoughts, tutorials, and updates from our team. Stay up to date with the latest blog posts, changelogs, and documentation."
                ogType="website"
                twitterCard="summary_large_image"
            />

            {/* Header */}
            <div className="space-y-4">
                <div className="space-y-1.5">
                    <h1 className="text-3xl font-bold tracking-tight">Blog</h1>
                    <p className="max-w-3xl text-lg text-muted-foreground">
                        Thoughts, tutorials, and updates from our team.
                    </p>
                </div>
                {isAuthenticated && (
                    <div>
                        <Button asChild>
                            <Link to="/admin/content/blog/new">
                                <Plus className="h-4 w-4 mr-2" />
                                New Post
                            </Link>
                        </Button>
                    </div>
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

            {/* Loading */}
            {isLoading && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
                    <span className="sr-only">Loading posts...</span>
                    {Array.from({ length: 6 }, (_, index) => (
                        <div key={index} className="h-56 animate-pulse rounded-xl bg-muted/40" />
                    ))}
                </div>
            )}

            {/* No posts */}
            {!isLoading && posts.length === 0 && (
                <div className="rounded-xl bg-muted/40 py-12 text-center">
                    <p className="text-sm text-muted-foreground">No posts found.</p>
                </div>
            )}

            {/* Featured Posts */}
            {featuredPosts.length > 0 && (
                <section className="space-y-4">
                    <h2 className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                        Featured
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2">
                        {featuredPosts.map((post) => (
                            <FeaturedPostCard key={post.id} post={post} />
                        ))}
                    </div>
                </section>
            )}

            {/* Regular Posts */}
            {regularPosts.length > 0 && (
                <section className="space-y-4">
                    {featuredPosts.length > 0 && (
                        <h2 className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            Latest Posts
                        </h2>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {regularPosts.map((post) => (
                            <PostCard key={post.id} post={post} />
                        ))}
                    </div>
                </section>
            )}

            {/* Pagination Controls */}
            {!isLoading && posts.length > 0 && (
                <div className="flex items-center justify-center gap-4 pt-8">
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
    return (
        <Link
            to={`/blog/${post.slug}`}
            className="group block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
            <Card className="h-full overflow-hidden rounded-xl border-transparent bg-muted/40 shadow-none transition-colors duration-normal group-hover:bg-muted/70">
                {post.heroImage?.url && (
                    <div className="relative h-48 overflow-hidden">
                        <img
                            src={post.heroImage.url}
                            alt={post.heroImage.alt || post.title}
                            className="h-full w-full object-cover"
                        />
                        <div className="absolute right-3 top-3 rounded-full bg-background/80 px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border">
                            Featured
                        </div>
                    </div>
                )}
                <CardContent className="p-6">
                    {post.contentType !== 'blog' && (
                        <span className="mb-2 inline-flex items-center rounded-full bg-background px-2.5 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border">
                            {post.contentType}
                        </span>
                    )}
                    <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold tracking-tight line-clamp-2">
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
                        {post.readingTimeMinutes && (
                            <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {post.readingTimeMinutes} min
                            </span>
                        )}
                    </div>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                        Read post
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                </CardContent>
            </Card>
        </Link>
    );
}

function PostCard({ post }: { post: BlogPost }) {
    return (
        <Link
            to={`/blog/${post.slug}`}
            className="group block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
            <Card className="h-full overflow-hidden rounded-xl border-transparent bg-muted/40 shadow-none transition-colors duration-normal group-hover:bg-muted/70">
                {post.heroImage?.url && (
                    <div className="relative h-40 overflow-hidden">
                        <img
                            src={post.heroImage.url}
                            alt={post.heroImage.alt || post.title}
                            className="h-full w-full object-cover"
                        />
                    </div>
                )}
                <CardContent className="p-5">
                    {post.contentType !== 'blog' && (
                        <span className="mb-2 inline-flex items-center rounded-full bg-background px-2 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border">
                            {post.contentType}
                        </span>
                    )}
                    <h3 className="mb-2 flex items-center gap-2 text-[0.9375rem] font-semibold line-clamp-2">
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
