import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireAdminAccess } from '../admin-guard';

vi.mock('@ottabase/rbac/request-context', () => ({
    getRequestContext: vi.fn(),
}));

vi.mock('@ottabase/rbac/admin-guard', () => ({
    assertAdmin: vi.fn(),
    SYSTEM_ORGANIZATION_ID: 'system',
}));

vi.mock('../db-utils', () => ({
    initDbConnection: vi.fn(),
}));

function createContext(overrides: Partial<any> = {}) {
    const request = overrides.request || new Request('https://example.com/api/admin/test', { method: 'GET' });
    return {
        request,
        env: {
            OBCF_D1: {},
            ALLOW_NULL_TENANT: 'true',
            ...(overrides.env || {}),
        },
        url: overrides.url || new URL(request.url),
        route: overrides.route || '/api/admin/test',
        method: request.method,
        corsHeaders: overrides.corsHeaders || {},
        withAuthCors: overrides.withAuthCors || ((r: Response) => r),
    } as any;
}

const mockUser = {
    get: (key: string) => (key === 'id' ? 'user-1' : null),
};

describe('requireAdminAccess', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('returns 401 when no session', async () => {
        const { getRequestContext } = await import('@ottabase/rbac/request-context');
        const { assertAdmin } = await import('@ottabase/rbac/admin-guard');
        (getRequestContext as any).mockResolvedValue({
            sessionUser: null,
            user: null,
            organizationId: null,
            appId: 'web',
            roles: [],
            permissions: [],
            isAuthenticated: false,
            isSystemScope: false,
        });
        (assertAdmin as any).mockReturnValue(new Response(null, { status: 401 }));

        const result = await requireAdminAccess(createContext());
        expect(result).toBeInstanceOf(Response);
        expect((result as Response).status).toBe(401);
    });

    it('returns 403 when user lacks admin role', async () => {
        const { getRequestContext } = await import('@ottabase/rbac/request-context');
        const { assertAdmin } = await import('@ottabase/rbac/admin-guard');
        (getRequestContext as any).mockResolvedValue({
            sessionUser: { id: 'user-1' },
            user: mockUser,
            organizationId: 'system',
            appId: 'web',
            roles: ['member'],
            permissions: [],
            isAuthenticated: true,
            isSystemScope: true,
        });
        (assertAdmin as any).mockReturnValue(new Response(null, { status: 403 }));

        const result = await requireAdminAccess(createContext());
        expect(result).toBeInstanceOf(Response);
        expect((result as Response).status).toBe(403);
    });

    it('allows system owner', async () => {
        const { getRequestContext } = await import('@ottabase/rbac/request-context');
        const { assertAdmin, SYSTEM_ORGANIZATION_ID } = await import('@ottabase/rbac/admin-guard');
        (getRequestContext as any).mockResolvedValue({
            sessionUser: { id: 'user-1' },
            user: mockUser,
            organizationId: SYSTEM_ORGANIZATION_ID,
            appId: 'web',
            roles: ['owner'],
            permissions: ['*:*'],
            isAuthenticated: true,
            isSystemScope: true,
        });
        (assertAdmin as any).mockReturnValue({ user: mockUser, organizationId: SYSTEM_ORGANIZATION_ID });

        const result = await requireAdminAccess(createContext());
        expect(result).not.toBeInstanceOf(Response);
        expect((result as any).organizationId).toBe(SYSTEM_ORGANIZATION_ID);
    });

    it('allows org admin for organization scope', async () => {
        const request = new Request('https://example.com/api/admin/test', {
            headers: {
                'x-organization-id': 'org-123',
            },
        });
        const { getRequestContext } = await import('@ottabase/rbac/request-context');
        const { assertAdmin } = await import('@ottabase/rbac/admin-guard');
        (getRequestContext as any).mockResolvedValue({
            sessionUser: { id: 'user-1' },
            user: mockUser,
            organizationId: 'org-123',
            appId: 'web',
            roles: ['admin'],
            permissions: [],
            isAuthenticated: true,
            isSystemScope: false,
        });
        (assertAdmin as any).mockReturnValue({ user: mockUser, organizationId: 'org-123' });

        const result = await requireAdminAccess(createContext({ request }), { scope: 'organization' });
        expect(result).not.toBeInstanceOf(Response);
        expect((result as any).organizationId).toBe('org-123');
    });
});
