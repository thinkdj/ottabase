import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@ottabase/auth/backend', () => ({ getSession: vi.fn() }));
vi.mock('../../lib/auth-utils', () => ({ getAuthOptions: () => ({}) }));
vi.mock('../../lib/db-utils', () => ({ initDbConnection: vi.fn() }));
vi.mock('@ottabase/notifications', () => ({
    NotificationModel: { paginate: vi.fn(), count: vi.fn(), where: vi.fn() },
    NotificationPreference: { first: vi.fn(), getOrCreate: vi.fn() },
}));

import { getSession } from '@ottabase/auth/backend';
import { NotificationModel, NotificationPreference } from '@ottabase/notifications';
import { handleNotificationPreferences, handleNotificationsList, handleNotificationsMarkRead } from '../notifications';

function ctx(url: string, method = 'GET', body?: unknown) {
    const request = new Request(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });
    return { request, env: { OBCF_D1: {} }, url: new URL(url) } as any;
}
const row = (data: Record<string, unknown>) => ({ toJson: () => data, markAsRead: vi.fn() });

describe('notification routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getSession).mockResolvedValue({ user: { id: 'u1' } } as any);
    });

    it('refuses anyone not signed in', async () => {
        vi.mocked(getSession).mockResolvedValue(null as any);
        const res = await handleNotificationsList(ctx('http://x/api/notifications'));
        expect(res.status).toBe(401);
        expect(NotificationModel.paginate).not.toHaveBeenCalled();
    });

    it('lists only my notifications, newest first, with the unread count', async () => {
        vi.mocked(NotificationModel.paginate).mockResolvedValue({
            data: [row({ id: 'n1', title: 'Hi' })],
            page: 1,
            perPage: 20,
            total: 1,
            totalPages: 1,
        } as any);
        vi.mocked(NotificationModel.count).mockResolvedValue(3);
        const res = await handleNotificationsList(ctx('http://x/api/notifications?unread=1'));
        expect(NotificationModel.paginate).toHaveBeenCalledWith(
            1,
            20,
            { userId: 'u1', status: { $ne: 'read' } },
            { orderBy: 'createdAt', orderDirection: 'desc' },
        );
        expect(NotificationModel.count).toHaveBeenCalledWith({ userId: 'u1', status: { $ne: 'read' } });
        expect(await res.json()).toEqual({
            data: [{ id: 'n1', title: 'Hi' }],
            pagination: { page: 1, perPage: 20, total: 1, totalPages: 1, next: null, prev: null },
            unread: 3,
        });
    });

    it('marks the given notifications read, and all of them without ids', async () => {
        const rows = [row({ id: 'n1' }), row({ id: 'n2' })];
        vi.mocked(NotificationModel.where).mockResolvedValue(rows as any);
        const res = await handleNotificationsMarkRead(
            ctx('http://x/api/notifications/read', 'POST', { ids: ['n1', 'n2'] }),
        );
        expect(NotificationModel.where).toHaveBeenCalledWith(
            { userId: 'u1', status: { $ne: 'read' }, id: { $in: ['n1', 'n2'] } },
            { limit: 500 },
        );
        expect(rows[0].markAsRead).toHaveBeenCalled();
        expect(await res.json()).toEqual({ updated: 2 });

        await handleNotificationsMarkRead(ctx('http://x/api/notifications/read', 'POST', {}));
        expect(NotificationModel.where).toHaveBeenLastCalledWith(
            { userId: 'u1', status: { $ne: 'read' } },
            { limit: 500 },
        );
    });

    it('reads preferences as all on until something is saved, then keeps what was saved', async () => {
        vi.mocked(NotificationPreference.first).mockResolvedValue(null as any);
        const res = await handleNotificationPreferences(ctx('http://x/api/notifications/preferences'));
        expect(await res.json()).toEqual({
            categories: {
                comments: { label: 'Replies to your comments', enabled: true },
                organizations: { label: 'Changes to your organizations', enabled: true },
            },
        });

        const prefs = {
            isCategoryEnabled: (key: string) => key !== 'comments',
            setCategoryPreference: vi.fn(),
        };
        vi.mocked(NotificationPreference.getOrCreate).mockResolvedValue(prefs as any);
        const saved = await handleNotificationPreferences(
            ctx('http://x/api/notifications/preferences', 'PUT', { categories: { comments: false, bogus: false } }),
        );
        expect(prefs.setCategoryPreference).toHaveBeenCalledTimes(1);
        expect(prefs.setCategoryPreference).toHaveBeenCalledWith('comments', false);
        const body = (await saved.json()) as { categories: Record<string, { enabled: boolean }> };
        expect(body.categories.comments.enabled).toBe(false);
    });
});
