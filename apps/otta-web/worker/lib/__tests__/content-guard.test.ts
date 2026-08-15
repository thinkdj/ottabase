import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRequestContext = vi.fn();
const getSecurityContext = vi.fn();
const hasPermission = vi.fn();

vi.mock('@ottabase/rbac/request-context', () => ({
    getRequestContext: (...args: unknown[]) => getRequestContext(...args),
}));

vi.mock('@ottabase/rbac/admin-guard', () => ({
    hasPermission: (...args: unknown[]) => hasPermission(...args),
    isPlatformAdmin: vi.fn(),
}));

vi.mock('../auth-utils', () => ({
    getAuthOptions: vi.fn(),
    getSecurityContext: (...args: unknown[]) => getSecurityContext(...args),
}));

vi.mock('../db-utils', () => ({
    initDbConnection: vi.fn(),
}));

import { requireContentPermission } from '../content-guard';

function context(headers?: HeadersInit) {
    const request = new Request('http://127.0.0.1:3003/api/blog/photo-journals', {
        method: 'POST',
        headers,
    });
    return {
        request,
        env: { OBCF_D1: {}, OBCF_KV: {}, APP_ID: 'otta-web' },
        url: new URL(request.url),
    } as any;
}

describe('requireContentPermission', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('returns the canonical platform security context instead of the RBAC system sentinel', async () => {
        const session = {
            user: {
                id: 'owner-1',
                organizationId: 'org-personal',
                permissions: ['*:*'],
                platformAdmin: true,
            },
        };
        const reqCtx = {
            session,
            user: { id: 'owner-1' },
            userId: 'owner-1',
            organizationId: 'system',
            appId: 'web',
            roles: ['platform_owner'],
            permissions: ['*:*'],
            systemRoles: ['platform_owner'],
            systemPermissions: ['*:*'],
            isAuthenticated: true,
            isSystemScope: true,
        };
        const canonical = {
            userId: 'owner-1',
            organizationId: null,
            appId: 'otta-web',
            roles: ['platform_owner'],
            permissions: ['*:*'],
            platformAdmin: true,
            memberOrganizationIds: ['org-personal'],
        };
        getRequestContext.mockResolvedValue(reqCtx);
        hasPermission.mockReturnValue(true);
        getSecurityContext.mockResolvedValue(canonical);
        const ctx = context({ 'x-org-id': 'platform' });

        const result = await requireContentPermission(ctx, 'posts:create');

        expect(result).toEqual({ session, securityContext: canonical });
        expect(getSecurityContext).toHaveBeenCalledWith(ctx.request, session, ctx.env);
        expect((result as any).securityContext).not.toBe(reqCtx);
    });

    it('preserves a membership-validated organization context for an author', async () => {
        const session = {
            user: {
                id: 'author-1',
                organizationId: 'org-1',
                permissions: ['posts:create', 'posts:update'],
                platformAdmin: false,
            },
        };
        getRequestContext.mockResolvedValue({
            session,
            user: { id: 'author-1' },
            organizationId: 'org-1',
            permissions: ['posts:create', 'posts:update'],
            isAuthenticated: true,
        });
        hasPermission.mockReturnValue(true);
        const canonical = {
            userId: 'author-1',
            organizationId: 'org-1',
            appId: 'otta-web',
            permissions: ['posts:create', 'posts:update'],
            platformAdmin: false,
            memberOrganizationIds: ['org-1'],
        };
        getSecurityContext.mockResolvedValue(canonical);

        const result = await requireContentPermission(context(), 'posts:create');

        expect(result).toEqual({ session, securityContext: canonical });
    });

    it('denies a missing permission before resolving the write security context', async () => {
        getRequestContext.mockResolvedValue({
            session: { user: { id: 'member-1' } },
            user: { id: 'member-1' },
            organizationId: 'org-1',
            permissions: ['*:read'],
            isAuthenticated: true,
        });
        hasPermission.mockReturnValue(false);

        const result = await requireContentPermission(context(), 'posts:create');

        expect(result).toBeInstanceOf(Response);
        expect((result as Response).status).toBe(403);
        expect(getSecurityContext).not.toHaveBeenCalled();
    });
});
