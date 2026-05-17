/**
 * Tests for `RLSPolicy.requiredPermissionsForWrite` — the write-only permission gate that
 * allows broader read access than write access (e.g., any tenant member can read `user_groups`,
 * but only those with `groups:manage` can mutate).
 */

import { describe, expect, it } from 'vitest';
import { RLSEngine, RLSError } from '../engine';
import type { SecurityContext } from '../types';
import { RLSPolicies } from '../types';

function ctx(overrides: Partial<SecurityContext> = {}): SecurityContext {
    return {
        userId: 'u1',
        organizationId: 'org1',
        appId: 'web',
        roles: [],
        permissions: [],
        ...overrides,
    };
}

describe('requiredPermissionsForWrite', () => {
    it('allows reads without the write permission', () => {
        const engine = new RLSEngine();
        engine.register({
            model: 'user_groups',
            policy: {
                ...RLSPolicies.TenantScoped(false),
                requiredPermissionsForWrite: ['groups:manage'],
            },
        });

        // Read with no permissions — should succeed (returns tenant filter)
        const filter = engine.applyReadFilter('user_groups', ctx());
        expect(filter).toEqual({ organizationId: 'org1' });
    });

    it('blocks writes when permission missing', () => {
        const engine = new RLSEngine();
        engine.register({
            model: 'user_groups',
            policy: {
                ...RLSPolicies.TenantScoped(false),
                requiredPermissionsForWrite: ['groups:manage'],
            },
        });

        expect(() =>
            engine.validateWrite('user_groups', ctx({ permissions: [] }), { organizationId: 'org1' }, 'create'),
        ).toThrow(RLSError);
    });

    it('allows writes when explicit permission granted', () => {
        const engine = new RLSEngine();
        engine.register({
            model: 'user_groups',
            policy: {
                ...RLSPolicies.TenantScoped(false),
                requiredPermissionsForWrite: ['groups:manage'],
            },
        });

        expect(() =>
            engine.validateWrite(
                'user_groups',
                ctx({ permissions: ['groups:manage'] }),
                { organizationId: 'org1' },
                'create',
            ),
        ).not.toThrow();
    });

    it('allows writes when *:* wildcard granted (super-admin)', () => {
        const engine = new RLSEngine();
        engine.register({
            model: 'user_groups',
            policy: {
                ...RLSPolicies.TenantScoped(false),
                requiredPermissionsForWrite: ['groups:manage'],
            },
        });

        expect(() =>
            engine.validateWrite('user_groups', ctx({ permissions: ['*:*'] }), { organizationId: 'org1' }, 'create'),
        ).not.toThrow();
    });

    it('allows writes when resource wildcard granted (groups:*)', () => {
        const engine = new RLSEngine();
        engine.register({
            model: 'user_groups',
            policy: {
                ...RLSPolicies.TenantScoped(false),
                requiredPermissionsForWrite: ['groups:manage'],
            },
        });

        expect(() =>
            engine.validateWrite(
                'user_groups',
                ctx({ permissions: ['groups:*'] }),
                { organizationId: 'org1' },
                'create',
            ),
        ).not.toThrow();
    });

    it('still enforces cross-tenant write protection on top of permission gate', () => {
        const engine = new RLSEngine();
        engine.register({
            model: 'user_groups',
            policy: {
                ...RLSPolicies.TenantScoped(false),
                requiredPermissionsForWrite: ['groups:manage'],
            },
        });

        // Has permission but tries to write to different org
        expect(() =>
            engine.validateWrite(
                'user_groups',
                ctx({ permissions: ['groups:manage'], organizationId: 'org1' }),
                { organizationId: 'org2' },
                'create',
            ),
        ).toThrow(/Cross-tenant/);
    });

    it('blocks update/delete when permission missing (not just create)', () => {
        const engine = new RLSEngine();
        engine.register({
            model: 'user_groups',
            policy: {
                ...RLSPolicies.TenantScoped(false),
                requiredPermissionsForWrite: ['groups:manage'],
            },
        });

        expect(() =>
            engine.validateWrite('user_groups', ctx({ permissions: [] }), { organizationId: 'org1' }, 'update'),
        ).toThrow(RLSError);
        expect(() =>
            engine.validateWrite('user_groups', ctx({ permissions: [] }), { organizationId: 'org1' }, 'delete'),
        ).toThrow(RLSError);
    });

    it('does nothing when requiredPermissionsForWrite is absent (default behavior preserved)', () => {
        const engine = new RLSEngine();
        engine.register({
            model: 'posts',
            policy: RLSPolicies.TenantScoped(false),
        });
        expect(() =>
            engine.validateWrite('posts', ctx({ permissions: [] }), { organizationId: 'org1' }, 'create'),
        ).not.toThrow();
    });
});
