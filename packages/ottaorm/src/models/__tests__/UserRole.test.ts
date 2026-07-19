import { afterEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '../UserRole';

/**
 * Callers gate a privilege DOWNGRADE on this method (roster demotion/removal revokes the user's
 * org-scoped grants before the membership row is rewritten). So "resolved" has to mean "every grant
 * is gone" — a partial delete that resolves would let a demoted owner keep media:*, org:admin, etc.
 */
describe('UserRole.revokeAllForOrganization', () => {
    afterEach(() => vi.restoreAllMocks());

    it('destroys every grant for the user in that org and returns the count', async () => {
        const destroyA = vi.fn().mockResolvedValue(undefined);
        const destroyB = vi.fn().mockResolvedValue(undefined);
        const whereSpy = vi
            .spyOn(UserRole as any, 'where')
            .mockResolvedValueOnce([{ destroy: destroyA }, { destroy: destroyB }])
            .mockResolvedValueOnce([]); // re-read confirms none survived

        await expect(UserRole.revokeAllForOrganization('u1', 'org-1')).resolves.toBe(2);

        expect(whereSpy).toHaveBeenCalledWith({ userId: 'u1', organizationId: 'org-1' });
        expect(destroyA).toHaveBeenCalled();
        expect(destroyB).toHaveBeenCalled();
    });

    it('THROWS when a grant survives — a partial delete must not resolve as success', async () => {
        vi.spyOn(UserRole as any, 'where')
            .mockResolvedValueOnce([{ destroy: vi.fn().mockResolvedValue(undefined) }])
            .mockResolvedValueOnce([{ id: 'grant-still-present' }]); // re-read finds a survivor

        await expect(UserRole.revokeAllForOrganization('u1', 'org-1')).rejects.toThrow(/still present/);
    });

    it('propagates a destroy() failure instead of swallowing it', async () => {
        vi.spyOn(UserRole as any, 'where').mockResolvedValueOnce([
            { destroy: vi.fn().mockRejectedValue(new Error('D1 unavailable')) },
        ]);

        await expect(UserRole.revokeAllForOrganization('u1', 'org-1')).rejects.toThrow('D1 unavailable');
    });
});
