/**
 * The bell in the header: how many notifications are new, the latest few, and the way to the rest.
 */
import { isUnread, useInbox, useMarkRead, type AppNotification } from '@/hooks/useNotifications';
import { timeAgo } from '@/hooks/useLastRefreshed';
import { Popover, PopoverContent, PopoverTrigger } from '@ottabase/ui-shadcn';
import { Link, useNavigate } from '@tanstack/react-router';
import { Bell } from 'lucide-react';
import { useState } from 'react';

export function NotificationBell() {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const inbox = useInbox('page=1&perPage=8', { refetchInterval: 60_000 });
    const markRead = useMarkRead();
    const unread = inbox.data?.unread ?? 0;
    const items = inbox.data?.data ?? [];

    const openItem = (item: AppNotification) => {
        setOpen(false);
        if (isUnread(item)) markRead.mutate({ ids: [item.id] });
        void navigate({ to: (item.actionUrl || '/notifications') as never });
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
                    className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                    <Bell className="h-4 w-4" aria-hidden="true" />
                    {unread > 0 && (
                        <span
                            aria-hidden="true"
                            className="absolute -right-0.5 -top-0.5 min-w-[1.125rem] rounded-full bg-primary px-1 text-center text-[0.625rem] font-semibold leading-[1.125rem] text-primary-foreground"
                        >
                            {unread > 99 ? '99+' : unread}
                        </span>
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                    <span className="text-sm font-semibold">Notifications</span>
                    {unread > 0 && (
                        <button
                            type="button"
                            onClick={() => markRead.mutate({})}
                            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                        >
                            Mark all read
                        </button>
                    )}
                </div>
                {items.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                        Nothing new. You are caught up.
                    </p>
                ) : (
                    <ul className="max-h-96 overflow-y-auto">
                        {items.map((item) => (
                            <li key={item.id} className="border-b border-border/60 last:border-0">
                                <button
                                    type="button"
                                    onClick={() => openItem(item)}
                                    className="flex w-full gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/60"
                                >
                                    <span
                                        aria-hidden="true"
                                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${isUnread(item) ? 'bg-primary' : 'bg-transparent'}`}
                                    />
                                    <span className="min-w-0 flex-1">
                                        <span
                                            className={`block truncate text-sm ${isUnread(item) ? 'font-medium' : ''}`}
                                        >
                                            {item.title}
                                        </span>
                                        <span className="line-clamp-2 block text-xs text-muted-foreground">
                                            {item.message}
                                        </span>
                                        <span className="block text-[0.6875rem] text-muted-foreground">
                                            {timeAgo(new Date(item.createdAt).getTime())}
                                        </span>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                <Link
                    to="/notifications"
                    onClick={() => setOpen(false)}
                    className="block border-t border-border px-3 py-2 text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                    All notifications
                </Link>
            </PopoverContent>
        </Popover>
    );
}
