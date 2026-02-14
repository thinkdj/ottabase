/**
 * Tests for Cache Key Builder
 */

import { describe, expect, it } from 'vitest';
import {
    CacheKeyBuilder,
    orgKey,
    userKey,
    appKey,
    orgAppKey,
    orgUserKey,
    versionedOrgKey,
    globalKey,
    parseKey,
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
            expect(() => {
                CacheKeyBuilder.create().build();
            }).toThrow('Cache key must have at least one part');
        });
    });

    describe('organization scope', () => {
        it('should build org-scoped key', () => {
            const key = CacheKeyBuilder.create('brand').org('acme-corp').segment('brandkit').build();
            expect(key).toBe('brand:org:acme-corp:brandkit');
        });

        it('should require org ID', () => {
            expect(() => {
                CacheKeyBuilder.create('brand').org('').build();
            }).toThrow('Organization ID is required');
        });

        it('should sanitize org ID with colons', () => {
            const key = CacheKeyBuilder.create('brand').org('org:123:test').segment('brandkit').build();
            expect(key).toBe('brand:org:org-123-test:brandkit');
        });
    });

    describe('user scope', () => {
        it('should build user-scoped key', () => {
            const key = CacheKeyBuilder.create('session').user('user-123').segment('active').build();
            expect(key).toBe('session:u:user-123:active');
        });

        it('should require user ID', () => {
            expect(() => {
                CacheKeyBuilder.create('session').user('').build();
            }).toThrow('User ID is required');
        });
    });

    describe('app scope', () => {
        it('should build app-scoped key', () => {
            const key = CacheKeyBuilder.create('config').app('web').segment('settings').build();
            expect(key).toBe('config:app:web:settings');
        });

        it('should require app ID', () => {
            expect(() => {
                CacheKeyBuilder.create('config').app('').build();
            }).toThrow('App ID is required');
        });
    });

    describe('version support', () => {
        it('should build versioned key with string version', () => {
            const key = CacheKeyBuilder.create('rbac').org('acme').version('v1').segment('cache').build();
            expect(key).toBe('rbac:org:acme:vv1:cache');
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
            expect(key).toBe('rbac:org:acme:u:user-123:roles');
        });

        it('should build complex composite key', () => {
            const key = CacheKeyBuilder.create('rbac')
                .org('acme')
                .version(1)
                .app('web')
                .user('user-123')
                .segment('perms')
                .build();
            expect(key).toBe('rbac:org:acme:v1:app:web:u:user-123:perms');
        });
    });

    describe('multiple segments', () => {
        it('should add multiple segments with segments()', () => {
            const key = CacheKeyBuilder.create('cache').org('acme').segments('feature', 'enabled', 'flag').build();
            expect(key).toBe('cache:org:acme:feature:enabled:flag');
        });

        it('should throw error for empty segment', () => {
            expect(() => {
                CacheKeyBuilder.create('cache').segment('').build();
            }).toThrow('Segment cannot be empty');
        });
    });

    describe('sanitization', () => {
        it('should sanitize values with colons', () => {
            const key = CacheKeyBuilder.create('cache').segment('value:with:colons').build();
            expect(key).toBe('cache:value-with-colons');
        });

        it('should trim whitespace', () => {
            const key = CacheKeyBuilder.create('cache').segment('  value  ').build();
            expect(key).toBe('cache:value');
        });
    });
});

describe('Helper Functions', () => {
    describe('orgKey', () => {
        it('should create org-scoped key', () => {
            const key = orgKey('brand', 'acme-corp', 'brandkit');
            expect(key).toBe('brand:org:acme-corp:brandkit');
        });

        it('should handle multiple segments', () => {
            const key = orgKey('brand', 'acme', 'kit', 'colors', 'primary');
            expect(key).toBe('brand:org:acme:kit:colors:primary');
        });

        it('should handle no additional segments', () => {
            const key = orgKey('brand', 'acme');
            expect(key).toBe('brand:org:acme');
        });
    });

    describe('userKey', () => {
        it('should create user-scoped key', () => {
            const key = userKey('session', 'user-123', 'active');
            expect(key).toBe('session:u:user-123:active');
        });

        it('should handle multiple segments', () => {
            const key = userKey('cache', 'user-456', 'preferences', 'theme', 'dark');
            expect(key).toBe('cache:u:user-456:preferences:theme:dark');
        });
    });

    describe('appKey', () => {
        it('should create app-scoped key', () => {
            const key = appKey('config', 'web', 'settings');
            expect(key).toBe('config:app:web:settings');
        });
    });

    describe('orgAppKey', () => {
        it('should create org+app composite key', () => {
            const key = orgAppKey('brand', 'acme', 'web', 'layout');
            expect(key).toBe('brand:org:acme:app:web:layout');
        });

        it('should handle additional segments', () => {
            const key = orgAppKey('brand', 'acme', 'web', 'layout', 'header', 'logo');
            expect(key).toBe('brand:org:acme:app:web:layout:header:logo');
        });
    });

    describe('orgUserKey', () => {
        it('should create org+user composite key', () => {
            const key = orgUserKey('rbac', 'acme', 'user-123', 'roles');
            expect(key).toBe('rbac:org:acme:u:user-123:roles');
        });
    });

    describe('versionedOrgKey', () => {
        it('should create versioned org key with string version', () => {
            const key = versionedOrgKey('rbac', 'acme', 'v1', 'cache');
            expect(key).toBe('rbac:org:acme:vv1:cache');
        });

        it('should create versioned org key with number version', () => {
            const key = versionedOrgKey('rbac', 'acme', 2, 'cache');
            expect(key).toBe('rbac:org:acme:v2:cache');
        });

        it('should handle additional segments', () => {
            const key = versionedOrgKey('rbac', 'acme', 1, 'user', 'user-123', 'perms');
            expect(key).toBe('rbac:org:acme:v1:user:user-123:perms');
        });
    });

    describe('globalKey', () => {
        it('should create global key', () => {
            const key = globalKey('system', 'maintenance');
            expect(key).toBe('system:maintenance');
        });

        it('should handle multiple segments', () => {
            const key = globalKey('system', 'config', 'feature', 'flags');
            expect(key).toBe('system:config:feature:flags');
        });
    });
});

describe('parseKey', () => {
    it('should parse simple namespaced key', () => {
        const parsed = parseKey('rbac:roles');
        expect(parsed).toEqual({
            namespace: 'rbac',
            segments: ['roles'],
        });
    });

    it('should parse org-scoped key', () => {
        const parsed = parseKey('brand:org:acme-corp:brandkit');
        expect(parsed).toEqual({
            namespace: 'brand',
            scope: 'org',
            orgId: 'acme-corp',
            segments: ['brandkit'],
        });
    });

    it('should parse user-scoped key', () => {
        const parsed = parseKey('session:u:user-123:active');
        expect(parsed).toEqual({
            namespace: 'session',
            scope: 'user',
            userId: 'user-123',
            segments: ['active'],
        });
    });

    it('should parse app-scoped key', () => {
        const parsed = parseKey('config:app:web:settings');
        expect(parsed).toEqual({
            namespace: 'config',
            scope: 'app',
            appId: 'web',
            segments: ['settings'],
        });
    });

    it('should parse org+app composite key', () => {
        const parsed = parseKey('brand:org:acme:app:web:layout');
        expect(parsed).toEqual({
            namespace: 'brand',
            scope: 'app', // Last scope wins in simple parser
            orgId: 'acme',
            appId: 'web',
            segments: ['layout'],
        });
    });

    it('should parse versioned key', () => {
        const parsed = parseKey('rbac:org:acme:v2:cache');
        expect(parsed).toEqual({
            namespace: 'rbac',
            scope: 'org',
            orgId: 'acme',
            version: '2',
            segments: ['cache'],
        });
    });

    it('should parse complex composite key', () => {
        const parsed = parseKey('rbac:org:acme:v1:app:web:u:user-123:perms');
        expect(parsed).toEqual({
            namespace: 'rbac',
            scope: 'user', // Last scope
            orgId: 'acme',
            appId: 'web',
            userId: 'user-123',
            version: '1',
            segments: ['perms'],
        });
    });

    it('should handle key without namespace', () => {
        const parsed = parseKey('org:acme:test');
        expect(parsed).toEqual({
            scope: 'org',
            orgId: 'acme',
            segments: ['test'],
        });
    });
});

describe('Real-world usage examples', () => {
    it('should create RBAC cache keys', () => {
        const orgId = 'acme-corp';
        const userId = 'user-123';
        const appId = 'web';
        const version = 1;

        const userKey = CacheKeyBuilder.create('rbac')
            .org(orgId)
            .version(version)
            .app(appId)
            .user(userId)
            .segment('context')
            .build();

        expect(userKey).toBe('rbac:org:acme-corp:v1:app:web:u:user-123:context');
    });

    it('should create brand cache keys', () => {
        const orgId = 'acme';
        const appId = 'web';
        const mode = 'light';

        const brandKey = orgAppKey('brand', orgId, appId, 'resolved', mode);
        expect(brandKey).toBe('brand:org:acme:app:web:resolved:light');
    });

    it('should create rate limit keys', () => {
        const userId = 'user-123';
        const endpoint = 'api:posts:create';

        const rateLimitKey = userKey('ratelimit', userId, endpoint);
        // Colons in segments are sanitized to prevent key corruption
        expect(rateLimitKey).toBe('ratelimit:u:user-123:api-posts-create');
    });

    it('should create queue deduplication keys', () => {
        const orgId = 'acme';
        const jobType = 'email:send';
        const uniqueId = 'msg-456';

        const dedupeKey = orgKey('dedupe', orgId, jobType, uniqueId);
        // Colons in segments are sanitized to prevent key corruption
        expect(dedupeKey).toBe('dedupe:org:acme:email-send:msg-456');
    });

    it('should create version keys for cache invalidation', () => {
        const orgId = 'acme';
        const versionKey = orgKey('rbac', orgId, 'version');
        expect(versionKey).toBe('rbac:org:acme:version');
    });
});
