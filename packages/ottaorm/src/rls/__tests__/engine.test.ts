import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RLSEngine, RLSError } from '../engine';
import type { SecurityContext } from '../types';
import { RLSPolicies } from '../types';

describe('RLS Engine', () => {
    let engine: RLSEngine;

    beforeEach(() => {
        engine = new RLSEngine();
    });

    afterEach(() => {
        engine.clear();
    });

    describe('register and getPolicy', () => {
        it('registers a model policy', () => {
            engine.register({
                model: 'posts',
                policy: RLSPolicies.TenantScoped(false),
            });
            const config = engine.getPolicy('posts');
            expect(config).toBeDefined();
            expect(config!.model).toBe('posts');
            expect(config!.policy.level).toBe('tenant');
            expect(config!.policy.field).toBe('organizationId');
        });

        it('returns undefined for unregistered model', () => {
            expect(engine.getPolicy('unknown')).toBeUndefined();
        });

        it('getRegisteredModels returns registered model names', () => {
            engine.register({ model: 'posts', policy: RLSPolicies.TenantScoped(false) });
            engine.register({ model: 'users', policy: RLSPolicies.UserScoped() });
            expect(engine.getRegisteredModels()).toEqual(['posts', 'users']);
        });

        it('clear removes all policies', () => {
            engine.register({ model: 'posts', policy: RLSPolicies.TenantScoped(false) });
            engine.clear();
            expect(engine.getPolicy('posts')).toBeUndefined();
            expect(engine.getRegisteredModels()).toHaveLength(0);
        });
    });

    describe('applyReadFilter', () => {
        it('tenant level: returns filter by organizationId', () => {
            engine.register({
                model: 'posts',
                policy: RLSPolicies.TenantScoped(false),
            });
            const ctx: SecurityContext = { userId: 'u1', organizationId: 'org-1' };
            const filter = engine.applyReadFilter('posts', ctx);
            expect(filter).toEqual({ organizationId: 'org-1' });
        });

        it('tenant level: merges with existing where', () => {
            engine.register({
                model: 'posts',
                policy: RLSPolicies.TenantScoped(false),
            });
            const ctx: SecurityContext = { organizationId: 'org-1' };
            const filter = engine.applyReadFilter('posts', ctx, { status: 'draft' });
            expect(filter).toEqual({ status: 'draft', organizationId: 'org-1' });
        });

        it('tenant level: throws when organizationId missing and allowNullTenant is false', () => {
            engine.register({
                model: 'posts',
                policy: RLSPolicies.TenantScoped(false),
            });
            const ctx: SecurityContext = { userId: 'u1' };
            expect(() => engine.applyReadFilter('posts', ctx)).toThrow(RLSError);
            expect(() => engine.applyReadFilter('posts', ctx)).toThrow(/organizationId/);
        });

        it('tenant level: allows null tenant when allowNullTenant is true', () => {
            engine.register({
                model: 'roles',
                policy: RLSPolicies.TenantScoped(true),
            });
            const ctx: SecurityContext = { userId: 'u1' };
            const filter = engine.applyReadFilter('roles', ctx);
            expect(filter).toEqual({ organizationId: undefined });
        });

        it('user level: returns filter by userId', () => {
            engine.register({
                model: 'todos',
                policy: RLSPolicies.UserScoped(),
            });
            const ctx: SecurityContext = { userId: 'user-123' };
            const filter = engine.applyReadFilter('todos', ctx);
            expect(filter).toEqual({ userId: 'user-123' });
        });

        it('user level: throws when userId missing', () => {
            engine.register({
                model: 'todos',
                policy: RLSPolicies.UserScoped(),
            });
            const ctx: SecurityContext = { organizationId: 'org-1' };
            expect(() => engine.applyReadFilter('todos', ctx)).toThrow(RLSError);
            expect(() => engine.applyReadFilter('todos', ctx)).toThrow(/userId/);
        });

        it('public level: returns empty filter', () => {
            engine.register({
                model: 'config',
                policy: RLSPolicies.PublicReadOnly(),
            });
            const ctx: SecurityContext = {};
            const filter = engine.applyReadFilter('config', ctx);
            expect(filter).toEqual({});
        });

        it('custom level: uses filter function', () => {
            engine.register({
                model: 'orgs',
                policy: {
                    level: 'custom',
                    filter: (context) => (context.userId ? { ownerId: context.userId } : null),
                },
            });
            const ctx: SecurityContext = { userId: 'u1' };
            const filter = engine.applyReadFilter('orgs', ctx);
            expect(filter).toEqual({ ownerId: 'u1' });
        });

        it('custom level: throws when filter returns null', () => {
            engine.register({
                model: 'orgs',
                policy: {
                    level: 'custom',
                    filter: () => null,
                },
            });
            const ctx: SecurityContext = { userId: 'u1' };
            expect(() => engine.applyReadFilter('orgs', ctx)).toThrow(RLSError);
        });

        it('custom level: filter can return array value for inArray matching', () => {
            engine.register({
                model: 'orgs',
                policy: {
                    level: 'custom',
                    filter: (context) => {
                        if (context.memberOrganizationIds && context.memberOrganizationIds.length > 0) {
                            return { id: context.memberOrganizationIds };
                        }
                        return context.userId ? { ownerId: context.userId } : null;
                    },
                },
            });

            // With memberOrganizationIds → returns array filter
            const ctx: SecurityContext = {
                userId: 'u1',
                memberOrganizationIds: ['org-1', 'org-2', 'org-3'],
            };
            const filter = engine.applyReadFilter('orgs', ctx);
            expect(filter).toEqual({ id: ['org-1', 'org-2', 'org-3'] });
        });

        it('custom level: falls back to ownerId when memberOrganizationIds is empty', () => {
            engine.register({
                model: 'orgs',
                policy: {
                    level: 'custom',
                    filter: (context) => {
                        if (context.memberOrganizationIds && context.memberOrganizationIds.length > 0) {
                            return { id: context.memberOrganizationIds };
                        }
                        return context.userId ? { ownerId: context.userId } : null;
                    },
                },
            });

            const ctx: SecurityContext = { userId: 'u1' };
            const filter = engine.applyReadFilter('orgs', ctx);
            expect(filter).toEqual({ ownerId: 'u1' });
        });

        it('throws when no policy defined for model', () => {
            const ctx: SecurityContext = { userId: 'u1', organizationId: 'org-1' };
            expect(() => engine.applyReadFilter('unknown_model', ctx)).toThrow(RLSError);
            expect(() => engine.applyReadFilter('unknown_model', ctx)).toThrow(/No RLS policy/);
        });

        it('requiredRoles: allows when user has role', () => {
            engine.register({
                model: 'admin_only',
                policy: RLSPolicies.AdminOnly(),
            });
            const ctx: SecurityContext = { userId: 'u1', roles: ['admin'] };
            const filter = engine.applyReadFilter('admin_only', ctx);
            expect(filter).toEqual({});
        });

        it('requiredRoles: throws when user lacks role', () => {
            engine.register({
                model: 'admin_only',
                policy: RLSPolicies.AdminOnly(),
            });
            const ctx: SecurityContext = { userId: 'u1', roles: ['member'] };
            expect(() => engine.applyReadFilter('admin_only', ctx)).toThrow(RLSError);
            expect(() => engine.applyReadFilter('admin_only', ctx)).toThrow(/requires one of roles/);
        });
    });

    describe('validateWrite', () => {
        it('tenant: injects organizationId on create when missing', () => {
            engine.register({
                model: 'posts',
                policy: RLSPolicies.TenantScoped(false),
            });
            const ctx: SecurityContext = { userId: 'u1', organizationId: 'org-1' };
            const data: Record<string, any> = { title: 'Hello' };
            engine.validateWrite('posts', ctx, data, 'create');
            expect(data.organizationId).toBe('org-1');
        });

        it('tenant: allows create when organizationId matches context', () => {
            engine.register({
                model: 'posts',
                policy: RLSPolicies.TenantScoped(false),
            });
            const ctx: SecurityContext = { organizationId: 'org-1' };
            const data = { organizationId: 'org-1', title: 'Hi' };
            expect(() => engine.validateWrite('posts', ctx, data, 'create')).not.toThrow();
        });

        it('tenant: throws on cross-tenant write', () => {
            engine.register({
                model: 'posts',
                policy: RLSPolicies.TenantScoped(false),
            });
            const ctx: SecurityContext = { organizationId: 'org-1' };
            const data = { organizationId: 'org-2', title: 'Hi' };
            expect(() => engine.validateWrite('posts', ctx, data, 'create')).toThrow(RLSError);
            expect(() => engine.validateWrite('posts', ctx, data, 'create')).toThrow(/Cross-tenant/);
        });

        it('readOnly policy: throws on write', () => {
            engine.register({
                model: 'audit_logs',
                policy: { ...RLSPolicies.TenantScoped(true), readOnly: true },
            });
            const ctx: SecurityContext = { organizationId: 'org-1' };
            expect(() => engine.validateWrite('audit_logs', ctx, {}, 'create')).toThrow(RLSError);
            expect(() => engine.validateWrite('audit_logs', ctx, {}, 'create')).toThrow(/read-only/);
        });

        it('throws when no policy defined', () => {
            const ctx: SecurityContext = { userId: 'u1' };
            expect(() => engine.validateWrite('unknown', ctx, {}, 'create')).toThrow(RLSError);
        });
    });

    describe('RLSError', () => {
        it('sets violation on error', () => {
            const err = new RLSError('Denied', {
                type: 'cross_tenant_write',
                model: 'posts',
                context: { organizationId: 'org-1' },
            });
            expect(err.name).toBe('RLSError');
            expect(err.violation).toBeDefined();
            expect(err.violation!.type).toBe('cross_tenant_write');
            expect(err.violation!.model).toBe('posts');
            expect(err.violation!.context.organizationId).toBe('org-1');
        });
    });
});
