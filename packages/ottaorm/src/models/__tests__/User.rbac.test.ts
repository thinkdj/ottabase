import { afterEach, describe, expect, it, vi } from 'vitest';
import { User } from '../User';
import { UserRole } from '../UserRole';

/**
 * Role grants are org-scoped. Every User RBAC method must be told WHICH org; an omitted org used to
 * widen the query to every tenant (merging roles/permissions across orgs, or treating a grant in
 * another org as "already assigned").
 */
describe('User RBAC methods are org-scoped', () => {
    afterEach(() => vi.restoreAllMocks());

    const user = () => new User({ entity: 'users', data: { id: 'u1', email: 'u1@example.com' } });

    it.each([
        ['assignRole', (u: User) => u.assignRole('r1', undefined, undefined as unknown as string)],
        ['removeRole', (u: User) => u.removeRole('r1', undefined as unknown as string)],
        ['hasRole', (u: User) => u.hasRole('admin', undefined as unknown as string)],
        ['roles', (u: User) => u.roles({} as { organizationId: string })],
        ['getPermissions', (u: User) => u.getPermissions({} as { organizationId: string })],
    ])('%s throws without an organizationId', async (_name, call) => {
        const where = vi.spyOn(UserRole as any, 'where');
        const first = vi.spyOn(UserRole as any, 'first');
        await expect(call(user())).rejects.toThrow(/organizationId/);
        expect(where).not.toHaveBeenCalled();
        expect(first).not.toHaveBeenCalled();
    });

    it('assignRole checks the FULL grant key, so a grant in another org does not count', async () => {
        const first = vi.spyOn(UserRole as any, 'first').mockResolvedValue(null);
        const create = vi.spyOn(UserRole as any, 'create').mockResolvedValue({});
        const cache = { invalidateOrganization: vi.fn(), invalidateUser: vi.fn() };

        await user().assignRole('r1', 'admin-1', 'org-2', { cache });

        expect(first).toHaveBeenCalledWith({ userId: 'u1', roleId: 'r1', organizationId: 'org-2' });
        expect(create).toHaveBeenCalledWith({
            userId: 'u1',
            roleId: 'r1',
            assignedBy: 'admin-1',
            organizationId: 'org-2',
        });
        // invalidateUser(userId) without an org always threw (and was swallowed); bump the org version.
        expect(cache.invalidateOrganization).toHaveBeenCalledWith('org-2');
        expect(cache.invalidateUser).not.toHaveBeenCalled();
    });

    it('removeRole revokes in the given org and invalidates that org', async () => {
        const removeRole = vi.spyOn(UserRole, 'removeRole').mockResolvedValue(undefined);
        const cache = { invalidateOrganization: vi.fn() };

        await user().removeRole('r1', 'org-1', { cache });

        expect(removeRole).toHaveBeenCalledWith('u1', 'r1', 'org-1');
        expect(cache.invalidateOrganization).toHaveBeenCalledWith('org-1');
    });

    it('roles() filters user_roles by the given org', async () => {
        const where = vi.spyOn(UserRole as any, 'where').mockResolvedValue([]);
        await expect(user().roles({ organizationId: 'org-1' })).resolves.toEqual([]);
        expect(where).toHaveBeenCalledWith({ userId: 'u1', organizationId: 'org-1' });
    });
});
