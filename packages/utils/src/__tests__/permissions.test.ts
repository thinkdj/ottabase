import { describe, expect, it } from 'vitest';
import { hasGrantedPermission, permissionMatches } from '../permissions';

describe('permissionMatches', () => {
    it.each([
        ['users:read', 'users:read'],
        ['users:*', 'users:read'],
        ['*:read', 'users:read'],
        ['*:*', 'users:delete'],
    ])('matches granted %s against required %s', (granted, required) => {
        expect(permissionMatches(granted, required)).toBe(true);
    });

    it.each([
        ['users:read', 'users:write'],
        ['users:read', 'posts:read'],
        ['*', 'users:read'],
        ['users:', 'users:read'],
        [':read', 'users:read'],
        ['users:*:admin', 'users:read'],
        ['users:*', 'users:read:private'],
    ])('rejects granted %s against required %s', (granted, required) => {
        expect(permissionMatches(granted, required)).toBe(false);
    });

    it('does not interpret wildcards in the required permission', () => {
        expect(permissionMatches('users:read', 'users:*')).toBe(false);
    });

    it('keeps exact multi-segment permission names usable without wildcard expansion', () => {
        expect(permissionMatches('brand:edit:admin', 'brand:edit:admin')).toBe(true);
    });
});

describe('hasGrantedPermission', () => {
    it('matches any permission from an iterable', () => {
        expect(hasGrantedPermission(new Set(['posts:read', 'users:*']), 'users:delete')).toBe(true);
    });

    it('fails closed for missing permission collections', () => {
        expect(hasGrantedPermission(undefined, 'users:read')).toBe(false);
    });
});
