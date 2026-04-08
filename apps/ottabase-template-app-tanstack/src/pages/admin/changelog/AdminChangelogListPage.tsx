/**
 * Admin changelog entries list
 *
 * Uses the unified ottablog Post model with contentType='changelog'.
 * Changelogs are now blog posts with a specific content type.
 */
import { ADMIN_LIST_QUERY_CONFIG } from '@/config/queryConfig';
import { formatShortDate, POST_STATUSES, type PostStatus } from '@ottabase/ottablog';
import { createModelHooks } from '@ottabase/ottaorm/client';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { IconEdit, IconEye, IconPlus, IconStar, IconStarFilled, IconTrash } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { ConfirmDialog } from '@ottabase/ui-components';
import { useState } from 'react';

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

    const getStatusBadge = (status: PostStatus) => {
        const variants: Record<PostStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
            published: 'default',
            draft: 'secondary',
            scheduled: 'outline',
            archived: 'destructive',
        };
        return <Badge variant={variants[status]}>{POST_STATUSES[status].label}</Badge>;
    };

    return (
        <div className="mx-auto max-w-5xl px-4 py-8">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground dark:text-foreground">Changelog</h1>
                    <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                        Product updates shown on /changelog
                    </p>
                </div>
                <Button asChild>
                    <Link to="/admin/blog/new" search={{ contentType: 'changelog' }}>
                        <IconPlus className="mr-2 size-4" aria-hidden />
                        New entry
                    </Link>
                </Button>
            </div>

            <Card className="border-border dark:border-border">
                <CardHeader>
                    <CardTitle>Entries</CardTitle>
                    <CardDescription>Draft and published changelog posts</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading && <p className="text-sm text-muted-foreground dark:text-muted-foreground">Loading…</p>}
                    {!isLoading && rows.length === 0 && (
                        <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                            No entries yet. Create one to show on the public changelog.
                        </p>
                    )}
                    <ul className="divide-y divide-border dark:divide-border">
                        {rows.map((row) => (
                            <li
                                key={row.id}
                                className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0"
                            >
                                <div className="min-w-0 flex items-center gap-2">
                                    <button
                                        type="button"
                                        title={row.isFeatured ? 'Remove highlight' : 'Highlight this entry'}
                                        className="shrink-0 text-muted-foreground hover:text-yellow-500 transition-colors"
                                        onClick={() =>
                                            updatePost.mutate({
                                                id: row.id,
                                                data: { isFeatured: !row.isFeatured },
                                            })
                                        }
                                    >
                                        {row.isFeatured ? (
                                            <IconStarFilled className="size-4 text-yellow-500" />
                                        ) : (
                                            <IconStar className="size-4" />
                                        )}
                                    </button>
                                    <div className="min-w-0">
                                        <Link
                                            to="/admin/blog/$postId/edit"
                                            params={{ postId: row.id }}
                                            className="font-medium text-foreground dark:text-foreground hover:underline"
                                        >
                                            {row.title}
                                        </Link>
                                        <p className="truncate text-xs text-muted-foreground dark:text-muted-foreground">
                                            /changelog/{row.slug}
                                            {row.readingTimeMinutes ? ` · ${row.readingTimeMinutes} min read` : ''}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">
                                        {row.status === 'published'
                                            ? `Published ${formatShortDate(row.publishedAt)}`
                                            : `Updated ${formatShortDate(row.updatedAt)}`}
                                    </span>
                                    {getStatusBadge(row.status)}
                                    <Button variant="ghost" size="sm" asChild>
                                        <a
                                            href={`/changelog/${row.slug}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            aria-label={`View ${row.title}`}
                                        >
                                            <IconEye className="size-4" aria-hidden />
                                        </a>
                                    </Button>
                                    <Button variant="outline" size="sm" asChild>
                                        <Link
                                            to="/admin/blog/$postId/edit"
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
                </CardContent>
            </Card>

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
