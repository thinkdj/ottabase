import { describe, expect, it, vi } from 'vitest';

const logAudit = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('@ottabase/audit', () => ({
    logAudit,
    extractRequestContext: (_request: Request, userId?: string, userEmail?: string) => ({
        userId,
        userEmail,
        url: 'http://localhost/api/brand/kits/k1',
        method: 'PUT',
    }),
}));

import { logBrandAudit } from '../handlers/audit-helper';

describe('logBrandAudit', () => {
    it("records the actor's organization and the kit's app, so tenant audit views can see the row", async () => {
        await logBrandAudit(
            'brand.kit.update',
            new Request('http://localhost/api/brand/kits/k1', { method: 'PUT' }),
            { appId: 'web', kitId: 'k1' },
            { userId: 'u1', userEmail: 'u1@example.com', organizationId: 'org-1' },
        );

        expect(logAudit).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'u1',
                organizationId: 'org-1',
                appId: 'web',
                action: 'brand.kit.update',
            }),
        );
    });

    it('swallows audit failures', async () => {
        logAudit.mockRejectedValueOnce(new Error('db down'));
        await expect(
            logBrandAudit('brand.kit.update', new Request('http://localhost/'), { appId: null }),
        ).resolves.toBeUndefined();
    });
});
