import { describe, expect, it, beforeEach, afterEach } from 'vitest';
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
        });
    });

    describe('organizations policy filter', () => {
        const orgConfig = MODEL_POLICIES.find((p) => p.model === 'organizations')!;
        const filter = orgConfig.policy.filter!;

        it('returns null when no userId present (denies access)', () => {
            const ctx: SecurityContext = {};
            expect(filter(ctx)).toBeNull();
        });

        it('returns ownerId filter when no memberOrganizationIds', () => {
            const ctx: SecurityContext = { userId: 'u1' };
            expect(filter(ctx)).toEqual({ ownerId: 'u1' });
        });

        it('returns ownerId filter when memberOrganizationIds is empty', () => {
            const ctx: SecurityContext = { userId: 'u1', memberOrganizationIds: [] };
            expect(filter(ctx)).toEqual({ ownerId: 'u1' });
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
