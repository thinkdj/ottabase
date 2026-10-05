import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@ottabase/notifications', () => ({
    NotificationModel: { create: vi.fn() },
    NotificationPreference: { first: vi.fn() },
}));

import { NotificationModel, NotificationPreference } from '@ottabase/notifications';
import { notifyUser } from '../notify';

describe('notifyUser', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('writes an inbox row for someone who has not opted out', async () => {
        vi.mocked(NotificationPreference.first).mockResolvedValue(null as any);
        const ok = await notifyUser('u1', {
            title: 'Ada replied to your comment',
            message: 'Well said',
            category: 'comments',
            actionUrl: '/blog/hello',
        });
        expect(ok).toBe(true);
        expect(NotificationModel.create).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'u1',
                title: 'Ada replied to your comment',
                category: 'comments',
                actionUrl: '/blog/hello',
                channels: '["inbox"]',
            }),
        );
    });

    it('stays quiet for a kind the person turned off', async () => {
        vi.mocked(NotificationPreference.first).mockResolvedValue({ isCategoryEnabled: () => false } as any);
        expect(await notifyUser('u1', { title: 't', message: 'm', category: 'comments' })).toBe(false);
        expect(NotificationModel.create).not.toHaveBeenCalled();
    });

    it('never throws into the action that caused it', async () => {
        vi.mocked(NotificationPreference.first).mockRejectedValue(new Error('db down'));
        expect(await notifyUser('u1', { title: 't', message: 'm', category: 'organizations' })).toBe(false);
    });
});
