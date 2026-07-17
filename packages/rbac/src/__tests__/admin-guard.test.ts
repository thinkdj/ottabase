import { describe, expect, it } from 'vitest';
import { assertAdmin, isOrgAdmin, isPlatformAdmin } from '../admin-guard';
import type { RequestContext } from '../request-context';

function makeContext(overrides: Partial<RequestContext>): RequestContext {
    return {
        sessionUser: { id: 'user-1' },
        user: { id: 'user-1' },
        organizationId: 'system',
        appId: 'web',
        roles: [],
        permissions: [],
        systemRoles: [],
        systemPermissions: [],
        isAuthenticated: true,
        isSystemScope: true,
        ...overrides,
    } as RequestContext;
}

/** Platform owner: system-scoped '*:*'. */
const platformOwner = {
    roles: ['platform_owner'],
    permissions: ['*:*'],
    systemRoles: ['platform_owner'],
    systemPermissions: ['*:*'],
};

/** Org owner: org-scoped bundle incl. org:admin, NO system grant. */
const orgOwner = {
    organizationId: 'org-1',
    isSystemScope: false,
    roles: ['owner'],
    permissions: ['org:admin', '*:read', '*:create', '*:update', '*:delete'],
    systemRoles: [],
    systemPermissions: [],
};

describe('assertAdmin — permission + scope (never role names)', () => {
    it('allows the bootstrapped platform_owner at system scope', () => {
        const result = assertAdmin(makeContext(platformOwner), { scope: 'system' });
        expect(result).not.toBeInstanceOf(Response);
    });

    it('allows the platform_owner at organization scope too (via *:* → org:admin)', () => {
        const result = assertAdmin(makeContext({ ...platformOwner, organizationId: 'org-9' }), {
            scope: 'organization',
        });
        expect(result).not.toBeInstanceOf(Response);
    });

    it('allows an org owner for organization scope', () => {
        const result = assertAdmin(makeContext(orgOwner), { scope: 'organization' });
        expect(result).not.toBeInstanceOf(Response);
    });

    it('DENIES an org owner at system scope (org:admin is not platform:admin)', () => {
        const result = assertAdmin(makeContext(orgOwner), { scope: 'system' });
        expect(result).toBeInstanceOf(Response);
        expect((result as Response).status).toBe(403);
    });

    it('DENIES a role merely NAMED owner/admin with no admin permission', () => {
        const result = assertAdmin(
            makeContext({
                organizationId: 'org-1',
                isSystemScope: false,
                roles: ['owner', 'admin'],
                permissions: ['posts:read'],
            }),
            { scope: 'organization' },
        );
        expect(result).toBeInstanceOf(Response);
        expect((result as Response).status).toBe(403);
    });

    it('denies unauthenticated requests', () => {
        const result = assertAdmin(makeContext({ isAuthenticated: false, user: null, ...platformOwner }));
        expect(result).toBeInstanceOf(Response);
        expect((result as Response).status).toBe(401);
    });
});

describe('isPlatformAdmin / isOrgAdmin', () => {
    it('platform admin requires a SYSTEM-scoped grant', () => {
        expect(isPlatformAdmin(makeContext(platformOwner))).toBe(true);
        // Same permission org-scoped only → not a platform admin.
        expect(isPlatformAdmin(makeContext({ permissions: ['platform:admin'], systemPermissions: [] }))).toBe(false);
    });

    it('org admin accepts org:admin (or platform owner via *:*)', () => {
        expect(isOrgAdmin(makeContext(orgOwner))).toBe(true);
        expect(isOrgAdmin(makeContext(platformOwner))).toBe(true);
        expect(isOrgAdmin(makeContext({ permissions: ['posts:read'] }))).toBe(false);
    });
});
