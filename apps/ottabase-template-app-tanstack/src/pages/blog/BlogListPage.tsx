/**
 * Public Blog List Page
 *
 * Displays published blog posts with filtering and pagination.
 * Uses public API so protected posts only return excerpt (no full body).
 */
import { SEOHead } from '@/components/SEOHead';
import { BLOG_LIST_QUERY_CONFIG, SERIES_LIST_QUERY_CONFIG } from '@/config/queryConfig';
import { CONTENT_TYPES, formatDate, type ContentType } from '@ottabase/ottablog';
import { createModelHooks, useApiQuery } from '@ottabase/ottaorm/client';
import { Button, Card, CardContent, Input } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { Calendar, ChevronLeft, ChevronRight, Clock, Lock, Search, User } from 'lucide-react';
import { useState } from 'react';

interface BlogPost {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    contentType: string;
    status: string;
    heroImage: { url: string; alt?: string } | null;
    authorName: string | null;
    readingTimeMinutes: number | null;
    isFeatured: boolean;
    isProtected?: boolean;
    publishedAt: string | null;
    seriesId: string | null;
    seriesTitle?: string | null;
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
    const [search, setSearch] = useState('');
    const [contentType, setContentType] = useState<ContentType | ''>('');
    const [seriesFilter, setSeriesFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    // Build query params for the public blog API
    const blogListParams = new URLSearchParams();
    blogListParams.set('page', String(currentPage));
    blogListParams.set('perPage', String(POSTS_PER_PAGE));
    if (contentType) blogListParams.set('contentType', contentType);
    if (seriesFilter) blogListParams.set('seriesId', seriesFilter);

    // useApiQuery with entity:'posts' namespaces the key as ['posts', 'list', { ... }].
    // Any mutation on the posts entity (admin create/update/delete) auto-busts this cache
    // via the global mutation observer in OttaQueryProvider — no manual coordination needed.
    const { data: listResponse, isLoading } = useApiQuery<BlogListResponse>({
        entity: 'posts',
        queryKey: ['list', { page: currentPage, contentType, seriesFilter }],
        endpoint: `/api/blog/posts?${blogListParams.toString()}`,
        queryOptions: BLOG_LIST_QUERY_CONFIG,
    });

    // Fetch series for filter dropdown
    const { data: seriesData } = blogSeriesHooks.useList(undefined, SERIES_LIST_QUERY_CONFIG);

    const posts = listResponse?.data ?? [];
    const pagination = listResponse?.pagination ?? { page: 1, perPage: POSTS_PER_PAGE, total: 0, totalPages: 1 };
    const series = seriesData || [];

    // Client-side search filter
    const filteredPosts = search
        ? posts.filter(
              (post) =>
                  post.title.toLowerCase().includes(search.toLowerCase()) ||
                  post.excerpt?.toLowerCase().includes(search.toLowerCase()),
          )
        : posts;

    // Reset to page 1 when filters change
    const handleFilterChange = (callback: () => void) => {
        callback();
        setCurrentPage(1);
    };

    // Separate featured posts
    const featuredPosts = filteredPosts.filter((p) => p.isFeatured);
    const regularPosts = filteredPosts.filter((p) => !p.isFeatured);

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
            <div className="text-center space-y-4">
                <h1 className="text-4xl font-bold">Blog</h1>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                    Thoughts, tutorials, and updates from our team.
                </p>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search posts..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10"
                    />
                </div>

                <div className="flex gap-2">
                    <select
                        value={contentType}
                        onChange={(e) => handleFilterChange(() => setContentType(e.target.value as ContentType | ''))}
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                        aria-label="Filter by content type"
                    >
                        <option value="">All Types</option>
                        {Object.entries(CONTENT_TYPES).map(([value, { label }]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>

                    {series.length > 0 && (
                        <select
                            value={seriesFilter}
                            onChange={(e) => handleFilterChange(() => setSeriesFilter(e.target.value))}
                            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                            aria-label="Filter by series"
                        >
                            <option value="">All Series</option>
                            {series.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.title}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="text-center py-12">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
                    <p className="mt-4 text-muted-foreground">Loading posts...</p>
                </div>
            )}

            {/* No posts */}
            {!isLoading && filteredPosts.length === 0 && (
                <div className="text-center py-12">
                    <p className="text-muted-foreground">No posts found.</p>
                </div>
            )}

            {/* Featured Posts */}
            {featuredPosts.length > 0 && (
                <section>
                    <h2 className="text-2xl font-semibold mb-4">Featured</h2>
                    <div className="grid gap-6 md:grid-cols-2">
                        {featuredPosts.map((post) => (
                            <FeaturedPostCard key={post.id} post={post} />
                        ))}
                    </div>
                </section>
            )}

            {/* Regular Posts */}
            {regularPosts.length > 0 && (
                <section>
                    {featuredPosts.length > 0 && <h2 className="text-2xl font-semibold mb-4">Latest Posts</h2>}
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {regularPosts.map((post) => (
                            <PostCard key={post.id} post={post} />
                        ))}
                    </div>
                </section>
            )}

            {/* Pagination Controls */}
            {!isLoading && filteredPosts.length > 0 && (
                <div className="flex items-center justify-center gap-4 pt-8">
                    <Button
                        variant="outline"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">Page {currentPage}</span>
                    <Button
                        variant="outline"
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
        <Link to={`/blog/${post.slug}`}>
            <Card className="h-full overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group">
                {post.heroImage?.url && (
                    <div className="relative h-48 overflow-hidden">
                        <img
                            src={post.heroImage.url}
                            alt={post.heroImage.alt || post.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-3 right-3 bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-medium">
                            Featured
                        </div>
                    </div>
                )}
                <CardContent className="p-6">
                    {post.contentType !== 'blog' && (
                        <span className="inline-block mb-2 px-2 py-0.5 bg-secondary text-secondary-foreground text-xs rounded capitalize">
                            {post.contentType}
                        </span>
                    )}
                    <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors line-clamp-2 flex items-center gap-2">
                        {post.title}
                        {post.isProtected && (
                            <Lock className="h-4 w-4 text-muted-foreground shrink-0" aria-label="Password protected" />
                        )}
                    </h3>
                    {post.excerpt && <p className="text-muted-foreground mb-4 line-clamp-3">{post.excerpt}</p>}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {post.authorName && (
                            <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {post.authorName}
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
                </CardContent>
            </Card>
        </Link>
    );
}

function PostCard({ post }: { post: BlogPost }) {
    return (
        <Link to={`/blog/${post.slug}`}>
            <Card className="h-full overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group">
                {post.heroImage?.url && (
                    <div className="relative h-40 overflow-hidden">
                        <img
                            src={post.heroImage.url}
                            alt={post.heroImage.alt || post.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                    </div>
                )}
                <CardContent className="p-4">
                    {post.contentType !== 'blog' && (
                        <span className="inline-block mb-2 px-2 py-0.5 bg-secondary text-secondary-foreground text-xs rounded capitalize">
                            {post.contentType}
                        </span>
                    )}
                    <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors line-clamp-2 flex items-center gap-2">
                        {post.title}
                        {post.isProtected && (
                            <Lock className="h-3 w-3 text-muted-foreground shrink-0" aria-label="Password protected" />
                        )}
                    </h3>
                    {post.excerpt && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{post.excerpt}</p>}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
                </CardContent>
            </Card>
        </Link>
    );
}

export default BlogListPage;
