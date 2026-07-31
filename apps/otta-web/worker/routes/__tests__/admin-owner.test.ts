import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/rate-limiting', () => ({ enforceBruteForceThrottle: vi.fn() }));
vi.mock('../../lib/auth-utils', () => ({ reconcileSystemRoleSessions: vi.fn() }));
vi.mock('../../lib/db-utils', () => ({ initDbConnection: vi.fn() }));
vi.mock('@ottabase/auth/backend', () => ({ provisionPlatformOwnerOrganization: vi.fn() }));
vi.mock('../../lib/utils', () => ({
    getClientIpAddress: vi.fn(() => '1.2.3.4'),
    normalizeEmail: vi.fn((e: string) => e.trim().toLowerCase()),
    readJson: vi.fn(),
}));
vi.mock('@ottabase/ottaorm/models', () => ({
    PLATFORM_OWNER_ROLE_NAME: 'platform_owner',
    Role: { ensureDefaultRoles: vi.fn(), findByName: vi.fn() },
    User: { find: vi.fn(), first: vi.fn() },
    UserRole: { first: vi.fn(), where: vi.fn().mockResolvedValue([]) },
}));
vi.mock('../../lib/admin-guard', () => ({ SYSTEM_ORGANIZATION_ID: 'system' }));

import { provisionPlatformOwnerOrganization } from '@ottabase/auth/backend';
import { Role, User, UserRole } from '@ottabase/ottaorm/models';
import { reconcileSystemRoleSessions } from '../../lib/auth-utils';
import { enforceBruteForceThrottle } from '../../lib/rate-limiting';
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
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(provisionPlatformOwnerOrganization).mockResolvedValue('org-personal');
    });

    it('returns the rate-limit response BEFORE reading the body / checking the secret', async () => {
        vi.mocked(enforceBruteForceThrottle).mockResolvedValue(new Response('rl', { status: 429 }));

        const res = await handleAdminPromotePlatformOwner(ctx());

        expect(res.status).toBe(429);
        expect(readJson).not.toHaveBeenCalled();
    });

    it('normalizes the email (trim + lowercase) before lookup', async () => {
        vi.mocked(enforceBruteForceThrottle).mockResolvedValue(null);
        vi.mocked(readJson as any).mockResolvedValue({ secret: 'secret', email: '  Owner@Example.COM ' });
        vi.mocked(User.first as any).mockResolvedValue(null); // 404, but the lookup still happened

        const res = await handleAdminPromotePlatformOwner(ctx());

        expect(normalizeEmail).toHaveBeenCalledWith('  Owner@Example.COM ');
        expect(User.first).toHaveBeenCalledWith({ email: 'owner@example.com' });
        expect(res.status).toBe(404);
    });

    it('assigns the grant AND refreshes the promoted user session on success', async () => {
        vi.mocked(enforceBruteForceThrottle).mockResolvedValue(null);
        vi.mocked(readJson as any).mockResolvedValue({ secret: 'secret', userId: 'u-target' });
        const assignRole = vi.fn().mockResolvedValue(undefined);
        vi.mocked(User.find as any).mockResolvedValue({
            get: (k: string) => {
                if (k === 'id') return 'u-target';
                if (k === 'email') return 'owner@example.com';
                if (k === 'name') return 'Owner';
                return null;
            },
            assignRole,
        });
        vi.mocked(Role.ensureDefaultRoles as any).mockResolvedValue([]);
        vi.mocked(Role.findByName as any).mockResolvedValue({
            get: (k: string) => (k === 'id' ? 'role-po' : 'platform_owner'),
        });

        const res = await handleAdminPromotePlatformOwner(ctx());
        const body = (await res.json()) as any;

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(assignRole).toHaveBeenCalledWith('role-po', undefined, 'system');
        expect(provisionPlatformOwnerOrganization).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ id: 'u-target', email: 'owner@example.com', name: 'Owner' }),
        );
        expect(body.personalOrganizationId).toBe('org-personal');
        // The grant must be pushed to the target's live session, not left stale until re-login.
        expect(reconcileSystemRoleSessions).toHaveBeenCalled();
    });

    it('does not write the system grant when workspace provisioning fails', async () => {
        vi.mocked(enforceBruteForceThrottle).mockResolvedValue(null);
        vi.mocked(readJson as any).mockResolvedValue({ secret: 'secret', userId: 'u-target' });
        const assignRole = vi.fn().mockResolvedValue(undefined);
        vi.mocked(User.find as any).mockResolvedValue({
            get: (key: string) => (key === 'id' ? 'u-target' : null),
            assignRole,
        });
        vi.mocked(Role.ensureDefaultRoles as any).mockResolvedValue([]);
        vi.mocked(Role.findByName as any).mockResolvedValue({
            get: (key: string) => (key === 'id' ? 'role-po' : 'platform_owner'),
        });
        vi.mocked(provisionPlatformOwnerOrganization).mockRejectedValueOnce(new Error('organization unavailable'));

        const response = await handleAdminPromotePlatformOwner(ctx());
        const body = (await response.json()) as any;

        expect(response.status).toBe(500);
        expect(body.code).toBe('ACCOUNT_PROVISIONING_FAILED');
        expect(assignRole).not.toHaveBeenCalled();
        expect(reconcileSystemRoleSessions).not.toHaveBeenCalled();
    });

    it('treats a concurrently persisted identical system grant as idempotent success', async () => {
        vi.mocked(enforceBruteForceThrottle).mockResolvedValue(null);
        vi.mocked(readJson as any).mockResolvedValue({ secret: 'secret', userId: 'u-target' });
        const assignRole = vi.fn().mockRejectedValue(new Error('UNIQUE constraint failed: user_roles'));
        vi.mocked(User.find as any).mockResolvedValue({
            get: (key: string) => (key === 'id' ? 'u-target' : null),
            assignRole,
        });
        vi.mocked(Role.ensureDefaultRoles as any).mockResolvedValue([]);
        vi.mocked(Role.findByName as any).mockResolvedValue({
            get: (key: string) => (key === 'id' ? 'role-po' : 'platform_owner'),
        });
        vi.mocked(UserRole.first as any).mockResolvedValue({
            get: (key: string) => (key === 'userId' ? 'u-target' : null),
        });

        const response = await handleAdminPromotePlatformOwner(ctx());

        expect(response.status).toBe(200);
        expect(UserRole.first).toHaveBeenCalledWith({
            userId: 'u-target',
            roleId: 'role-po',
            organizationId: 'system',
        });
        expect(reconcileSystemRoleSessions).toHaveBeenCalled();
    });
});
