import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizationMember } from '../OrganizationMember';
import { Role } from '../Role';
import { User } from '../User';
import { UserRole } from '../UserRole';

describe('User org-scoped membership guard', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('returns no roles for org scope when user is not an active member', async () => {
        const user = new User({ entity: 'users', data: { id: 'user-1' } });

        const cache = {
            getUserRoles: vi.fn(async () => ['admin']),
            setUserRoles: vi.fn(async () => undefined),
            setUserPermissions: vi.fn(async () => undefined),
        };

        vi.spyOn(OrganizationMember, 'isMember').mockResolvedValue(false);
        const whereSpy = vi.spyOn(UserRole, 'where').mockResolvedValue([] as any);

        const roles = await user.roles({ organizationId: 'org-1', cache });

        expect(roles).toEqual([]);
        expect(cache.getUserRoles).not.toHaveBeenCalled();
        expect(cache.setUserRoles).toHaveBeenCalledWith('user-1', [], 'org-1');
        expect(cache.setUserPermissions).toHaveBeenCalledWith('user-1', [], 'org-1');
        expect(whereSpy).not.toHaveBeenCalled();
    });

    it('returns no permissions for org scope when user is not an active member', async () => {
        const user = new User({ entity: 'users', data: { id: 'user-2' } });

        const cache = {
            getUserPermissions: vi.fn(async () => ['*:*']),
            setUserPermissions: vi.fn(async () => undefined),
        };

        vi.spyOn(OrganizationMember, 'isMember').mockResolvedValue(false);

        const permissions = await user.getPermissions({ organizationId: 'org-2', cache });

        expect(permissions).toEqual([]);
        expect(cache.getUserPermissions).not.toHaveBeenCalled();
        expect(cache.setUserPermissions).toHaveBeenCalledWith('user-2', [], 'org-2');
    });

    it('hasRole respects membership guard for org-scoped checks', async () => {
        const user = new User({ entity: 'users', data: { id: 'user-3' } });

        vi.spyOn(OrganizationMember, 'isMember').mockResolvedValue(false);
        vi.spyOn(Role, 'whereIn').mockResolvedValue([] as any);

        const allowed = await user.hasRole('admin', 'org-3');
        expect(allowed).toBe(false);
    });
});
