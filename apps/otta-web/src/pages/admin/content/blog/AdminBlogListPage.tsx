/**
 * Admin Content List Page
 *
 * Unified content management for all content types (blog, changelog, docs, news, announcements).
 * Lists all posts with filtering, status management, and CRUD operations.
 */
import { ADMIN_LIST_QUERY_CONFIG } from '@/config/queryConfig';
import type { PaginatedResponse } from '@/lib/api-types';
import { CONTENT_TYPES, formatShortDate, POST_STATUSES, type ContentType, type PostStatus } from '@ottabase/ottablog';
import { createModelHooks, useApiQuery } from '@ottabase/ottaorm/client';
import { ConfirmDialog } from '@ottabase/ui-components';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    Input,
    NativeSelect,
    NativeSelectOption,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import {
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Clock,
    Edit,
    Eye,
    FileText,
    Filter,
    Loader2,
    Plus,
    Search,
    Star,
    Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BlogAdminNav } from './BlogAdminNav';
import { useBlogSurface } from './blogAdminPaths';

/** Debounce delay for search input (ms) */
const SEARCH_DEBOUNCE_MS = 300;

interface BlogPost {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    contentType: ContentType;
    status: PostStatus;
    authorId: string | null;
    author?: { id: string; name: string | null; image: string | null } | null;
    isFeatured: boolean;
    readingTimeMinutes: number | null;
    publishAt: number | null;
    publishedAt: number | null;
    createdAt: number;
    updatedAt: number;
}

const blogPostHooks = createModelHooks<BlogPost>({ entityName: 'posts' });

const POSTS_PER_PAGE = 20;

/** Get the correct public URL for a post based on its content type */
function getPublicUrl(slug: string, contentType: ContentType): string {
    switch (contentType) {
        case 'changelog':
            return `/changelog/${slug}`;
        case 'docs':
            return `/docs/${slug}`;
        default:
            return `/blog/${slug}`;
    }
}

/** Content type tabs - all singular for consistency */
const CONTENT_TYPE_TABS: Array<{ value: ContentType | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'blog', label: 'Blog Post' },
    { value: 'changelog', label: 'Changelog' },
    { value: 'docs', label: 'Doc' },
    { value: 'news', label: 'News' },
    { value: 'announcement', label: 'Announcement' },
];

export function AdminBlogListPage() {
    const surface = useBlogSurface();
    const [searchInput, setSearchInput] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<PostStatus | 'all'>('all');
    const [contentTypeFilter, setContentTypeFilter] = useState<ContentType | 'all'>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [deleteDialog, setDeleteDialog] = useState<{ id: string; title: string } | null>(null);
    const [alertDialog, setAlertDialog] = useState<{ open: boolean; title: string; message: string }>({
        open: false,
        title: '',
        message: '',
    });

    // Debounce search input to reduce API calls
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchInput.trim());
            setCurrentPage(1); // Reset to page 1 when search changes
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [searchInput]);

    // Build where clause for server-side filtering
    const whereClause: Record<string, unknown> = {};
    if (statusFilter !== 'all') {
        whereClause.status = statusFilter;
    }
    if (contentTypeFilter !== 'all') {
        whereClause.contentType = contentTypeFilter;
    }

    const queryParams = useMemo(() => {
        const params = new URLSearchParams();
        params.set('page', String(currentPage));
        params.set('perPage', String(POSTS_PER_PAGE));
        params.set('orderBy', 'updatedAt');
        params.set('orderDirection', 'desc');
        if (debouncedSearch) {
            params.set('search', debouncedSearch);
        }
        if (Object.keys(whereClause).length > 0) {
            params.set('where', JSON.stringify(whereClause));
        }
        return params.toString();
    }, [currentPage, debouncedSearch, statusFilter, contentTypeFilter]);

    // Fetch posts with pagination and server-side filtering + search
    const {
        data: postsResponse,
        isLoading,
        error,
    } = useApiQuery<PaginatedResponse<BlogPost>>({
        entity: 'posts',
        queryKey: ['admin-posts', queryParams],
        endpoint: `/api/ottaorm/posts?${queryParams}`,
        queryOptions: ADMIN_LIST_QUERY_CONFIG,
    });

    const posts = postsResponse?.data ?? [];
    const pagination = postsResponse?.pagination ?? null;
    const totalCount = pagination?.total ?? posts.length;
    const pageStart = pagination
        ? pagination.total === 0
            ? 0
            : (pagination.page - 1) * pagination.perPage + 1
        : posts.length === 0
          ? 0
          : (currentPage - 1) * POSTS_PER_PAGE + 1;
    const pageEnd = pagination
        ? Math.min(pagination.page * pagination.perPage, pagination.total)
        : Math.min(currentPage * POSTS_PER_PAGE, posts.length);

    const updatePost = blogPostHooks.useUpdate();
    const deletePost = blogPostHooks.useDelete();

    useEffect(() => {
        if (!pagination) return;
        const totalPages = Math.max(1, pagination.totalPages);
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [pagination, currentPage]);

    // Toggle highlight/featured status
    const handleToggleFeatured = (id: string, currentValue: boolean) => {
        updatePost.mutate({ id, data: { isFeatured: !currentValue } });
    };

    // Reset to page 1 when filters change
    const handleFilterChange = (callback: () => void) => {
        callback();
        setCurrentPage(1);
    };

    const handleDelete = (id: string, title: string) => {
        setDeleteDialog({ id, title });
    };

    const handleConfirmDelete = async () => {
        if (!deleteDialog) return;

        try {
            await deletePost.mutateAsync(deleteDialog.id);
        } catch (err) {
            console.error('Failed to delete blog post:', err);
            const failedTitle = deleteDialog.title;
            setAlertDialog({
                open: true,
                title: 'Error',
                message: `Failed to delete "${failedTitle}". Please try again.`,
            });
        } finally {
            setDeleteDialog(null);
        }
    };

    const getStatusBadge = (status: PostStatus) => {
        const dots: Record<PostStatus, string> = {
            published: 'bg-success',
            draft: 'bg-muted-foreground/40',
            scheduled: 'bg-warning',
            archived: 'bg-destructive',
        };
        return (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-background px-2.5 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border">
                <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dots[status]}`} />
                {POST_STATUSES[status].label}
            </span>
        );
    };

    const getContentTypeBadge = (contentType: ContentType) => {
        return (
            <span className="inline-flex items-center whitespace-nowrap rounded-full bg-background px-2.5 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border">
                {CONTENT_TYPES[contentType].label}
            </span>
        );
    };

    return (
        <div className="space-y-8">
            <BlogAdminNav />

            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1.5">
                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Content</h1>
                    <p className="max-w-3xl text-muted-foreground">
                        Manage blog posts, changelogs, documentation, news, and announcements.
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                New
                                <ChevronDown className="ml-1 h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {Object.entries(CONTENT_TYPES).map(([value, { label }]) => (
                                <DropdownMenuItem key={value} asChild>
                                    <Link to={surface.newPath} search={{ contentType: value }}>
                                        {label}
                                    </Link>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Content Type Tabs */}
            <div className="flex w-fit max-w-full flex-wrap items-center gap-1 rounded-lg bg-muted/40 p-1">
                {CONTENT_TYPE_TABS.map(({ value, label }) => (
                    <button
                        key={value}
                        onClick={() => handleFilterChange(() => setContentTypeFilter(value))}
                        aria-pressed={contentTypeFilter === value}
                        className={`inline-flex h-8 items-center whitespace-nowrap rounded-md px-3 text-sm font-medium outline-none transition-colors duration-normal focus-visible:ring-2 focus-visible:ring-ring ${
                            contentTypeFilter === value
                                ? 'bg-background text-foreground ring-1 ring-border'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Filters */}
            <div className="rounded-xl bg-muted/40 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    {/* Search */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search by title, slug, or excerpt..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="h-9 pl-9"
                        />
                        {isLoading && debouncedSearch && (
                            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                        )}
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <NativeSelect
                            value={statusFilter}
                            onChange={(e) =>
                                handleFilterChange(() => setStatusFilter(e.target.value as PostStatus | 'all'))
                            }
                            aria-label="Filter by status"
                        >
                            <NativeSelectOption value="all">All Status</NativeSelectOption>
                            {Object.entries(POST_STATUSES).map(([value, { label }]) => (
                                <NativeSelectOption key={value} value={value}>
                                    {label}
                                </NativeSelectOption>
                            ))}
                        </NativeSelect>
                    </div>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    {error.message}
                </div>
            )}

            {/* Posts List */}
            <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-[0.9375rem] font-semibold">
                        {CONTENT_TYPE_TABS.find((t) => t.value === contentTypeFilter)?.label || 'Content'}
                    </h2>
                    <span className="inline-flex items-center rounded-full bg-background px-2.5 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border">
                        {totalCount} item{totalCount !== 1 ? 's' : ''}
                    </span>
                </div>
                {isLoading ? (
                    <div className="space-y-2" aria-busy="true">
                        <span className="sr-only">Loading posts...</span>
                        {Array.from({ length: 6 }, (_, index) => (
                            <div key={index} className="h-16 animate-pulse rounded-xl bg-muted/40" />
                        ))}
                    </div>
                ) : posts.length === 0 ? (
                    <div className="rounded-xl bg-muted/40 py-12 text-center">
                        <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
                        <h3 className="mt-4 text-[0.9375rem] font-semibold">No posts found</h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {totalCount === 0
                                ? 'Get started by creating your first one.'
                                : 'Try adjusting your search or filters.'}
                        </p>
                        {totalCount === 0 && (
                            <Button asChild className="mt-4">
                                <Link
                                    to={surface.newPath}
                                    search={
                                        contentTypeFilter !== 'all' ? { contentType: contentTypeFilter } : undefined
                                    }
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    {contentTypeFilter !== 'all'
                                        ? `Create ${CONTENT_TYPE_TABS.find((t) => t.value === contentTypeFilter)?.label ?? 'Post'}`
                                        : 'Create Post'}
                                </Link>
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-border/60">
                        <Table>
                            <TableHeader className="bg-muted/40">
                                <TableRow className="border-border/60 hover:bg-transparent">
                                    <TableHead className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                        Title
                                    </TableHead>
                                    <TableHead className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                        Status
                                    </TableHead>
                                    <TableHead className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                        Type
                                    </TableHead>
                                    <TableHead className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                        Author
                                    </TableHead>
                                    <TableHead className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                        Publish
                                    </TableHead>
                                    <TableHead className="text-right text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {posts.map((post) => (
                                    <TableRow
                                        key={post.id}
                                        className="border-border/60 transition-colors duration-normal hover:bg-muted/40"
                                    >
                                        <TableCell className="max-w-[360px]">
                                            <div className="flex items-start gap-3">
                                                <button
                                                    type="button"
                                                    title={post.isFeatured ? 'Remove highlight' : 'Highlight this post'}
                                                    className="mt-1 shrink-0 text-muted-foreground transition-colors duration-normal hover:text-warning"
                                                    onClick={() => handleToggleFeatured(post.id, post.isFeatured)}
                                                    disabled={updatePost.isPending}
                                                >
                                                    {post.isFeatured ? (
                                                        <Star className="h-4 w-4 fill-warning text-warning" />
                                                    ) : (
                                                        <Star className="h-4 w-4" />
                                                    )}
                                                </button>
                                                <div className="min-w-0">
                                                    <Link
                                                        to={surface.editPath(post.id)}
                                                        className="font-medium hover:underline line-clamp-1"
                                                    >
                                                        {post.title}
                                                    </Link>
                                                    {post.excerpt && (
                                                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                                            {post.excerpt}
                                                        </p>
                                                    )}
                                                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                                        <Clock className="h-3 w-3" />
                                                        {post.readingTimeMinutes
                                                            ? `${post.readingTimeMinutes} min read`
                                                            : '—'}
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>{getStatusBadge(post.status)}</TableCell>
                                        <TableCell>{getContentTypeBadge(post.contentType)}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {post.author?.name || '—'}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {post.status === 'published'
                                                ? `Published ${formatShortDate(post.publishedAt)}`
                                                : post.status === 'scheduled'
                                                  ? `Scheduled ${formatShortDate(post.publishAt)}`
                                                  : `Updated ${formatShortDate(post.updatedAt)}`}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button variant="ghost" size="icon" asChild>
                                                    <a
                                                        href={getPublicUrl(post.slug, post.contentType)}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        aria-label="View"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </a>
                                                </Button>
                                                <Button variant="ghost" size="icon" asChild>
                                                    <Link to={surface.editPath(post.id)}>
                                                        <Edit className="h-4 w-4" />
                                                    </Link>
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDelete(post.id, post.title)}
                                                    disabled={deletePost.isPending}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </section>

            {/* Pagination Controls */}
            {!isLoading && pagination && pagination.total > 0 && (
                <div className="flex items-center justify-between">
                    <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                        Showing {pageStart} to {pageEnd} of {pagination.total} results
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground"
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={pagination.page <= 1}
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Previous
                        </Button>
                        <span className="px-2 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            Page {pagination.page} of {pagination.totalPages}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground"
                            onClick={() => setCurrentPage((p) => p + 1)}
                            disabled={pagination.page >= pagination.totalPages}
                        >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={deleteDialog !== null}
                onOpenChange={(open) => !open && setDeleteDialog(null)}
                title="Delete Post?"
                description={`Are you sure you want to delete "${deleteDialog?.title}"?`}
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText="Delete"
                onConfirm={handleConfirmDelete}
                confirmProps={{ disabled: deletePost.isPending }}
                cancelProps={{ disabled: deletePost.isPending }}
            />

            <AlertDialog
                open={alertDialog.open}
                onOpenChange={(open) => !open && setAlertDialog({ ...alertDialog, open: false })}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{alertDialog.title}</AlertDialogTitle>
                        <AlertDialogDescription>{alertDialog.message}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setAlertDialog({ ...alertDialog, open: false })}>
                            OK
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
