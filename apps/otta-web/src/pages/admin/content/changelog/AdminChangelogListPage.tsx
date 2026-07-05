/**
 * Admin changelog entries list
 *
 * Uses the unified ottablog Post model with contentType='changelog'.
 * Changelogs are now blog posts with a specific content type.
 */
import { ADMIN_LIST_QUERY_CONFIG } from '@/config/queryConfig';
import { formatShortDate, POST_STATUSES, type PostStatus } from '@ottabase/ottablog';
import { createModelHooks } from '@ottabase/ottaorm/client';
import { Badge, Button } from '@ottabase/ui-shadcn';
import { IconEdit, IconEye, IconPlus, IconStar, IconStarFilled, IconTrash } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { ConfirmDialog } from '@ottabase/ui-components';
import { useState } from 'react';

const CHIP_CLASS =
    'rounded-full border-transparent bg-background text-[0.6875rem] font-medium text-muted-foreground ring-1 ring-border';

const STATUS_DOT_CLASS: Record<PostStatus, string> = {
    published: 'bg-success',
    draft: 'bg-muted-foreground/40',
    scheduled: 'bg-warning',
    archived: 'bg-destructive',
};

interface ChangelogPost {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    status: PostStatus;
    isFeatured: boolean;
    readingTimeMinutes: number | null;
    publishedAt: string | null;
    updatedAt: string;
}

const postHooks = createModelHooks<ChangelogPost>({ entityName: 'posts' });

export function AdminChangelogListPage() {
    const [deleteDialog, setDeleteDialog] = useState<{ id: string; title: string } | null>(null);

    // Fetch posts filtered by contentType='changelog'
    const { data, isLoading } = postHooks.useList(
        {
            where: { contentType: 'changelog' },
            orderBy: 'updatedAt',
            orderDirection: 'desc',
        },
        ADMIN_LIST_QUERY_CONFIG,
    );
    const updatePost = postHooks.useUpdate();
    const deletePost = postHooks.useDelete();

    let rows: ChangelogPost[] = [];
    if (Array.isArray(data)) {
        rows = data;
    } else if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as { data: unknown }).data)) {
        rows = (data as { data: ChangelogPost[] }).data;
    }

    const handleDelete = (id: string, title: string) => {
        setDeleteDialog({ id, title });
    };

    const handleConfirmDelete = async () => {
        if (!deleteDialog) return;
        try {
            await deletePost.mutateAsync(deleteDialog.id);
        } catch (err) {
            console.error('Failed to delete changelog entry:', err);
        } finally {
            setDeleteDialog(null);
        }
    };

    const getStatusBadge = (status: PostStatus) => (
        <Badge variant="outline" className={`gap-1.5 ${CHIP_CLASS}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_CLASS[status]}`} aria-hidden="true" />
            {POST_STATUSES[status].label}
        </Badge>
    );

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1.5">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Changelog</h1>
                    <p className="text-muted-foreground">Product updates shown on /changelog</p>
                </div>
                <Button asChild>
                    <Link to="/admin/content/blog/new" search={{ contentType: 'changelog' }}>
                        <IconPlus className="mr-2 size-4" aria-hidden />
                        New entry
                    </Link>
                </Button>
            </div>

            <section className="space-y-4">
                <div className="space-y-1">
                    <h2 className="text-[0.9375rem] font-semibold">Entries</h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">Draft and published changelog posts</p>
                </div>

                {isLoading ? (
                    <div className="space-y-3" aria-busy="true">
                        <span className="sr-only">Loading changelog entries...</span>
                        {Array.from({ length: 4 }, (_, index) => (
                            <div key={index} className="h-14 animate-pulse rounded-xl bg-muted/40" />
                        ))}
                    </div>
                ) : rows.length === 0 ? (
                    <div className="rounded-xl bg-muted/40 py-12 text-center">
                        <p className="text-sm text-muted-foreground">
                            No entries yet. Create one to show on the public changelog.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-border/60">
                        <ul className="divide-y divide-border/60">
                            {rows.map((row) => (
                                <li
                                    key={row.id}
                                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 transition-colors duration-normal hover:bg-muted/40"
                                >
                                    <div className="min-w-0 flex items-center gap-2">
                                        <button
                                            type="button"
                                            title={row.isFeatured ? 'Remove highlight' : 'Highlight this entry'}
                                            className="shrink-0 text-muted-foreground transition-colors hover:text-warning"
                                            onClick={() =>
                                                updatePost.mutate({
                                                    id: row.id,
                                                    data: { isFeatured: !row.isFeatured },
                                                })
                                            }
                                        >
                                            {row.isFeatured ? (
                                                <IconStarFilled className="size-4 text-warning" />
                                            ) : (
                                                <IconStar className="size-4" />
                                            )}
                                        </button>
                                        <div className="min-w-0">
                                            <Link
                                                to="/admin/content/blog/$postId/edit"
                                                params={{ postId: row.id }}
                                                className="font-medium text-foreground hover:underline"
                                            >
                                                {row.title}
                                            </Link>
                                            <p className="truncate text-xs text-muted-foreground">
                                                /changelog/{row.slug}
                                                {row.readingTimeMinutes ? ` · ${row.readingTimeMinutes} min read` : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                            {row.status === 'published'
                                                ? `Published ${formatShortDate(row.publishedAt)}`
                                                : `Updated ${formatShortDate(row.updatedAt)}`}
                                        </span>
                                        {getStatusBadge(row.status)}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-muted-foreground hover:text-foreground"
                                            asChild
                                        >
                                            <a
                                                href={`/changelog/${row.slug}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                aria-label={`View ${row.title}`}
                                            >
                                                <IconEye className="size-4" aria-hidden />
                                            </a>
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-muted-foreground hover:text-foreground"
                                            asChild
                                        >
                                            <Link
                                                to="/admin/content/blog/$postId/edit"
                                                params={{ postId: row.id }}
                                                aria-label={`Edit ${row.title}`}
                                            >
                                                <IconEdit className="mr-1 size-4" aria-hidden />
                                                Edit
                                            </Link>
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(row.id, row.title)}
                                            disabled={deletePost.isPending}
                                            aria-label={`Delete ${row.title}`}
                                        >
                                            <IconTrash className="size-4 text-destructive" aria-hidden />
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </section>

            <ConfirmDialog
                open={deleteDialog !== null}
                onOpenChange={(open) => !open && setDeleteDialog(null)}
                title="Delete Entry?"
                description={`Are you sure you want to delete "${deleteDialog?.title}"?`}
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText="Delete"
                onConfirm={handleConfirmDelete}
                confirmProps={{ disabled: deletePost.isPending }}
                cancelProps={{ disabled: deletePost.isPending }}
            />
        </div>
    );
}

export default AdminChangelogListPage;
