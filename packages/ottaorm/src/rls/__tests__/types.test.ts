import { describe, expect, it } from 'vitest';
import { RLSPolicies } from '../types';
import type { SecurityContext } from '../types';

describe('RLSPolicies', () => {
    it('TenantScoped returns policy with level tenant and field organizationId', () => {
        const policy = RLSPolicies.TenantScoped(false);
        expect(policy.level).toBe('tenant');
        expect(policy.field).toBe('organizationId');
        expect(policy.allowNullTenant).toBe(false);
    });

    it('TenantScoped(true) allows null tenant', () => {
        const policy = RLSPolicies.TenantScoped(true);
        expect(policy.allowNullTenant).toBe(true);
    });

    it('UserScoped returns policy with level user and field userId', () => {
        const policy = RLSPolicies.UserScoped();
        expect(policy.level).toBe('user');
        expect(policy.field).toBe('userId');
    });

    it('AppScoped returns policy with level app and field appId', () => {
        const policy = RLSPolicies.AppScoped();
        expect(policy.level).toBe('app');
        expect(policy.field).toBe('appId');
    });

    it('PublicReadOnly returns public readOnly policy', () => {
        const policy = RLSPolicies.PublicReadOnly();
        expect(policy.level).toBe('public');
        expect(policy.readOnly).toBe(true);
    });

    it('AdminOnly returns custom policy with requiredRoles', () => {
        const policy = RLSPolicies.AdminOnly();
        expect(policy.level).toBe('custom');
        expect(policy.requiredRoles).toEqual(['admin', 'owner']);
    });

    it('PermissionBased returns custom policy with requiredPermissions', () => {
        const policy = RLSPolicies.PermissionBased(['posts:write', 'posts:read']);
        expect(policy.level).toBe('custom');
        expect(policy.requiredPermissions).toEqual(['posts:write', 'posts:read']);
    });

    it('OwnerOnly returns custom policy with filter', () => {
        const policy = RLSPolicies.OwnerOnly('userId');
        expect(policy.level).toBe('custom');
        expect(policy.filter).toBeDefined();
        expect(policy.filter!({ userId: 'u1' })).toEqual({ userId: 'u1' });
    });

    it('OwnerOnly defaults to userId field', () => {
        const policy = RLSPolicies.OwnerOnly();
        expect(policy.filter!({ userId: 'u2' })).toEqual({ userId: 'u2' });
    });

    it('Hierarchical returns custom filter with organizationId and userId', () => {
        const policy = RLSPolicies.Hierarchical(false);
        expect(policy.level).toBe('custom');
        expect(policy.filter).toBeDefined();
        expect(policy.filter!({ userId: 'u1', organizationId: 'org-1' })).toEqual({
            organizationId: 'org-1',
            userId: 'u1',
        });
    });
});

describe('SecurityContext', () => {
    it('supports memberOrganizationIds field', () => {
        const ctx: SecurityContext = {
            userId: 'u1',
            organizationId: 'org-1',
            memberOrganizationIds: ['org-1', 'org-2', 'org-3'],
        };
        expect(ctx.memberOrganizationIds).toEqual(['org-1', 'org-2', 'org-3']);
    });

    it('memberOrganizationIds is optional', () => {
        const ctx: SecurityContext = { userId: 'u1' };
        expect(ctx.memberOrganizationIds).toBeUndefined();
    });
});
