/**
 * Admin changelog entries list
 */
import { ADMIN_LIST_QUERY_CONFIG } from '@/config/queryConfig';
import { createModelHooks } from '@ottabase/ottaorm/client';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { IconEdit, IconPlus, IconStar, IconStarFilled } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';

interface ChangelogRow {
    id: string;
    title: string;
    slug: string;
    status: string;
    highlight: boolean | null;
    publishedAt: string | null;
    updatedAt: string;
}

const changelogHooks = createModelHooks<ChangelogRow>({ entityName: 'changelog_entries' });

export function AdminChangelogListPage() {
    const { data, isLoading } = changelogHooks.useList(
        { orderBy: 'updatedAt', orderDirection: 'desc' },
        ADMIN_LIST_QUERY_CONFIG,
    );
    const updateEntry = changelogHooks.useUpdate();

    let rows: ChangelogRow[] = [];
    if (Array.isArray(data)) {
        rows = data;
    } else if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as { data: unknown }).data)) {
        rows = (data as { data: ChangelogRow[] }).data;
    }

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
                    <Link to="/admin/changelog/new">
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
                                        title={row.highlight ? 'Remove highlight' : 'Highlight this entry'}
                                        className="shrink-0 text-muted-foreground hover:text-yellow-500 transition-colors"
                                        onClick={() =>
                                            updateEntry.mutate({
                                                id: row.id,
                                                data: { highlight: !row.highlight },
                                            })
                                        }
                                    >
                                        {row.highlight ? (
                                            <IconStarFilled className="size-4 text-yellow-500" />
                                        ) : (
                                            <IconStar className="size-4" />
                                        )}
                                    </button>
                                    <div className="min-w-0">
                                        <p className="font-medium text-foreground dark:text-foreground">{row.title}</p>
                                        <p className="truncate text-xs text-muted-foreground dark:text-muted-foreground">
                                            /changelog/{row.slug}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant={row.status === 'published' ? 'default' : 'secondary'}>
                                        {row.status}
                                    </Badge>
                                    <Button variant="outline" size="sm" asChild>
                                        <Link to="/admin/changelog/$entryId/edit" params={{ entryId: row.id }}>
                                            <IconEdit className="mr-1 size-4" aria-hidden />
                                            Edit
                                        </Link>
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
}

export default AdminChangelogListPage;
