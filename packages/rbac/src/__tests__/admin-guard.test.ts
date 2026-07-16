import { describe, expect, it } from 'vitest';
import { assertAdmin } from '../admin-guard';
import type { RequestContext } from '../request-context';

function makeContext(overrides: Partial<RequestContext>): RequestContext {
    return {
        sessionUser: { id: 'user-1' },
        user: { id: 'user-1' },
        organizationId: 'system',
        appId: 'web',
        roles: [],
        permissions: [],
        isAuthenticated: true,
        isSystemScope: true,
        ...overrides,
    } as RequestContext;
}

describe('assertAdmin', () => {
    it('allows the bootstrapped platform_owner at system scope', () => {
        const result = assertAdmin(makeContext({ roles: ['platform_owner'] }), { scope: 'system' });
        expect(result).not.toBeInstanceOf(Response);
    });

    it('allows org-scoped owner for organization scope', () => {
        const result = assertAdmin(makeContext({ organizationId: 'org-1', isSystemScope: false, roles: ['owner'] }), {
            scope: 'organization',
        });
        expect(result).not.toBeInstanceOf(Response);
    });

    it('denies non-admin roles', () => {
        const result = assertAdmin(makeContext({ roles: ['member'] }), { scope: 'system' });
        expect(result).toBeInstanceOf(Response);
        expect((result as Response).status).toBe(403);
    });

    it('denies unauthenticated requests', () => {
        const result = assertAdmin(makeContext({ isAuthenticated: false, user: null, roles: ['platform_owner'] }));
        expect(result).toBeInstanceOf(Response);
        expect((result as Response).status).toBe(401);
    });
});
