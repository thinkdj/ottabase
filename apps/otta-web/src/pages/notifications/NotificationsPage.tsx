/**
 * Everything that landed in my inbox, newest first; open one to go where it points.
 */
import { timeAgo } from '@/hooks/useLastRefreshed';
import { isUnread, useInbox, useMarkRead, type AppNotification } from '@/hooks/useNotifications';
import { Chip } from '@ottabase/ui-components';
import { useDataTable, useListState } from '@ottabase/ui-datatable';
import { actionsColumn, createColumns, DataTable } from '@ottabase/ui-datatable/react';
import { Button } from '@ottabase/ui-shadcn';
import { useNavigate } from '@tanstack/react-router';
import { ArrowUpRight, Bell, Check } from 'lucide-react';
import { useMemo, useState } from 'react';

const NONE: AppNotification[] = [];
const CATEGORY_LABEL: Record<string, string> = { comments: 'Comment', organizations: 'Organization' };

export function NotificationsPage() {
    const navigate = useNavigate();
    const list = useListState({ perPage: 20 });
    const [unreadOnly, setUnreadOnly] = useState(false);
    const inbox = useInbox(`${list.params}${unreadOnly ? '&unread=1' : ''}`, { keepPrevious: true });
    const markRead = useMarkRead();
    const rows = inbox.data?.data ?? NONE;
    const unread = inbox.data?.unread ?? 0;

    const { mutate } = markRead;
    const openItem = (item: AppNotification) => {
        if (isUnread(item)) mutate({ ids: [item.id] });
        if (item.actionUrl) void navigate({ to: item.actionUrl as never });
    };
    const showOnly = (next: boolean) => {
        setUnreadOnly(next);
        list.reset();
    };

    const columns = useMemo(
        () => [
            ...createColumns<AppNotification>([
                {
                    key: 'title',
                    header: 'Notification',
                    cell: ({ row }) => (
                        <span className="flex min-w-[16rem] gap-3">
                            <span
                                aria-hidden="true"
                                className={`mt-2 h-2 w-2 shrink-0 rounded-full ${isUnread(row) ? 'bg-primary' : 'bg-transparent'}`}
                            />
                            <span className="min-w-0">
                                <span className={`block ${isUnread(row) ? 'font-medium' : ''}`}>{row.title}</span>
                                <span className="line-clamp-2 block text-sm text-muted-foreground">{row.message}</span>
                            </span>
                        </span>
                    ),
                },
                {
                    key: 'category',
                    header: 'About',
                    width: 130,
                    cell: ({ row }) =>
                        row.category ? <Chip>{CATEGORY_LABEL[row.category] ?? row.category}</Chip> : null,
                },
                {
                    key: 'createdAt',
                    header: 'When',
                    width: 120,
                    cell: ({ row }) => (
                        <span className="text-muted-foreground">{timeAgo(new Date(row.createdAt).getTime())}</span>
                    ),
                },
            ]),
            actionsColumn<AppNotification>([
                { label: 'Open', icon: ArrowUpRight, hidden: (item) => !item.actionUrl, onClick: openItem },
                {
                    label: 'Mark read',
                    icon: Check,
                    hidden: (item) => !isUnread(item),
                    onClick: (item) => mutate({ ids: [item.id] }),
                },
            ]),
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [mutate],
    );

    const { table } = useDataTable<AppNotification>({
        data: rows,
        columns,
        getRowId: (row) => row.id,
        list,
        rowCount: inbox.data?.pagination.total,
    });

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                        <Bell className="h-7 w-7 text-primary" />
                        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Notifications</h1>
                    </div>
                    <p className="max-w-3xl text-muted-foreground">
                        Replies to your comments, changes to your organizations, and other things that happened while
                        you were away.
                    </p>
                </div>
                {unread > 0 && (
                    <Button variant="outline" className="shrink-0 gap-2" onClick={() => mutate({})}>
                        <Check className="h-4 w-4" />
                        Mark all read
                    </Button>
                )}
            </header>

            <div role="group" aria-label="Show" className="flex w-fit gap-1 rounded-lg bg-muted/40 p-1">
                {[
                    { value: false, label: 'All' },
                    { value: true, label: unread > 0 ? `Unread (${unread})` : 'Unread' },
                ].map((option) => (
                    <button
                        key={option.label}
                        type="button"
                        aria-pressed={unreadOnly === option.value}
                        onClick={() => showOnly(option.value)}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium outline-none transition-colors duration-normal focus-visible:ring-2 focus-visible:ring-ring ${
                            unreadOnly === option.value
                                ? 'bg-background text-foreground ring-1 ring-border'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        {option.label}
                    </button>
                ))}
            </div>

            <DataTable
                table={table}
                isLoading={inbox.isLoading}
                onRowClick={openItem}
                emptyIcon={Bell}
                emptyMessage={
                    unreadOnly ? 'Nothing unread. You are caught up.' : 'Nothing yet. New things show up here.'
                }
                showColumnVisibility={false}
                pageSizeOptions={[20, 50]}
            />
        </div>
    );
}
