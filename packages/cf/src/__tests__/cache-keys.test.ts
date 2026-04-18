/**
 * Tests for Cache Key Builder
 */

import { describe, expect, it } from 'vitest';
import {
    appKey,
    appUserKey,
    CacheKeyBuilder,
    globalKey,
    orgAppKey,
    orgAppUserKey,
    orgKey,
    orgUserKey,
    parseKey,
    userKey,
    versionedOrgKey,
} from '../cache-keys';

describe('CacheKeyBuilder', () => {
    describe('basic construction', () => {
        it('should build simple namespaced key', () => {
            const key = CacheKeyBuilder.create('rbac').segment('roles').build();
            expect(key).toBe('rbac:roles');
        });

        it('should build key without namespace', () => {
            const key = CacheKeyBuilder.create().segment('test').build();
            expect(key).toBe('test');
        });

        it('should throw error for empty key', () => {
            expect(() => CacheKeyBuilder.create().build()).toThrow('Cache key must have at least one part');
        });
    });

    describe('organization scope', () => {
        it('should build org-scoped key', () => {
            const key = CacheKeyBuilder.create('brand').org('acme-corp').segment('brandkit').build();
            expect(key).toBe('brand:org:acme-corp:brandkit');
        });

        it('should require org ID', () => {
            expect(() => CacheKeyBuilder.create('brand').org('').build()).toThrow('Organization ID is required');
        });

        it('should sanitize org ID with colons', () => {
            const key = CacheKeyBuilder.create('brand').org('org:123:test').segment('brandkit').build();
            expect(key).toBe('brand:org:org-123-test:brandkit');
        });
    });

    describe('user scope', () => {
        it('should build user-scoped key', () => {
            const key = CacheKeyBuilder.create('session').user('user-123').segment('active').build();
            expect(key).toBe('session:usr:user-123:active');
        });

        it('should require user ID', () => {
            expect(() => CacheKeyBuilder.create('session').user('').build()).toThrow('User ID is required');
        });
    });

    describe('app scope', () => {
        it('should build app-scoped key', () => {
            const key = CacheKeyBuilder.create('config').app('web').segment('settings').build();
            expect(key).toBe('config:app:web:settings');
        });

        it('should require app ID', () => {
            expect(() => CacheKeyBuilder.create('config').app('').build()).toThrow('App ID is required');
        });
    });

    describe('version support', () => {
        it('should build versioned key with string version (v-prefixed)', () => {
            const key = CacheKeyBuilder.create('rbac').org('acme').version('v1').segment('cache').build();
            expect(key).toBe('rbac:org:acme:v1:cache');
        });

        it('should build versioned key with string version (no prefix)', () => {
            const key = CacheKeyBuilder.create('rbac').org('acme').version('1').segment('cache').build();
            expect(key).toBe('rbac:org:acme:v1:cache');
        });

        it('should build versioned key with number version', () => {
            const key = CacheKeyBuilder.create('rbac').org('acme').version(2).segment('cache').build();
            expect(key).toBe('rbac:org:acme:v2:cache');
        });
    });

    describe('composite scopes', () => {
        it('should build org+app composite key', () => {
            const key = CacheKeyBuilder.create('brand').org('acme').app('web').segment('layout').build();
            expect(key).toBe('brand:org:acme:app:web:layout');
        });

        it('should build org+user composite key', () => {
            const key = CacheKeyBuilder.create('rbac').org('acme').user('user-123').segment('roles').build();
            expect(key).toBe('rbac:org:acme:usr:user-123:roles');
        });

        it('should build app+user composite key', () => {
            const key = CacheKeyBuilder.create('config').app('web').user('user-123').segment('theme').build();
            expect(key).toBe('config:app:web:usr:user-123:theme');
        });

        it('should build org+app+user composite key', () => {
            const key = CacheKeyBuilder.create('rbac').org('acme').app('web').user('user-123').segment('perms').build();
            expect(key).toBe('rbac:org:acme:app:web:usr:user-123:perms');
        });

        it('should build complex composite key with version', () => {
            const key = CacheKeyBuilder.create('rbac')
                .org('acme')
                .version(1)
                .app('web')
                .user('user-123')
                .segment('perms')
                .build();
            expect(key).toBe('rbac:org:acme:v1:app:web:usr:user-123:perms');
        });
    });

    describe('multiple segments', () => {
        it('should add multiple segments with variadic segment()', () => {
            const key = CacheKeyBuilder.create('cache').org('acme').segment('feature', 'enabled', 'flag').build();
            expect(key).toBe('cache:org:acme:feature:enabled:flag');
        });

        it('should throw error for empty segment', () => {
            expect(() => CacheKeyBuilder.create('cache').segment('').build()).toThrow('Segment cannot be empty');
        });
    });

    describe('sanitization', () => {
        it('should replace colons with dashes', () => {
            const key = CacheKeyBuilder.create('cache').segment('value:with:colons').build();
            expect(key).toBe('cache:value-with-colons');
        });

        it('should collapse internal whitespace', () => {
            const key = CacheKeyBuilder.create('cache').segment('value  with   spaces').build();
            expect(key).toBe('cache:value-with-spaces');
        });

        it('should trim whitespace', () => {
            const key = CacheKeyBuilder.create('cache').segment('  value  ').build();
            expect(key).toBe('cache:value');
        });

        it('should handle mixed colons and whitespace', () => {
            const key = CacheKeyBuilder.create('cache').segment('a: b :c').build();
            expect(key).toBe('cache:a-b-c');
        });
    });

    describe('extensible namespaces', () => {
        it('should accept custom namespace strings', () => {
            const key = CacheKeyBuilder.create('auth').segment('revoked').build();
            expect(key).toBe('auth:revoked');
        });

        it('should accept arbitrary namespace strings', () => {
            const key = CacheKeyBuilder.create('my-custom-ns').org('acme').segment('data').build();
            expect(key).toBe('my-custom-ns:org:acme:data');
        });
    });

    describe('key length limit', () => {
        it('should allow keys up to 512 bytes', () => {
            // 512 bytes is exactly the limit — should not throw
            const longSegment = 'a'.repeat(500);
            expect(() => CacheKeyBuilder.create('ns').segment(longSegment).build()).not.toThrow();
        });

        it('should throw when key exceeds 512 bytes', () => {
            const longSegment = 'a'.repeat(520);
            expect(() => CacheKeyBuilder.create('ns').segment(longSegment).build()).toThrow('512-byte KV limit');
        });

        it('should measure bytes not chars for multibyte characters', () => {
            // Each emoji is 4 bytes in UTF-8; 128 emojis = 512 bytes + namespace
            const emojis = '🔑'.repeat(128);
            expect(() => CacheKeyBuilder.create('ns').segment(emojis).build()).toThrow('512-byte KV limit');
        });
    });
});

describe('Helper Functions', () => {
    // -- Single scope --

    describe('globalKey', () => {
        it('should create global key', () => {
            expect(globalKey('system', 'maintenance')).toBe('system:maintenance');
        });

        it('should handle multiple segments', () => {
            expect(globalKey('system', 'config', 'feature', 'flags')).toBe('system:config:feature:flags');
        });
    });

    describe('orgKey', () => {
        it('should create org-scoped key', () => {
            expect(orgKey('brand', 'acme-corp', 'brandkit')).toBe('brand:org:acme-corp:brandkit');
        });

        it('should handle multiple segments', () => {
            expect(orgKey('brand', 'acme', 'kit', 'colors', 'primary')).toBe('brand:org:acme:kit:colors:primary');
        });

        it('should handle no additional segments', () => {
            expect(orgKey('brand', 'acme')).toBe('brand:org:acme');
        });
    });

    describe('userKey', () => {
        it('should create user-scoped key', () => {
            expect(userKey('session', 'user-123', 'active')).toBe('session:usr:user-123:active');
        });

        it('should handle multiple segments', () => {
            expect(userKey('cache', 'user-456', 'preferences', 'theme', 'dark')).toBe(
                'cache:usr:user-456:preferences:theme:dark',
            );
        });
    });

    describe('appKey', () => {
        it('should create app-scoped key', () => {
            expect(appKey('config', 'web', 'settings')).toBe('config:app:web:settings');
        });
    });

    // -- Double scope --

    describe('orgAppKey', () => {
        it('should create org+app composite key', () => {
            expect(orgAppKey('brand', 'acme', 'web', 'layout')).toBe('brand:org:acme:app:web:layout');
        });

        it('should handle additional segments', () => {
            expect(orgAppKey('brand', 'acme', 'web', 'layout', 'header', 'logo')).toBe(
                'brand:org:acme:app:web:layout:header:logo',
            );
        });
    });

    describe('orgUserKey', () => {
        it('should create org+user composite key', () => {
            expect(orgUserKey('rbac', 'acme', 'user-123', 'roles')).toBe('rbac:org:acme:usr:user-123:roles');
        });
    });

    describe('appUserKey', () => {
        it('should create app+user composite key', () => {
            expect(appUserKey('config', 'web', 'user-123', 'theme')).toBe('config:app:web:usr:user-123:theme');
        });

        it('should handle multiple segments', () => {
            expect(appUserKey('cache', 'mobile', 'user-456', 'prefs', 'notifications')).toBe(
                'cache:app:mobile:usr:user-456:prefs:notifications',
            );
        });
    });

    // -- Triple scope --

    describe('orgAppUserKey', () => {
        it('should create org+app+user composite key', () => {
            expect(orgAppUserKey('rbac', 'acme', 'web', 'user-123', 'perms')).toBe(
                'rbac:org:acme:app:web:usr:user-123:perms',
            );
        });

        it('should handle multiple segments', () => {
            expect(orgAppUserKey('rbac', 'acme', 'web', 'user-123', 'context', 'full')).toBe(
                'rbac:org:acme:app:web:usr:user-123:context:full',
            );
        });
    });

    // -- Versioned --

    describe('versionedOrgKey', () => {
        it('should create versioned org key with string version (v-prefixed)', () => {
            expect(versionedOrgKey('rbac', 'acme', 'v1', 'cache')).toBe('rbac:org:acme:v1:cache');
        });

        it('should create versioned org key with string version (no prefix)', () => {
            expect(versionedOrgKey('rbac', 'acme', '1', 'cache')).toBe('rbac:org:acme:v1:cache');
        });

        it('should create versioned org key with number version', () => {
            expect(versionedOrgKey('rbac', 'acme', 2, 'cache')).toBe('rbac:org:acme:v2:cache');
        });

        it('should handle additional segments', () => {
            expect(versionedOrgKey('rbac', 'acme', 1, 'user', 'user-123', 'perms')).toBe(
                'rbac:org:acme:v1:user:user-123:perms',
            );
        });
    });
});

describe('parseKey', () => {
    it('should parse simple namespaced key', () => {
        expect(parseKey('rbac:roles')).toEqual({
            namespace: 'rbac',
            segments: ['roles'],
        });
    });

    it('should parse org-scoped key', () => {
        expect(parseKey('brand:org:acme-corp:brandkit')).toEqual({
            namespace: 'brand',
            scope: 'org',
            orgId: 'acme-corp',
            segments: ['brandkit'],
        });
    });

    it('should parse user-scoped key', () => {
        expect(parseKey('session:usr:user-123:active')).toEqual({
            namespace: 'session',
            scope: 'user',
            userId: 'user-123',
            segments: ['active'],
        });
    });

    it('should parse app-scoped key', () => {
        expect(parseKey('config:app:web:settings')).toEqual({
            namespace: 'config',
            scope: 'app',
            appId: 'web',
            segments: ['settings'],
        });
    });

    it('should parse org+app composite key', () => {
        expect(parseKey('brand:org:acme:app:web:layout')).toEqual({
            namespace: 'brand',
            scope: 'app', // last scope wins
            orgId: 'acme',
            appId: 'web',
            segments: ['layout'],
        });
    });

    it('should parse versioned key', () => {
        expect(parseKey('rbac:org:acme:v2:cache')).toEqual({
            namespace: 'rbac',
            scope: 'org',
            orgId: 'acme',
            version: '2',
            segments: ['cache'],
        });
    });

    it('should parse complex composite key', () => {
        expect(parseKey('rbac:org:acme:v1:app:web:usr:user-123:perms')).toEqual({
            namespace: 'rbac',
            scope: 'user', // last scope
            orgId: 'acme',
            appId: 'web',
            userId: 'user-123',
            version: '1',
            segments: ['perms'],
        });
    });

    it('should handle key without namespace', () => {
        expect(parseKey('org:acme:test')).toEqual({
            scope: 'org',
            orgId: 'acme',
            segments: ['test'],
        });
    });

    it('should correctly parse namespace starting with v (not version)', () => {
        // 'vault' starts with 'v' but is NOT a version tag — must be recognized as namespace
        expect(parseKey('vault:org:acme:secret')).toEqual({
            namespace: 'vault',
            scope: 'org',
            orgId: 'acme',
            segments: ['secret'],
        });
    });

    it('should correctly parse namespace starting with u (not user scope)', () => {
        // 'upload' starts with 'u' but is NOT user scope — must be recognized as namespace
        expect(parseKey('upload:org:acme:file')).toEqual({
            namespace: 'upload',
            scope: 'org',
            orgId: 'acme',
            segments: ['file'],
        });
    });
});

describe('Real-world usage examples', () => {
    it('should create RBAC cache keys', () => {
        const key = CacheKeyBuilder.create('rbac')
            .org('acme-corp')
            .version(1)
            .app('web')
            .user('user-123')
            .segment('context')
            .build();
        expect(key).toBe('rbac:org:acme-corp:v1:app:web:usr:user-123:context');
    });

    it('should create brand cache keys', () => {
        const key = orgAppKey('brand', 'acme', 'web', 'resolved', 'light');
        expect(key).toBe('brand:org:acme:app:web:resolved:light');
    });

    it('should create rate limit keys', () => {
        // Colons in segments are sanitized to prevent key corruption
        const key = userKey('ratelimit', 'user-123', 'api:posts:create');
        expect(key).toBe('ratelimit:usr:user-123:api-posts-create');
    });

    it('should create queue deduplication keys', () => {
        // Colons in segments are sanitized
        const key = orgKey('dedupe', 'acme', 'email:send', 'msg-456');
        expect(key).toBe('dedupe:org:acme:email-send:msg-456');
    });

    it('should create version keys for cache invalidation', () => {
        const key = orgKey('rbac', 'acme', 'version');
        expect(key).toBe('rbac:org:acme:version');
    });

    it('should create orgAppUser key for user perms in org app context', () => {
        const key = orgAppUserKey('rbac', 'acme', 'web', 'user-123', 'perms');
        expect(key).toBe('rbac:org:acme:app:web:usr:user-123:perms');
    });

    it('should create appUser key for user theme in mobile app', () => {
        const key = appUserKey('config', 'mobile', 'user-123', 'theme');
        expect(key).toBe('config:app:mobile:usr:user-123:theme');
    });

    it('should work with custom namespaces like auth', () => {
        const key = userKey('auth', 'user-123', 'revoked');
        expect(key).toBe('auth:usr:user-123:revoked');
    });
});
