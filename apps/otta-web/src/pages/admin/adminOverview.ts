/**
 * What the admin overview shows: the things waiting on someone, a few headline counts and the
 * latest audit entries. Every request fails quietly, so an organization admin who may not read a
 * platform-wide number simply does not get that number.
 */
import type { PaginatedResponse } from '@/lib/api-types';
import { PACKAGES_ENABLED } from '@/ottabase/config';
import { getPublicContentPath } from '@/pages/admin/content/blog/blogAdminPaths';
import type { AuditLogRecord } from '@/types/rbac';
import type { ContentType } from '@ottabase/ottablog';
import { useApiQuery } from '@ottabase/ottaorm/client';
import { useMemo } from 'react';

export interface FlaggedComment {
    id: string;
    body: string;
    createdAt: number | string;
    author: { id: string; name: string | null } | null;
    post: { id: string; title: string | null; slug: string; contentType: ContentType } | null;
}

export type AttentionTone = 'destructive' | 'warning' | 'info';

export interface AttentionItem {
    key: string;
    count: number;
    /** "3 comments flagged by readers" */
    label: string;
    href: string;
    tone: AttentionTone;
    /** A few of the things themselves, each with somewhere to go */
    details?: { key: string; text: string; href: string }[];
}

export interface GlanceStat {
    label: string;
    value: number;
}

const WEEK_MS = 7 * 86_400_000;
const HOUR_MS = 3_600_000;
const quiet = { meta: { errorPresentation: 'silent' as const }, staleTime: 60_000 };

const plural = (count: number, one: string, many: string) => `${count.toLocaleString()} ${count === 1 ? one : many}`;
const postsCount = (where: Record<string, unknown>) =>
    `/api/ottaorm/posts?page=1&perPage=1&where=${encodeURIComponent(JSON.stringify(where))}`;
const totalOf = (data: PaginatedResponse<unknown> | undefined) => data?.pagination?.total;

const VERBS: Record<string, string> = {
    create: 'created',
    update: 'updated',
    delete: 'deleted',
    invite: 'invited someone to',
    remove: 'removed someone from',
    login: 'signed in',
    logout: 'signed out',
    publish: 'published',
    moderate: 'moderated',
};

/** One audit row as a sentence: "ada@example.com updated post" */
export function describeAuditEntry(entry: AuditLogRecord): string {
    const who = entry.user_email || 'Someone';
    const verb = VERBS[entry.action] ?? entry.action.replace(/[_-]+/g, ' ');
    const what =
        entry.action === 'login' || entry.action === 'logout' ? '' : entry.resource_type.replace(/[_-]+/g, ' ');
    const sentence = [who, verb, what].filter(Boolean).join(' ');
    return entry.status === 'success' ? sentence : `${sentence} (failed)`;
}

export function useAdminOverview({ isPlatformAdmin }: { isPlatformAdmin: boolean }) {
    const weekAgo = Math.floor((Date.now() - WEEK_MS) / HOUR_MS) * HOUR_MS;

    const flagged = useApiQuery<{ total: number; comments: FlaggedComment[] }>({
        entity: 'comments',
        queryKey: ['flagged', 3],
        endpoint: '/api/admin/comments/flagged?limit=3',
        queryOptions: { ...quiet, enabled: PACKAGES_ENABLED.comments },
    });
    const scheduled = useApiQuery<PaginatedResponse<unknown>>({
        entity: 'posts',
        queryKey: ['count', 'scheduled'],
        endpoint: postsCount({ status: 'scheduled' }),
        queryOptions: { ...quiet, enabled: PACKAGES_ENABLED.ottablog },
    });
    const published = useApiQuery<PaginatedResponse<unknown>>({
        entity: 'posts',
        queryKey: ['count', 'published'],
        endpoint: postsCount({ status: 'published' }),
        queryOptions: { ...quiet, enabled: PACKAGES_ENABLED.ottablog },
    });
    const publishedThisWeek = useApiQuery<PaginatedResponse<unknown>>({
        entity: 'posts',
        queryKey: ['count', 'published', weekAgo],
        endpoint: postsCount({ status: 'published', publishedAt: { $gte: weekAgo } }),
        queryOptions: { ...quiet, enabled: PACKAGES_ENABLED.ottablog },
    });
    const users = useApiQuery<PaginatedResponse<unknown>>({
        entity: 'users',
        queryKey: ['count'],
        endpoint: '/api/admin/users?page=1&perPage=1',
        queryOptions: { ...quiet, enabled: isPlatformAdmin },
    });
    const organizations = useApiQuery<PaginatedResponse<unknown>>({
        entity: 'organizations',
        queryKey: ['count'],
        endpoint: '/api/ottaorm/organizations?page=1&perPage=1',
        queryOptions: { ...quiet, enabled: isPlatformAdmin },
    });
    const queues = useApiQuery<{ stats?: { totalDLQ?: number } }>({
        entity: 'queues',
        queryKey: ['overview'],
        endpoint: '/api/admin/queues',
        queryOptions: { ...quiet, enabled: isPlatformAdmin },
    });
    const switches = useApiQuery<{ readonly?: boolean; lockdown?: boolean }>({
        entity: 'kill-switches',
        queryKey: ['status'],
        endpoint: '/api/system/kill-switches',
        queryOptions: { ...quiet, enabled: isPlatformAdmin },
    });
    const activity = useApiQuery<PaginatedResponse<AuditLogRecord>>({
        entity: 'audit_logs',
        queryKey: ['recent', 8],
        endpoint: '/api/audit/logs?page=1&per_page=8',
        queryOptions: quiet,
    });

    const attention = useMemo<AttentionItem[]>(() => {
        const items: AttentionItem[] = [];
        if (switches.data?.lockdown) {
            items.push({
                key: 'lockdown',
                count: 1,
                label: 'Lockdown is on: every visitor gets the maintenance page',
                href: '/admin/security/kill-switches',
                tone: 'destructive',
            });
        }
        if (switches.data?.readonly) {
            items.push({
                key: 'readonly',
                count: 1,
                label: 'Read-only mode is on: nothing can be saved',
                href: '/admin/security/kill-switches',
                tone: 'warning',
            });
        }
        const deadLetters = queues.data?.stats?.totalDLQ ?? 0;
        if (deadLetters > 0) {
            items.push({
                key: 'dead-letter',
                count: deadLetters,
                label: `${plural(deadLetters, 'job', 'jobs')} in the dead-letter queue`,
                href: '/admin/infrastructure/queues',
                tone: 'destructive',
            });
        }
        const flaggedTotal = flagged.data?.total ?? 0;
        if (flaggedTotal > 0) {
            const details = (flagged.data?.comments ?? []).map((comment) => ({
                key: comment.id,
                text: `${comment.author?.name || 'Anonymous'}: ${comment.body}`,
                href: comment.post ? getPublicContentPath(comment.post.slug, comment.post.contentType) : '',
            }));
            items.push({
                key: 'flagged',
                count: flaggedTotal,
                label: `${plural(flaggedTotal, 'comment', 'comments')} flagged by readers`,
                href: details.find((detail) => detail.href)?.href ?? '/admin/content/blog',
                tone: 'warning',
                details,
            });
        }
        const scheduledTotal = totalOf(scheduled.data) ?? 0;
        if (scheduledTotal > 0) {
            items.push({
                key: 'scheduled',
                count: scheduledTotal,
                label: `${plural(scheduledTotal, 'post', 'posts')} scheduled to publish`,
                href: '/admin/content/blog',
                tone: 'info',
            });
        }
        return items;
    }, [flagged.data, queues.data, scheduled.data, switches.data]);

    const glance = useMemo<GlanceStat[]>(
        () =>
            [
                { label: 'Users', value: totalOf(users.data) },
                { label: 'Organizations', value: totalOf(organizations.data) },
                { label: 'Published posts', value: totalOf(published.data) },
                { label: 'Published this week', value: totalOf(publishedThisWeek.data) },
            ].filter((stat): stat is GlanceStat => typeof stat.value === 'number'),
        [organizations.data, published.data, publishedThisWeek.data, users.data],
    );

    return {
        attention,
        /** True while the first answers are still on their way */
        checking: [flagged, scheduled, queues, switches].some((query) => query.isLoading),
        glance,
        activity: activity.data?.data ?? [],
        activityLoading: activity.isLoading,
    };
}
