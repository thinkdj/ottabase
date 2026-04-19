import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MembershipError, OrganizationMember } from '../OrganizationMember';
import { Role } from '../Role';
import { UserRole } from '../UserRole';

function fakeRole(id: string, name: string): any {
    return { get: (key: string) => (key === 'id' ? id : key === 'name' ? name : null) };
}

function makeDefaultRolesMap() {
    return {
        owner: fakeRole('role-owner', 'owner'),
        admin: fakeRole('role-admin', 'admin'),
        member: fakeRole('role-member', 'member'),
        viewer: fakeRole('role-viewer', 'viewer'),
    };
}

function makeInsertDriver(returned: any) {
    const returning = vi.fn(async () => [returned]);
    const values = vi.fn(() => ({ returning }));
    const insert = vi.fn(() => ({ values }));
    const update = vi.fn(() => ({
        set: () => ({ where: () => ({ returning: async () => [returned] }) }),
    }));
    const del = vi.fn(() => ({ where: async () => undefined }));
    const driver = {
        getDb: () => ({ insert, update, delete: del }),
    };
    return { driver, insert, values, returning, update, delete: del };
}

describe('OrganizationMember lifecycle', () => {
    const defaults = makeDefaultRolesMap();

    beforeEach(() => {
        vi.spyOn(Role, 'ensureDefaults').mockResolvedValue(defaults as any);
        vi.spyOn(UserRole, 'removeRole').mockResolvedValue(undefined as any);
        vi.spyOn(UserRole, 'create').mockResolvedValue({} as any);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('addMember', () => {
        it('inserts the membership row and syncs tenant RBAC when active', async () => {
            const inserted = {
                userId: 'user-1',
                organizationId: 'org-1',
                role: 'member',
                status: 'active',
            };
            const { driver, insert } = makeInsertDriver(inserted);
            vi.spyOn(OrganizationMember as any, 'getDriver').mockReturnValue(driver as any);
            const cache = { invalidateUser: vi.fn().mockResolvedValue(undefined) };

            const result = await OrganizationMember.addMember({
                userId: 'user-1',
                organizationId: 'org-1',
                role: 'member',
                status: 'active',
                cache: cache as any,
            });

            expect(result).toEqual(inserted);
            expect(insert).toHaveBeenCalled();
            // Four revokes + one grant for active status
            expect(UserRole.removeRole).toHaveBeenCalledTimes(4);
            expect(UserRole.create).toHaveBeenCalledWith(
                expect.objectContaining({ userId: 'user-1', organizationId: 'org-1', roleId: 'role-member' }),
            );
            expect(cache.invalidateUser).toHaveBeenCalledWith('user-1', 'org-1');
        });

        it('does NOT grant RBAC for invited members', async () => {
            const inserted = { userId: 'user-1', organizationId: 'org-1', role: 'member', status: 'invited' };
            const { driver } = makeInsertDriver(inserted);
            vi.spyOn(OrganizationMember as any, 'getDriver').mockReturnValue(driver as any);

            await OrganizationMember.addMember({
                userId: 'user-1',
                organizationId: 'org-1',
                role: 'member',
                status: 'invited',
            });

            expect(UserRole.removeRole).toHaveBeenCalledTimes(4);
            expect(UserRole.create).not.toHaveBeenCalled();
        });

        it('rejects unknown roles', async () => {
            await expect(
                OrganizationMember.addMember({
                    userId: 'user-1',
                    organizationId: 'org-1',
                    role: 'superuser' as any,
                }),
            ).rejects.toThrow(/Unknown membership role/);
        });

        it('requires userId', async () => {
            await expect(
                OrganizationMember.addMember({
                    userId: '',
                    organizationId: 'org-1',
                    role: 'member',
                }),
            ).rejects.toBeInstanceOf(MembershipError);
        });
    });

    describe('setRole', () => {
        it('throws LAST_ACTIVE_OWNER_GUARD when demoting the sole active owner', async () => {
            vi.spyOn(OrganizationMember, 'getMember').mockResolvedValue({
                userId: 'user-1',
                organizationId: 'org-1',
                role: 'owner',
                status: 'active',
            } as any);
            vi.spyOn(OrganizationMember, 'isLastActiveOwner').mockResolvedValue(true);

            await expect(OrganizationMember.setRole('user-1', 'org-1', 'member')).rejects.toMatchObject({
                code: 'LAST_ACTIVE_OWNER_GUARD',
            });
        });

        it('throws MEMBER_NOT_FOUND if the membership does not exist', async () => {
            vi.spyOn(OrganizationMember, 'getMember').mockResolvedValue(undefined);

            await expect(OrganizationMember.setRole('ghost', 'org-1', 'admin')).rejects.toMatchObject({
                code: 'MEMBER_NOT_FOUND',
            });
        });

        it('allows demoting an owner when another active owner exists', async () => {
            vi.spyOn(OrganizationMember, 'getMember').mockResolvedValue({
                userId: 'user-1',
                organizationId: 'org-1',
                role: 'owner',
                status: 'active',
            } as any);
            vi.spyOn(OrganizationMember, 'isLastActiveOwner').mockResolvedValue(false);
            const { driver } = makeInsertDriver({
                userId: 'user-1',
                organizationId: 'org-1',
                role: 'admin',
                status: 'active',
            });
            vi.spyOn(OrganizationMember as any, 'getDriver').mockReturnValue(driver as any);

            const cache = { invalidateUser: vi.fn().mockResolvedValue(undefined) };
            const result = await OrganizationMember.setRole('user-1', 'org-1', 'admin', { cache: cache as any });

            expect(result.role).toBe('admin');
            expect(UserRole.create).toHaveBeenCalledWith(
                expect.objectContaining({ roleId: 'role-admin', userId: 'user-1', organizationId: 'org-1' }),
            );
            expect(cache.invalidateUser).toHaveBeenCalledWith('user-1', 'org-1');
        });
    });

    describe('removeMember', () => {
        it('throws LAST_ACTIVE_OWNER_GUARD when removing the only active owner', async () => {
            vi.spyOn(OrganizationMember, 'getMember').mockResolvedValue({
                userId: 'user-1',
                organizationId: 'org-1',
                role: 'owner',
                status: 'active',
            } as any);
            vi.spyOn(OrganizationMember, 'isLastActiveOwner').mockResolvedValue(true);

            await expect(OrganizationMember.removeMember('user-1', 'org-1')).rejects.toMatchObject({
                code: 'LAST_ACTIVE_OWNER_GUARD',
            });
        });

        it('returns false when the member does not exist', async () => {
            vi.spyOn(OrganizationMember, 'getMember').mockResolvedValue(undefined);

            const result = await OrganizationMember.removeMember('ghost', 'org-1');
            expect(result).toBe(false);
        });

        it('clears all default RBAC assignments and deletes the row', async () => {
            vi.spyOn(OrganizationMember, 'getMember').mockResolvedValue({
                userId: 'user-1',
                organizationId: 'org-1',
                role: 'member',
                status: 'active',
            } as any);
            vi.spyOn(OrganizationMember, 'isLastActiveOwner').mockResolvedValue(false);
            const { driver, delete: del } = makeInsertDriver(null);
            vi.spyOn(OrganizationMember as any, 'getDriver').mockReturnValue(driver as any);
            const cache = { invalidateUser: vi.fn().mockResolvedValue(undefined) };

            const result = await OrganizationMember.removeMember('user-1', 'org-1', { cache: cache as any });

            expect(result).toBe(true);
            expect(UserRole.removeRole).toHaveBeenCalledTimes(4);
            expect(del).toHaveBeenCalled();
            expect(cache.invalidateUser).toHaveBeenCalledWith('user-1', 'org-1');
        });
    });
});
