import { OrganizationMember, User } from '@ottabase/ottaorm/models';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@ottabase/auth/backend', () => ({
    getSession: vi.fn(),
}));

vi.mock('../utils', () => ({
    createRBACContext: vi.fn(async () => ({
        roles: ['member'],
        permissions: ['*:read'],
        isAuthenticated: true,
    })),
}));

import { getSession } from '@ottabase/auth/backend';
import { getRequestContext } from '../request-context';

describe('getRequestContext.memberOrganizationIds', () => {
    const env = {};

    beforeEach(() => {
        vi.mocked(getSession).mockResolvedValue({
            user: { id: 'user-member', email: 'm@e.co' },
        } as any);
        vi.spyOn(User, 'find').mockResolvedValue({ id: 'user-member' } as any);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('populates the list of active memberships for non-owner members', async () => {
        vi.spyOn(OrganizationMember, 'getUserOrganizations').mockResolvedValue([
            { userId: 'user-member', organizationId: 'org-a', status: 'active' } as any,
            { userId: 'user-member', organizationId: 'org-b', status: 'active' } as any,
        ]);

        const request = new Request('http://localhost/api/whatever', {
            headers: { 'x-org-id': 'org-a' },
        });

        const ctx = await getRequestContext(request, env as any);

        expect(ctx.memberOrganizationIds).toEqual(['org-a', 'org-b']);
        expect(ctx.organizationId).toBe('org-a');
        expect(OrganizationMember.getUserOrganizations).toHaveBeenCalledWith('user-member', { status: 'active' });
    });

    it('returns an empty list when the user has no active memberships', async () => {
        vi.spyOn(OrganizationMember, 'getUserOrganizations').mockResolvedValue([]);

        const request = new Request('http://localhost/api/whatever', {
            headers: { 'x-org-id': 'org-a' },
        });
        const ctx = await getRequestContext(request, env as any);

        expect(ctx.memberOrganizationIds).toEqual([]);
    });

    it('serves the cached list when RBACCache returns a hit', async () => {
        const getUserMemberOrgs = vi.fn(async () => ['org-cached-1', 'org-cached-2']);
        const setUserMemberOrgs = vi.fn(async () => undefined);
        const cache = {
            getUserMemberOrgs,
            setUserMemberOrgs,
            // Unused but required by createRBACContext interface
            getUserRoles: vi.fn(),
            setUserRoles: vi.fn(),
            invalidateUser: vi.fn(),
        } as any;
        const getUserOrganizations = vi.spyOn(OrganizationMember, 'getUserOrganizations').mockResolvedValue([]);

        const request = new Request('http://localhost/api/whatever', {
            headers: { 'x-org-id': 'org-a' },
        });
        const ctx = await getRequestContext(request, env as any, { cache });

        expect(ctx.memberOrganizationIds).toEqual(['org-cached-1', 'org-cached-2']);
        expect(getUserMemberOrgs).toHaveBeenCalledWith('user-member', 'org-a');
        expect(getUserOrganizations).not.toHaveBeenCalled();
        expect(setUserMemberOrgs).not.toHaveBeenCalled();
    });

    it('populates the cache on a miss', async () => {
        const getUserMemberOrgs = vi.fn(async () => null);
        const setUserMemberOrgs = vi.fn(async () => undefined);
        const cache = {
            getUserMemberOrgs,
            setUserMemberOrgs,
            getUserRoles: vi.fn(),
            setUserRoles: vi.fn(),
            invalidateUser: vi.fn(),
        } as any;
        vi.spyOn(OrganizationMember, 'getUserOrganizations').mockResolvedValue([
            { userId: 'user-member', organizationId: 'org-fresh' } as any,
        ]);

        const request = new Request('http://localhost/api/whatever', {
            headers: { 'x-org-id': 'org-a' },
        });
        const ctx = await getRequestContext(request, env as any, { cache });

        expect(ctx.memberOrganizationIds).toEqual(['org-fresh']);
        expect(setUserMemberOrgs).toHaveBeenCalledWith('user-member', 'org-a', ['org-fresh']);
    });
});
