import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provisionDefaultOrganizationForUser } from '../user-provisioning';

const mocks = vi.hoisted(() => ({
    organizationFindBySlug: vi.fn(),
    organizationCreate: vi.fn(),
    organizationDelete: vi.fn(),
    membershipWhere: vi.fn(),
    membershipCreate: vi.fn(),
    ensureDefaultRoles: vi.fn(),
    roleFindByName: vi.fn(),
    brandKitFirst: vi.fn(),
    brandKitCreate: vi.fn(),
    mappingWhere: vi.fn(),
    mappingCreate: vi.fn(),
}));

vi.mock('@ottabase/brand-engine', () => ({
    DEFAULT_ROUTE_MAPPINGS: [],
}));

vi.mock('@ottabase/brand-engine/persistence', () => ({
    BrandKit: {
        first: mocks.brandKitFirst,
        create: mocks.brandKitCreate,
    },
    LayoutRouteMapping: {
        where: mocks.mappingWhere,
        create: mocks.mappingCreate,
    },
}));

vi.mock('@ottabase/ottaorm/models', () => ({
    Organization: {
        findBySlug: mocks.organizationFindBySlug,
        create: mocks.organizationCreate,
        delete: mocks.organizationDelete,
    },
    OrganizationMember: {
        where: mocks.membershipWhere,
        create: mocks.membershipCreate,
    },
    Role: {
        ensureDefaultRoles: mocks.ensureDefaultRoles,
        findByName: mocks.roleFindByName,
    },
}));

function model(values: Record<string, unknown>) {
    return {
        get: (key: string) => values[key],
    };
}

function createUser() {
    return {
        get: vi.fn((key: string) => (key === 'id' ? 'user-1' : null)),
        assignRole: vi.fn().mockResolvedValue(undefined),
    };
}

describe('provisionDefaultOrganizationForUser', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.organizationFindBySlug.mockResolvedValue(undefined);
        mocks.organizationCreate.mockResolvedValue(model({ id: 'org-1' }));
        mocks.organizationDelete.mockResolvedValue(true);
        mocks.membershipWhere.mockResolvedValue([]);
        mocks.membershipCreate.mockResolvedValue(model({ id: 'membership-1' }));
        mocks.ensureDefaultRoles.mockResolvedValue([]);
        mocks.roleFindByName.mockResolvedValue(model({ id: 'owner-role', name: 'owner' }));
        mocks.brandKitFirst.mockResolvedValue(model({ id: 'brand-kit-1' }));
        mocks.mappingWhere.mockResolvedValue([model({ id: 'mapping-1' })]);
    });

    it('creates an active owner membership and matching organization-scoped owner grant', async () => {
        const user = createUser();

        await expect(
            provisionDefaultOrganizationForUser({
                user,
                email: 'founder@example.com',
                name: 'Founder',
                assignedBy: 'system',
                appId: 'otta-web',
            }),
        ).resolves.toMatchObject({
            organizationId: 'org-1',
            organizationRole: 'owner',
            assignedRole: 'owner',
        });

        expect(mocks.membershipCreate).toHaveBeenCalledWith({
            userId: 'user-1',
            organizationId: 'org-1',
            role: 'owner',
            status: 'active',
        });
        expect(mocks.membershipWhere).toHaveBeenCalledWith(
            { userId: 'user-1', status: 'active', role: 'owner' },
            { orderBy: 'createdAt', orderDirection: 'asc', limit: 1 },
        );
        expect(user.assignRole).toHaveBeenCalledWith('owner-role', 'system', 'org-1');
        expect(mocks.organizationDelete).not.toHaveBeenCalled();
    });

    it('deletes a newly-created organization and rejects when membership creation fails', async () => {
        const user = createUser();
        mocks.membershipCreate.mockRejectedValueOnce(new Error('membership insert failed'));

        await expect(
            provisionDefaultOrganizationForUser({
                user,
                organizationRole: 'owner',
                roleFallbacks: ['owner'],
            }),
        ).rejects.toThrow('membership insert failed');

        expect(mocks.organizationDelete).toHaveBeenCalledWith('org-1');
        expect(mocks.ensureDefaultRoles).not.toHaveBeenCalled();
        expect(user.assignRole).not.toHaveBeenCalled();
    });

    it('fails closed and compensates the tenant when no requested RBAC role can be resolved', async () => {
        const user = createUser();
        mocks.roleFindByName.mockResolvedValueOnce(null);

        await expect(
            provisionDefaultOrganizationForUser({
                user,
                organizationRole: 'owner',
                roleFallbacks: ['owner'],
            }),
        ).rejects.toThrow('None of the requested organization roles exist: owner');

        expect(mocks.organizationDelete).toHaveBeenCalledWith('org-1');
        expect(user.assignRole).not.toHaveBeenCalled();
    });

    it('fails closed and compensates the tenant when the scoped role grant cannot be written', async () => {
        const user = createUser();
        user.assignRole.mockRejectedValueOnce(new Error('role grant failed'));

        await expect(
            provisionDefaultOrganizationForUser({
                user,
                organizationRole: 'owner',
                roleFallbacks: ['owner'],
            }),
        ).rejects.toThrow('role grant failed');

        expect(mocks.organizationDelete).toHaveBeenCalledWith('org-1');
    });

    it('keeps optional brand seeding non-blocking after the required tenant security facts succeed', async () => {
        const user = createUser();
        mocks.brandKitFirst.mockRejectedValue(new Error('brand storage unavailable'));

        const result = await provisionDefaultOrganizationForUser({
            user,
            organizationRole: 'owner',
            roleFallbacks: ['owner'],
        });

        expect(result).toMatchObject({
            organizationId: 'org-1',
            assignedRole: 'owner',
        });
        expect(result).not.toHaveProperty('brandSetupError');

        expect(user.assignRole).toHaveBeenCalledWith('owner-role', undefined, 'org-1');
        expect(mocks.organizationDelete).not.toHaveBeenCalled();
    });
});
