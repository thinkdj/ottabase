import type { PaginatedResponse } from '@/lib/api-types';
import { APP_ID } from '@/ottabase/config';
import { isApiError } from '@ottabase/api';
import { useApiMutation, useApiQuery } from '@ottabase/ottaorm/client';
import type { ShortlinkRecord } from '@ottabase/shortlinks';
import { ConfirmDialog } from '@ottabase/ui-components';
import { useDataTable, useListState } from '@ottabase/ui-datatable';
import { actionsColumn, createColumns, DataTable } from '@ottabase/ui-datatable/react';
import { Alert, Button, Input, Sheet, SheetContent, SheetHeader, SheetTitle, toast } from '@ottabase/ui-shadcn';
import { formatShortDate } from '@ottabase/utils/timezone';
import { keepPreviousData } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { BarChart3, Copy, Link2, Pencil, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState, type FormEvent } from 'react';
import { ShortlinkForm } from './components/ShortlinkForm';

type Row = ShortlinkRecord & { clicks: number };
interface ClicksResponse {
    data: { dimension: string; value?: number; clicks?: number }[];
}
interface CreateBody {
    fullUrl: string;
    appId: string;
    shortCode?: string;
}

/** The link people share: the code at the site root, which the worker resolves before the app does. */
const shortUrl = (code: string) => `${window.location.origin}/${code}`;

const errorText = (err: unknown, fallback: string) => (isApiError(err) ? err.message : fallback);

async function copyText(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}

export function ShortlinksPage() {
    const navigate = useNavigate();
    const { edit } = useSearch({ strict: false }) as { edit?: string };
    const select = useCallback(
        (id: string | null) => navigate({ to: '/shortlinks', search: { edit: id ?? undefined }, replace: true }),
        [navigate],
    );

    const list = useListState({ perPage: 15 });
    const [url, setUrl] = useState('');
    const [code, setCode] = useState('');
    const [createError, setCreateError] = useState<string | null>(null);
    const [pendingDelete, setPendingDelete] = useState<ShortlinkRecord | null>(null);

    const links = useApiQuery<PaginatedResponse<ShortlinkRecord>>({
        entity: 'shortlinks',
        queryKey: ['list', list.params],
        endpoint: `/api/shortlinks?${list.params}`,
        queryOptions: { meta: { errorPresentation: 'local' }, placeholderData: keepPreviousData },
    });
    // Clicks live in Analytics Engine. Without it the column and the total simply stay away.
    const clicks = useApiQuery<ClicksResponse>({
        entity: 'analytics',
        queryKey: ['shortlinks', 'clicks', 30],
        endpoint: '/api/shortlinks/analytics?groupBy=shortCode&days=30',
        queryOptions: { meta: { errorPresentation: 'silent' }, staleTime: 60_000 },
    });
    const clicksByCode = useMemo(
        () =>
            clicks.data
                ? new Map(clicks.data.data.map((r) => [r.dimension, Math.round(r.clicks ?? r.value ?? 0)]))
                : null,
        [clicks.data],
    );
    const totalClicks = clicksByCode ? [...clicksByCode.values()].reduce((sum, n) => sum + n, 0) : 0;

    const total = links.data?.pagination.total ?? 0;
    const rows = useMemo<Row[]>(
        () => (links.data?.data ?? []).map((link) => ({ ...link, clicks: clicksByCode?.get(link.shortCode) ?? 0 })),
        [links.data, clicksByCode],
    );
    const editing = edit ? (rows.find((link) => link.id === edit) ?? null) : null;

    const create = useApiMutation<{ data: ShortlinkRecord }, CreateBody>({
        endpoint: '/api/shortlinks',
        invalidateEntities: ['shortlinks'],
        mutationOptions: { meta: { errorPresentation: 'local' } },
    });
    const remove = useApiMutation<unknown, string>({
        endpoint: (id) => `/api/shortlinks/${id}`,
        method: 'DELETE',
        invalidateEntities: ['shortlinks'],
    });

    const copyLink = useCallback(async (shortCode: string) => {
        const link = shortUrl(shortCode);
        toast.success((await copyText(link)) ? `Copied ${link}` : link);
    }, []);

    const shorten = async (event: FormEvent) => {
        event.preventDefault();
        setCreateError(null);
        const custom = code.trim();
        try {
            const { data } = await create.mutateAsync({
                fullUrl: url.trim(),
                appId: APP_ID,
                ...(custom ? { shortCode: custom } : {}),
            });
            const link = shortUrl(data.shortCode);
            toast.success((await copyText(link)) ? `Copied ${link}` : `Created ${link}`, {
                action: { label: 'Edit', onClick: () => void select(data.id) },
            });
            setUrl('');
            setCode('');
        } catch (err) {
            setCreateError(errorText(err, 'Could not create the link'));
        }
    };

    const confirmDelete = async () => {
        if (!pendingDelete) return;
        try {
            await remove.mutateAsync(pendingDelete.id);
            toast.success('Link deleted');
            if (edit === pendingDelete.id) void select(null);
        } catch (err) {
            toast.error(errorText(err, 'Could not delete the link'));
        } finally {
            setPendingDelete(null);
        }
    };

    const columns = useMemo(
        () => [
            ...createColumns<Row>([
                {
                    key: 'shortCode',
                    header: 'Short link',
                    width: 200,
                    cell: ({ row }) => <CodeCell code={row.shortCode} onCopy={() => void copyLink(row.shortCode)} />,
                },
                {
                    key: 'fullUrl',
                    header: 'Destination',
                    cell: ({ row }) => (
                        <a
                            href={row.fullUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title={row.fullUrl}
                            className="block max-w-[28rem] truncate text-muted-foreground hover:text-foreground hover:underline"
                        >
                            {row.fullUrl}
                        </a>
                    ),
                },
                ...(clicksByCode
                    ? [
                          {
                              key: 'clicks' as const,
                              header: 'Clicks, 30 days',
                              align: 'right' as const,
                              cell: ({ row }: { row: Row }) => <span className="tabular-nums">{row.clicks}</span>,
                          },
                      ]
                    : []),
                { key: 'expiryDate', header: 'Expires', cell: ({ row }) => <Expiry value={row.expiryDate} /> },
                { key: 'createdAt', header: 'Created', format: 'date', visible: false },
            ]),
            actionsColumn<Row>([
                { label: 'Edit', icon: Pencil, onClick: (row) => void select(row.id) },
                { label: 'Copy link', icon: Copy, onClick: (row) => void copyLink(row.shortCode) },
                {
                    label: 'Clicks',
                    icon: BarChart3,
                    onClick: (row) =>
                        void navigate({ to: '/analytics', search: { tab: 'shortlinks', code: row.shortCode } }),
                },
                { label: 'Delete', icon: Trash2, variant: 'destructive', separator: true, onClick: setPendingDelete },
            ]),
        ],
        [clicksByCode, copyLink, navigate, select],
    );

    const { table } = useDataTable<Row>({ data: rows, columns, getRowId: (row) => row.id, list, rowCount: total });

    return (
        <div className="space-y-8">
            <header className="space-y-1.5">
                <div className="flex items-center gap-2">
                    <Link2 className="h-7 w-7 text-primary" />
                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Shortlinks</h1>
                </div>
                <p className="text-muted-foreground">
                    Paste a link, get a short one to share. Clicks are counted at the edge.
                </p>
            </header>

            <form onSubmit={shorten} className="flex flex-col gap-2 sm:flex-row">
                <Input
                    type="url"
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/a/long/address"
                    aria-label="Destination URL"
                    className="h-11 flex-1 text-base"
                />
                <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="custom code (optional)"
                    aria-label="Custom short code"
                    pattern="[a-zA-Z0-9_\-]{2,50}"
                    title="2 to 50 letters, numbers, hyphens or underscores"
                    className="h-11 sm:w-56"
                />
                <Button type="submit" className="h-11" disabled={create.isPending}>
                    {create.isPending ? 'Shortening' : 'Shorten'}
                </Button>
            </form>
            {createError && <Alert variant="destructive">{createError}</Alert>}

            <dl className="flex flex-wrap gap-x-10 gap-y-3">
                <div>
                    <dt className="text-sm text-muted-foreground">Links</dt>
                    <dd className="text-2xl font-semibold tabular-nums">{total}</dd>
                </div>
                {clicksByCode && (
                    <div>
                        <dt className="text-sm text-muted-foreground">Clicks, last 30 days</dt>
                        <dd className="text-2xl font-semibold tabular-nums">{totalClicks.toLocaleString()}</dd>
                    </div>
                )}
            </dl>

            {links.error && <Alert variant="destructive">{links.error.message}</Alert>}

            <DataTable
                table={table}
                isLoading={links.isLoading}
                onRowClick={(row) => void select(row.id)}
                emptyIcon={Link2}
                emptyMessage={
                    list.query ? 'No links match your search.' : 'No links yet. Paste a URL above to make one.'
                }
                searchValue={list.search}
                onSearchChange={list.setSearch}
                searchPlaceholder="Search by code or destination"
                pageSizeOptions={[15, 25, 50]}
            />

            <Sheet open={editing !== null} onOpenChange={(open) => !open && void select(null)}>
                <SheetContent
                    side="right"
                    className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg"
                    aria-describedby={undefined}
                >
                    <SheetHeader className="border-b border-border px-6 py-4 text-left">
                        <SheetTitle>Edit link</SheetTitle>
                    </SheetHeader>
                    {editing && (
                        <ShortlinkForm
                            key={editing.id}
                            link={editing}
                            onSaved={() => void select(null)}
                            onCancel={() => void select(null)}
                            onDelete={() => setPendingDelete(editing)}
                        />
                    )}
                </SheetContent>
            </Sheet>

            <ConfirmDialog
                open={pendingDelete !== null}
                onOpenChange={(open) => !open && setPendingDelete(null)}
                title="Delete this link?"
                description={
                    pendingDelete
                        ? `${shortUrl(pendingDelete.shortCode)} will stop working for everyone who has it.`
                        : ''
                }
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText="Delete"
                onConfirm={confirmDelete}
            />
        </div>
    );
}

function CodeCell({ code, onCopy }: { code: string; onCopy: () => void }) {
    return (
        <span className="flex items-center gap-1">
            <span className="font-mono font-medium">{code}</span>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onCopy();
                }}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={`Copy link for ${code}`}
                title="Copy link"
            >
                <Copy className="h-3.5 w-3.5" />
            </button>
        </span>
    );
}

function Expiry({ value }: { value: ShortlinkRecord['expiryDate'] }) {
    if (value == null) return <span className="text-muted-foreground">Never</span>;
    if (new Date(value).getTime() < Date.now()) {
        return (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                Expired
            </span>
        );
    }
    return <span className="text-muted-foreground">{formatShortDate(value) ?? 'Invalid date'}</span>;
}
