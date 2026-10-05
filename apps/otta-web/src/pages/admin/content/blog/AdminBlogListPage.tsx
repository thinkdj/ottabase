/**
 * Content (admin): every post of every type in one list, with a quick way to share a thought.
 */
import { ADMIN_LIST_QUERY_CONFIG } from '@/config/queryConfig';
import type { PaginatedResponse } from '@/lib/api-types';
import {
    BLURB_MAX_LENGTH,
    CONTENT_TYPES,
    contentTypeLabel,
    formatShortDate,
    POST_STATUSES,
    type ContentType,
    type PhotoJournalItem,
    type PostStatus,
} from '@ottabase/ottablog';
import { createModelHooks, useApiMutation, useApiQuery } from '@ottabase/ottaorm/client';
import { Chip, ConfirmDialog, type ChipTone } from '@ottabase/ui-components';
import { useDataTable, useListState } from '@ottabase/ui-datatable';
import { actionsColumn, createColumns, DataTable } from '@ottabase/ui-datatable/react';
import {
    Alert,
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    NativeSelect,
    NativeSelectOption,
    Textarea,
    toast,
} from '@ottabase/ui-shadcn';
import { keepPreviousData } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { ChevronDown, Eye, FileText, Loader2, Plus, Send, Star, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { BlogAdminNav } from './BlogAdminNav';
import { BlogImportExport } from './BlogImportExport';
import { getPublicContentPath, useBlogSurface } from './blogAdminPaths';

interface BlogPost {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    blurbText: string | null;
    photoNote: string | null;
    photoAlbum: PhotoJournalItem[] | null;
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
const NO_POSTS: BlogPost[] = [];

const STATUS_DOT: Record<PostStatus, ChipTone> = {
    published: 'success',
    draft: 'muted',
    scheduled: 'warning',
    archived: 'destructive',
};

/** Content type tabs, derived so a new type gets a tab for free */
const CONTENT_TYPE_TABS: Array<{ value: ContentType | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    ...Object.entries(CONTENT_TYPES).map(([value, { label }]) => ({ value: value as ContentType, label })),
];

const postTitle = (post: BlogPost) =>
    post.contentType === 'blurb' ? post.blurbText || post.excerpt || post.title : post.title;

export function AdminBlogListPage() {
    const surface = useBlogSurface();
    const navigate = useNavigate();
    const list = useListState({ perPage: 20 });
    const [statusFilter, setStatusFilter] = useState<PostStatus | 'all'>('all');
    const [contentTypeFilter, setContentTypeFilter] = useState<ContentType | 'all'>('all');
    const [blurbText, setBlurbText] = useState('');
    const [pendingDelete, setPendingDelete] = useState<BlogPost | null>(null);

    const where = useMemo(() => {
        const clause: Record<string, unknown> = {};
        if (statusFilter !== 'all') clause.status = statusFilter;
        if (contentTypeFilter !== 'all') clause.contentType = contentTypeFilter;
        return Object.keys(clause).length ? `&where=${encodeURIComponent(JSON.stringify(clause))}` : '';
    }, [statusFilter, contentTypeFilter]);
    const endpoint = `/api/ottaorm/posts?${list.params}&orderBy=updatedAt&orderDirection=desc${where}`;

    const posts = useApiQuery<PaginatedResponse<BlogPost>>({
        entity: 'posts',
        queryKey: ['admin-posts', endpoint],
        endpoint,
        queryOptions: {
            ...ADMIN_LIST_QUERY_CONFIG,
            placeholderData: keepPreviousData,
            meta: { errorPresentation: 'local' },
        },
    });
    const rows = posts.data?.data ?? NO_POSTS;
    const total = posts.data?.pagination.total;

    const updatePost = blogPostHooks.useUpdate();
    const deletePost = blogPostHooks.useDelete();
    const createBlurb = useApiMutation<BlogPost, { text: string; status: 'draft' | 'published' }>({
        endpoint: '/api/blog/blurbs',
        method: 'POST',
        invalidateEntities: ['posts'],
    });

    const filterBy = (apply: () => void) => {
        apply();
        list.reset();
    };

    const shareBlurb = async (status: 'draft' | 'published') => {
        const text = blurbText.trim();
        if (!text) return;
        try {
            await createBlurb.mutateAsync({ text, status });
            setBlurbText('');
            list.reset();
            toast.success(status === 'published' ? 'Thought published' : 'Draft saved');
        } catch (error) {
            toast.error('Could not save the thought', {
                description: error instanceof Error ? error.message : 'Please try again.',
            });
        }
    };

    const confirmDelete = async () => {
        if (!pendingDelete) return;
        try {
            await deletePost.mutateAsync(pendingDelete.id);
            toast.success('Post deleted');
        } catch {
            toast.error(`Could not delete "${pendingDelete.title}"`);
        } finally {
            setPendingDelete(null);
        }
    };

    const { mutate: mutatePost } = updatePost;
    const toggleFeatured = useCallback(
        (post: BlogPost) => mutatePost({ id: post.id, data: { isFeatured: !post.isFeatured } }),
        [mutatePost],
    );
    const openEditor = useCallback(
        (post: BlogPost) => void navigate({ to: surface.editPath(post.id) as never }),
        [navigate, surface],
    );

    const columns = useMemo(
        () => [
            ...createColumns<BlogPost>([
                {
                    key: 'title',
                    header: 'Content',
                    cell: ({ row }) => (
                        <PostCell post={row} editPath={surface.editPath(row.id)} onToggleFeatured={toggleFeatured} />
                    ),
                },
                {
                    key: 'status',
                    header: 'Status',
                    width: 130,
                    cell: ({ row }) => <Chip dot={STATUS_DOT[row.status]}>{POST_STATUSES[row.status].label}</Chip>,
                },
                {
                    key: 'contentType',
                    header: 'Type',
                    width: 130,
                    cell: ({ row }) => <Chip>{contentTypeLabel(row.contentType)}</Chip>,
                },
                {
                    key: 'authorId',
                    header: 'Author',
                    width: 150,
                    cell: ({ row }) => <span className="text-muted-foreground">{row.author?.name || ''}</span>,
                },
                {
                    key: 'updatedAt',
                    header: 'When',
                    width: 190,
                    cell: ({ row }) => <span className="text-muted-foreground">{whenText(row)}</span>,
                },
            ]),
            actionsColumn<BlogPost>([
                {
                    label: 'View',
                    icon: Eye,
                    hidden: (post) => post.status !== 'published',
                    onClick: (post) =>
                        window.open(getPublicContentPath(post.slug, post.contentType), '_blank', 'noopener'),
                },
                { label: 'Delete', icon: Trash2, variant: 'destructive', onClick: setPendingDelete },
            ]),
        ],
        [surface, toggleFeatured],
    );

    const { table } = useDataTable<BlogPost>({ data: rows, columns, getRowId: (row) => row.id, list, rowCount: total });

    const filtered = list.query || statusFilter !== 'all' || contentTypeFilter !== 'all';

    return (
        <div className="space-y-8">
            <BlogAdminNav />

            <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1.5">
                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Content</h1>
                    <p className="max-w-3xl text-muted-foreground">
                        Articles, quick thoughts, photo journals, changelogs, documentation, news and announcements.
                    </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <BlogImportExport />
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
            </header>

            <div className="flex w-fit max-w-full flex-wrap items-center gap-1 rounded-lg bg-muted/40 p-1">
                {CONTENT_TYPE_TABS.map(({ value, label }) => (
                    <button
                        key={value}
                        onClick={() => filterBy(() => setContentTypeFilter(value))}
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

            {(contentTypeFilter === 'all' || contentTypeFilter === 'blurb') && (
                <section className="rounded-xl bg-muted/40 p-4 sm:p-5" aria-labelledby="quick-blurb-title">
                    <div className="mb-3 flex items-start justify-between gap-4">
                        <div>
                            <h2 id="quick-blurb-title" className="text-[0.9375rem] font-semibold">
                                Share a thought
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Short-form text that appears directly in the blog timeline.
                            </p>
                        </div>
                        <span
                            className={`text-xs tabular-nums ${blurbText.length > BLURB_MAX_LENGTH ? 'text-destructive' : 'text-muted-foreground'}`}
                        >
                            {blurbText.length}/{BLURB_MAX_LENGTH}
                        </span>
                    </div>
                    <Textarea
                        value={blurbText}
                        onChange={(event) => setBlurbText(event.target.value)}
                        placeholder="Watched xyz movie today. It left me thinking about..."
                        rows={4}
                        maxLength={BLURB_MAX_LENGTH + 1}
                        className="resize-y bg-background text-base leading-relaxed"
                    />
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                        <Button
                            variant="outline"
                            onClick={() => void shareBlurb('draft')}
                            disabled={!blurbText.trim() || blurbText.length > BLURB_MAX_LENGTH || createBlurb.isPending}
                        >
                            Save draft
                        </Button>
                        <Button
                            onClick={() => void shareBlurb('published')}
                            disabled={!blurbText.trim() || blurbText.length > BLURB_MAX_LENGTH || createBlurb.isPending}
                        >
                            {createBlurb.isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="mr-2 h-4 w-4" />
                            )}
                            Publish
                        </Button>
                    </div>
                </section>
            )}

            {posts.error && <Alert variant="destructive">{posts.error.message}</Alert>}

            <DataTable
                table={table}
                isLoading={posts.isLoading}
                onRowClick={openEditor}
                emptyIcon={FileText}
                emptyMessage={filtered ? 'Nothing matches these filters.' : 'Nothing published yet. Start with New.'}
                searchValue={list.search}
                onSearchChange={list.setSearch}
                searchPlaceholder="Search titles and text"
                toolbarRight={
                    <NativeSelect
                        value={statusFilter}
                        onChange={(e) => filterBy(() => setStatusFilter(e.target.value as PostStatus | 'all'))}
                        aria-label="Filter by status"
                        className="h-9 w-auto"
                    >
                        <NativeSelectOption value="all">Any status</NativeSelectOption>
                        {Object.entries(POST_STATUSES).map(([value, { label }]) => (
                            <NativeSelectOption key={value} value={value}>
                                {label}
                            </NativeSelectOption>
                        ))}
                    </NativeSelect>
                }
                pageSizeOptions={[20, 50, 100]}
            />

            <ConfirmDialog
                open={pendingDelete !== null}
                onOpenChange={(open) => !open && setPendingDelete(null)}
                title="Delete this post?"
                description={pendingDelete ? `"${postTitle(pendingDelete)}" is gone for good.` : ''}
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText="Delete"
                onConfirm={confirmDelete}
                confirmProps={{ disabled: deletePost.isPending }}
                cancelProps={{ disabled: deletePost.isPending }}
            />
        </div>
    );
}

function whenText(post: BlogPost) {
    if (post.status === 'published') return `Published ${formatShortDate(post.publishedAt)}`;
    if (post.status === 'scheduled') return `Scheduled ${formatShortDate(post.publishAt)}`;
    return `Updated ${formatShortDate(post.updatedAt)}`;
}

function detailText(post: BlogPost) {
    if (post.contentType === 'photo') {
        const count = post.photoAlbum?.length ?? 0;
        const photos = `${count} ${count === 1 ? 'photograph' : 'photographs'}`;
        return post.photoNote ? `${photos}, ${post.photoNote}` : photos;
    }
    if (post.contentType === 'blurb') return '';
    return post.excerpt || (post.readingTimeMinutes ? `${post.readingTimeMinutes} min read` : '');
}

/** Title with the highlight star, and one line of detail under it */
function PostCell({
    post,
    editPath,
    onToggleFeatured,
}: {
    post: BlogPost;
    editPath: string;
    onToggleFeatured: (post: BlogPost) => void;
}) {
    const detail = detailText(post);
    return (
        <span className="flex min-w-[16rem] max-w-[28rem] items-start gap-2">
            {post.contentType !== 'blurb' && (
                <button
                    type="button"
                    aria-pressed={post.isFeatured}
                    aria-label={post.isFeatured ? 'Remove highlight' : 'Highlight this post'}
                    title={post.isFeatured ? 'Remove highlight' : 'Highlight this post'}
                    className="mt-0.5 shrink-0 rounded text-muted-foreground transition-colors duration-normal hover:text-warning"
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleFeatured(post);
                    }}
                >
                    <Star className={`h-4 w-4 ${post.isFeatured ? 'fill-warning text-warning' : ''}`} />
                </button>
            )}
            <span className="min-w-0">
                <Link
                    to={editPath as never}
                    onClick={(e) => e.stopPropagation()}
                    className="line-clamp-1 font-medium hover:underline"
                >
                    {postTitle(post)}
                </Link>
                {detail && <span className="mt-0.5 line-clamp-1 block text-xs text-muted-foreground">{detail}</span>}
            </span>
        </span>
    );
}
