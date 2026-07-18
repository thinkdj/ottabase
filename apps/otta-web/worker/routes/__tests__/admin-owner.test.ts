import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/rate-limiting', () => ({ enforceRateLimit: vi.fn() }));
vi.mock('../../lib/db-utils', () => ({ initDbConnection: vi.fn() }));
vi.mock('../../lib/utils', () => ({
    getClientIpAddress: vi.fn(() => '1.2.3.4'),
    normalizeEmail: vi.fn((e: string) => e.trim().toLowerCase()),
    readJson: vi.fn(),
}));
vi.mock('@ottabase/ottaorm/models', () => ({
    PLATFORM_OWNER_ROLE_NAME: 'platform_owner',
    Role: { ensureDefaultRoles: vi.fn(), findByName: vi.fn() },
    User: { find: vi.fn(), first: vi.fn() },
    UserRole: { where: vi.fn().mockResolvedValue([]) },
}));
vi.mock('../../lib/admin-guard', () => ({ SYSTEM_ORGANIZATION_ID: 'system' }));

import { User } from '@ottabase/ottaorm/models';
import { enforceRateLimit } from '../../lib/rate-limiting';
import { normalizeEmail, readJson } from '../../lib/utils';
import { handleAdminPromotePlatformOwner } from '../admin-owner';

function ctx() {
    return {
        request: new Request('http://localhost/api/admin/platform-owner/promote', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{}',
        }),
        env: { BOOTSTRAP_OWNER_SECRET: 'secret', OBCF_D1: {} },
    } as any;
}

describe('handleAdminPromotePlatformOwner', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns the rate-limit response BEFORE reading the body / checking the secret', async () => {
        vi.mocked(enforceRateLimit).mockResolvedValue(new Response('rl', { status: 429 }));

        const res = await handleAdminPromotePlatformOwner(ctx());

        expect(res.status).toBe(429);
        expect(readJson).not.toHaveBeenCalled();
    });

    it('normalizes the email (trim + lowercase) before lookup', async () => {
        vi.mocked(enforceRateLimit).mockResolvedValue(null);
        vi.mocked(readJson as any).mockResolvedValue({ secret: 'secret', email: '  Owner@Example.COM ' });
        vi.mocked(User.first as any).mockResolvedValue(null); // 404, but the lookup still happened

        const res = await handleAdminPromotePlatformOwner(ctx());

        expect(normalizeEmail).toHaveBeenCalledWith('  Owner@Example.COM ');
        expect(User.first).toHaveBeenCalledWith({ email: 'owner@example.com' });
        expect(res.status).toBe(404);
    });
});
