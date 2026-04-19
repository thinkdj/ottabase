import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Organization } from '../Organization';
import { OrganizationMember } from '../OrganizationMember';

describe('Organization.ensurePersonalOrg', () => {
    beforeEach(() => {
        vi.useRealTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('is idempotent: returns the existing active org when one is already owned', async () => {
        vi.spyOn(OrganizationMember, 'getUserOrganizations').mockResolvedValue([
            {
                userId: 'user-1',
                organizationId: 'org-existing',
                role: 'owner',
                status: 'active',
                joinedAt: 1,
            } as any,
        ]);
        const findSpy = vi.spyOn(Organization, 'find').mockResolvedValue({
            get: (k: string) => (k === 'id' ? 'org-existing' : null),
        } as any);
        const createWithOwner = vi.spyOn(Organization, 'createWithOwner');

        const org = await Organization.ensurePersonalOrg({ id: 'user-1', name: 'Ada', email: 'ada@e.co' });

        expect(createWithOwner).not.toHaveBeenCalled();
        expect(findSpy).toHaveBeenCalledWith('org-existing');
        expect(org.get('id')).toBe('org-existing');
    });

    it('picks the earliest-joined active org when multiple exist', async () => {
        vi.spyOn(OrganizationMember, 'getUserOrganizations').mockResolvedValue([
            { userId: 'user-1', organizationId: 'org-late', role: 'owner', status: 'active', joinedAt: 5 },
            { userId: 'user-1', organizationId: 'org-early', role: 'owner', status: 'active', joinedAt: 2 },
        ] as any);
        const findSpy = vi.spyOn(Organization, 'find').mockResolvedValue({
            get: (k: string) => (k === 'id' ? 'org-early' : null),
        } as any);

        const org = await Organization.ensurePersonalOrg({ id: 'user-1', name: 'Ada' });
        expect(findSpy).toHaveBeenCalledWith('org-early');
        expect(org.get('id')).toBe('org-early');
    });

    it('creates a new org when the user has no active memberships', async () => {
        vi.spyOn(OrganizationMember, 'getUserOrganizations').mockResolvedValue([]);
        const createdOrg = { get: (k: string) => (k === 'id' ? 'org-new' : null) } as any;
        const createWithOwner = vi.spyOn(Organization, 'createWithOwner').mockResolvedValue(createdOrg);

        const org = await Organization.ensurePersonalOrg({ id: 'user-1', name: 'Ada Lovelace' });

        expect(createWithOwner).toHaveBeenCalledWith(
            expect.objectContaining({
                name: "Ada Lovelace's Workspace",
                ownerId: 'user-1',
                enforceUniqueName: false,
                slug: expect.any(String),
            }),
        );
        expect(org).toBe(createdOrg);
    });

    it('retries up to 6 times on slug collisions and propagates the final error', async () => {
        vi.spyOn(OrganizationMember, 'getUserOrganizations').mockResolvedValue([]);
        const createWithOwner = vi
            .spyOn(Organization, 'createWithOwner')
            .mockRejectedValue(new Error('Organization slug already exists'));

        await expect(Organization.ensurePersonalOrg({ id: 'user-1', name: 'Ada' })).rejects.toThrow(
            /slug already exists/,
        );

        // 1 base + 4 numeric (2,3,4,5) + 1 uuid-tail = 6 attempts
        expect(createWithOwner).toHaveBeenCalledTimes(6);
    });

    it('stops retrying on non-slug errors', async () => {
        vi.spyOn(OrganizationMember, 'getUserOrganizations').mockResolvedValue([]);
        const createWithOwner = vi.spyOn(Organization, 'createWithOwner').mockRejectedValue(new Error('db offline'));

        await expect(Organization.ensurePersonalOrg({ id: 'user-1', name: 'Ada' })).rejects.toThrow(/db offline/);

        expect(createWithOwner).toHaveBeenCalledTimes(1);
    });

    it('falls back to an email-derived base name when no name is set', async () => {
        vi.spyOn(OrganizationMember, 'getUserOrganizations').mockResolvedValue([]);
        const createWithOwner = vi.spyOn(Organization, 'createWithOwner').mockResolvedValue({
            get: () => 'org-new',
        } as any);

        await Organization.ensurePersonalOrg({ id: 'user-1', email: 'carla@example.com' });

        expect(createWithOwner).toHaveBeenCalledWith(expect.objectContaining({ name: "carla's Workspace" }));
    });
});
