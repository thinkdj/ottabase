import { describe, expect, test } from 'vitest';
import { MODEL_POLICIES } from '../registry';

/**
 * Per-org custom roles: the `roles` RLS policy scopes generic-CRUD reads by the caller's org and
 * blocks writes (role writes go through the org-aware /api/rbac/roles admin routes). `permissions`
 * is a global read-only catalog. These guard the multi-tenant isolation of role definitions.
 */
describe('RLS policy — roles & permissions (per-org RBAC)', () => {
    const rolesPolicy = MODEL_POLICIES.find((p) => p.model === 'roles');
    const permissionsPolicy = MODEL_POLICIES.find((p) => p.model === 'permissions');

    test('roles policy is a read-only custom policy', () => {
        expect(rolesPolicy).toBeDefined();
        expect(rolesPolicy!.policy.level).toBe('custom');
        expect(rolesPolicy!.policy.readOnly).toBe(true);
        expect(typeof rolesPolicy!.policy.filter).toBe('function');
    });

    test('roles read filter scopes to the caller org; the system sentinel maps to the global (null) scope', () => {
        const filter = rolesPolicy!.policy.filter!;
        // An org member sees their own org's custom roles.
        expect(filter({ userId: 'u1', organizationId: 'org-a' })).toEqual({ organizationId: 'org-a' });
        // A different tenant is scoped to *their* org — never org-a's roles.
        expect(filter({ userId: 'u2', organizationId: 'org-b' })).toEqual({ organizationId: 'org-b' });
        // System-scope ('system' sentinel) and no-org both resolve to the global/system roles (NULL).
        expect(filter({ userId: 'u1', organizationId: 'system' })).toEqual({ organizationId: null });
        expect(filter({ userId: 'u1' })).toEqual({ organizationId: null });
    });

    test('roles read filter fails closed for an unauthenticated context', () => {
        expect(rolesPolicy!.policy.filter!({})).toBeNull();
    });

    test('permissions is a public, read-only catalog (no tenant column to mis-reference)', () => {
        expect(permissionsPolicy).toBeDefined();
        expect(permissionsPolicy!.policy.level).toBe('public');
        expect(permissionsPolicy!.policy.readOnly).toBe(true);
    });
});
