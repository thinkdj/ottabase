import type { PaginatedResponse } from '@/lib/api-types';
import { useApiMutation, useApiQuery } from '@ottabase/ottaorm/client';
import { keepPreviousData } from '@tanstack/react-query';

export interface AppNotification {
    id: string;
    title: string;
    message: string;
    category: string | null;
    actionUrl: string | null;
    actionText: string | null;
    status: 'pending' | 'sent' | 'failed' | 'read';
    readAt: number | string | null;
    createdAt: number | string;
}

export type Inbox = PaginatedResponse<AppNotification> & { unread: number };

export interface NotificationPreferences {
    categories: Record<string, { label: string; enabled: boolean }>;
}

export const isUnread = (notification: AppNotification) => notification.status !== 'read';

interface InboxOptions {
    /** Poll this often, in ms */
    refetchInterval?: number;
    /** Keep the rows on screen while the next page loads */
    keepPrevious?: boolean;
}

/** My inbox: `params` is the query string (page, perPage, unread=1) */
export function useInbox(params: string, { refetchInterval, keepPrevious }: InboxOptions = {}) {
    return useApiQuery<Inbox>({
        entity: 'notifications',
        queryKey: ['inbox', params],
        endpoint: `/api/notifications?${params}`,
        queryOptions: {
            meta: { errorPresentation: 'silent' },
            refetchInterval,
            placeholderData: keepPrevious ? keepPreviousData : undefined,
        },
    });
}

/** Mark these notifications read, or every unread one when no ids are given */
export function useMarkRead() {
    return useApiMutation<{ updated: number }, { ids?: string[] }>({
        endpoint: '/api/notifications/read',
        method: 'POST',
        invalidateEntities: ['notifications'],
        mutationOptions: { meta: { errorPresentation: 'local' } },
    });
}

export function useNotificationPreferences() {
    return useApiQuery<NotificationPreferences>({
        entity: 'notifications',
        queryKey: ['preferences'],
        endpoint: '/api/notifications/preferences',
        queryOptions: { meta: { errorPresentation: 'local' } },
    });
}

export function useSaveNotificationPreferences() {
    return useApiMutation<NotificationPreferences, { categories: Record<string, boolean> }>({
        endpoint: '/api/notifications/preferences',
        method: 'PUT',
        invalidateEntities: ['notifications'],
        mutationOptions: { meta: { errorPresentation: 'local' } },
    });
}
