import { describe, expect, it, afterEach } from 'vitest';
import { MODEL_POLICIES, registerAllPolicies, getRegisteredModels } from '../registry';
import { globalRLS } from '../engine';
import type { SecurityContext } from '../types';

describe('RLS Registry', () => {
    afterEach(() => {
        globalRLS.clear();
    });

    describe('MODEL_POLICIES', () => {
        it('includes organizations model with custom policy', () => {
            const orgPolicy = MODEL_POLICIES.find((p) => p.model === 'organizations');
            expect(orgPolicy).toBeDefined();
            expect(orgPolicy!.policy.level).toBe('custom');
            expect(orgPolicy!.policy.filter).toBeDefined();
        });

        it('includes all expected models', () => {
            const modelNames = MODEL_POLICIES.map((p) => p.model);
            expect(modelNames).toContain('organizations');
            expect(modelNames).toContain('organization_members');
            expect(modelNames).toContain('roles');
            expect(modelNames).toContain('users');
            expect(modelNames).toContain('posts');
            expect(modelNames).toContain('audit_logs');
            expect(modelNames).toContain('user_groups');
            expect(modelNames).toContain('user_group_members');
        });
    });

    describe('organizations policy filter', () => {
        const orgConfig = MODEL_POLICIES.find((p) => p.model === 'organizations')!;
        const filter = orgConfig.policy.filter!;

        it('returns null when no userId present (denies access)', () => {
            const ctx: SecurityContext = {};
            expect(filter(ctx)).toBeNull();
        });

        it('falls back to ownerId ONLY when membership is UNRESOLVED (undefined)', () => {
            const ctx: SecurityContext = { userId: 'u1' }; // memberOrganizationIds undefined
            expect(filter(ctx)).toEqual({ ownerId: 'u1' });
        });

        it('DENIES (null) when membership is resolved to empty — no stale-ownerId fallback', () => {
            // A removed ex-owner resolves to zero active memberships; the never-cleared
            // Organization.ownerId must NOT grant them access to the org they created.
            const ctx: SecurityContext = { userId: 'u1', memberOrganizationIds: [] };
            expect(filter(ctx)).toBeNull();
        });

        it('returns an UNSCOPED filter for a platform admin (control plane administers every tenant)', () => {
            // Platform admins must be able to read/mutate an org they are not a member of —
            // otherwise a route that authorizes them still 404s on the read-before-write.
            const ctx: SecurityContext = { userId: 'u1', platformAdmin: true, memberOrganizationIds: [] };
            expect(filter(ctx)).toEqual({});
        });

        it('does NOT unscope for a non-platform-admin, even with an org-scoped *:* permission', () => {
            // Authority here is the scope-aware platformAdmin flag, never a permission string.
            const ctx: SecurityContext = {
                userId: 'u1',
                platformAdmin: false,
                permissions: ['*:*'],
                memberOrganizationIds: ['org-1'],
            };
            expect(filter(ctx)).toEqual({ id: ['org-1'] });
        });

        it('returns id array filter when memberOrganizationIds is populated', () => {
            const ctx: SecurityContext = {
                userId: 'u1',
                memberOrganizationIds: ['org-1', 'org-2'],
            };
            expect(filter(ctx)).toEqual({ id: ['org-1', 'org-2'] });
        });

        it('returns id array filter with single org', () => {
            const ctx: SecurityContext = {
                userId: 'u1',
                memberOrganizationIds: ['org-only'],
            };
            expect(filter(ctx)).toEqual({ id: ['org-only'] });
        });
    });

    describe('user_groups policy filter (membership-scoped)', () => {
        const config = MODEL_POLICIES.find((p) => p.model === 'user_groups')!;
        const filter = config.policy.filter!;

        it('denies (null) when there is no user', () => {
            expect(filter({})).toBeNull();
        });

        it('scopes to the groups the user belongs to', () => {
            const ctx: SecurityContext = { userId: 'u1', memberGroupIds: ['g1', 'g2'] };
            expect(filter(ctx)).toEqual({ id: ['g1', 'g2'] });
        });

        it('falls back to created groups when memberGroupIds is absent', () => {
            expect(filter({ userId: 'u1' })).toEqual({ createdBy: 'u1' });
        });

        it('falls back to created groups when memberGroupIds is empty', () => {
            expect(filter({ userId: 'u1', memberGroupIds: [] })).toEqual({ createdBy: 'u1' });
        });

        it('pins the creator and stays org-isolated on writes', () => {
            expect(config.enforceOnWrite).toEqual({ createdBy: 'userId' });
            expect(config.contextFields).toEqual(['organizationId']);
        });
    });

    describe('user_group_members policy filter (membership-scoped)', () => {
        const config = MODEL_POLICIES.find((p) => p.model === 'user_group_members')!;
        const filter = config.policy.filter!;

        it('denies (null) when there is no user', () => {
            expect(filter({})).toBeNull();
        });

        it('scopes to members of the groups the user belongs to', () => {
            const ctx: SecurityContext = { userId: 'u1', memberGroupIds: ['g1'] };
            expect(filter(ctx)).toEqual({ groupId: ['g1'] });
        });

        it('falls back to the user own membership rows when memberGroupIds is absent', () => {
            expect(filter({ userId: 'u1' })).toEqual({ userId: 'u1' });
        });
    });

    describe('posts policy filter (editorial + platform blog)', () => {
        const postsConfig = MODEL_POLICIES.find((p) => p.model === 'posts')!;
        const filter = postsConfig.policy.filter!;

        it('denies without a user, and without a tenant for non-platform-admins', () => {
            expect(filter({})).toBeNull();
            expect(filter({ userId: 'u1' })).toBeNull();
            expect(filter({ userId: 'u1', organizationId: null })).toBeNull();
        });

        it('confines authors (no manage grant) to their own posts in their org', () => {
            const ctx: SecurityContext = {
                userId: 'u1',
                organizationId: 'org-1',
                appId: 'web',
                permissions: ['posts:create', 'posts:update', '*:read'],
            };
            expect(filter(ctx)).toEqual({ organizationId: 'org-1', appId: 'web', userId: 'u1' });
        });

        it('gives manage-grade grants (posts:manage / org:admin) org-wide scope', () => {
            for (const perm of ['posts:manage', 'posts:*', 'org:admin', '*:*']) {
                const ctx: SecurityContext = { userId: 'u1', organizationId: 'org-1', permissions: [perm] };
                expect(filter(ctx), perm).toEqual({ organizationId: 'org-1' });
            }
        });

        it('scopes a platform admin WITHOUT an active org to the PLATFORM blog (organizationId null)', () => {
            const ctx: SecurityContext = { userId: 'u1', organizationId: null, appId: 'web', platformAdmin: true };
            expect(filter(ctx)).toEqual({ organizationId: null, appId: 'web' });
        });

        it('keeps a platform admin WITH an active org scoped to that org', () => {
            const ctx: SecurityContext = { userId: 'u1', organizationId: 'org-2', platformAdmin: true };
            expect(filter(ctx)).toEqual({ organizationId: 'org-2' });
        });
    });

    describe('registerAllPolicies', () => {
        it('registers all policies into the global engine', () => {
            registerAllPolicies();
            const models = getRegisteredModels();
            expect(models.length).toBe(MODEL_POLICIES.length);
        });

        it('makes organization policy accessible via globalRLS', () => {
            registerAllPolicies();
            const config = globalRLS.getPolicy('organizations');
            expect(config).toBeDefined();
            expect(config!.policy.level).toBe('custom');
        });
    });
});
