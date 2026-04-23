import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Organization } from '../Organization';
import { OrganizationMember } from '../OrganizationMember';
import { Role } from '../Role';
import { UserRole } from '../UserRole';

function fakeRole(id: string, name: string): any {
    return { get: (key: string) => (key === 'id' ? id : key === 'name' ? name : null) };
}

describe('Organization.createWithOwner (non-D1 fallback path)', () => {
    const defaults = {
        owner: fakeRole('role-owner', 'owner'),
        admin: fakeRole('role-admin', 'admin'),
        member: fakeRole('role-member', 'member'),
        viewer: fakeRole('role-viewer', 'viewer'),
    };

    beforeEach(() => {
        vi.spyOn(Role, 'ensureDefaults').mockResolvedValue(defaults as any);
        vi.spyOn(Organization, 'isSlugTaken').mockResolvedValue(false);
        vi.spyOn(Organization, 'isNameTaken').mockResolvedValue(false);
        // Force non-D1 branch: driver is a plain object with a stub db that
        // tolerates the rollback `db.delete(table).where(...)` chain.
        vi.spyOn(Organization as any, 'getDriver').mockReturnValue({
            getDb: () => ({
                delete: () => ({ where: async () => undefined }),
            }),
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('creates org + membership + owner RBAC row atomically and returns the org', async () => {
        const createSpy = vi.spyOn(Organization as any, 'create').mockImplementation(async (data: any) => ({
            get: (key: string) => data[key],
        }));
        const memberSpy = vi.spyOn(OrganizationMember, 'create').mockResolvedValue({} as any);
        const userRoleSpy = vi.spyOn(UserRole, 'create').mockResolvedValue({} as any);
        const findSpy = vi.spyOn(Organization, 'find').mockImplementation(
            async (id: string) =>
                ({
                    get: (key: string) => (key === 'id' ? id : 'Acme'),
                }) as any,
        );

        const cache = { invalidateUser: vi.fn().mockResolvedValue(undefined) };

        const org = await Organization.createWithOwner({
            name: 'Acme',
            ownerId: 'user-1',
            slug: 'acme',
            cache: cache as any,
        });

        expect(createSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Acme',
                slug: 'acme',
                ownerId: 'user-1',
                plan: 'free',
                status: 'active',
            }),
        );
        expect(memberSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'user-1',
                organizationId: expect.stringMatching(/^org-/),
                role: 'owner',
                status: 'active',
            }),
        );
        // The critical assertion: user_roles row exists with owner role id
        expect(userRoleSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'user-1',
                roleId: 'role-owner',
                organizationId: expect.stringMatching(/^org-/),
            }),
        );
        expect(findSpy).toHaveBeenCalled();
        expect(cache.invalidateUser).toHaveBeenCalledWith('user-1', expect.stringMatching(/^org-/));
        expect(org).toBeTruthy();
    });

    it('rolls back org row when user_roles insert fails', async () => {
        vi.spyOn(Organization as any, 'create').mockResolvedValue({ get: () => 'org-abc' });
        vi.spyOn(OrganizationMember, 'create').mockResolvedValue({} as any);
        vi.spyOn(UserRole, 'create').mockRejectedValue(new Error('user_roles insert boom'));
        const deleteSpy = vi.spyOn(Organization as any, 'delete').mockResolvedValue(true);

        await expect(
            Organization.createWithOwner({
                name: 'Acme',
                ownerId: 'user-1',
                slug: 'acme',
            }),
        ).rejects.toThrow(/user_roles insert boom/);

        expect(deleteSpy).toHaveBeenCalled();
    });

    it('rejects names shorter than 2 chars', async () => {
        await expect(Organization.createWithOwner({ name: 'A', ownerId: 'user-1' })).rejects.toThrow(
            /2-100 characters/,
        );
    });

    it('rejects duplicate slug before any inserts', async () => {
        vi.mocked(Organization.isSlugTaken).mockResolvedValue(true);
        const createSpy = vi.spyOn(Organization as any, 'create');
        await expect(Organization.createWithOwner({ name: 'Acme', ownerId: 'user-1', slug: 'acme' })).rejects.toThrow(
            /slug already exists/,
        );
        expect(createSpy).not.toHaveBeenCalled();
    });

    it('rejects unknown membership roles', async () => {
        await expect(
            Organization.createWithOwner({
                name: 'Acme',
                ownerId: 'user-1',
                slug: 'acme',
                membershipRole: 'superuser' as any,
            }),
        ).rejects.toThrow(/Unknown membership role/);
    });
});
