/**
 * Cache Key Builder for KV Storage
 * Provides type-safe, namespaced cache keys to prevent accidental overwrites
 *
 * Key Format Examples:
 * - Organization: org:{orgId}:brandkit
 * - User: u:{userId}:preferences
 * - App: app:{appId}:config
 * - Composite: org:{orgId}:app:{appId}:layout
 * - With version: org:{orgId}:v{version}:user:{userId}:rbac
 *
 * @see https://developers.cloudflare.com/kv/
 */

export type CacheScope =
    | 'org' // Organization-level cache
    | 'user' // User-level cache
    | 'app' // Application-level cache
    | 'global' // Global/shared cache
    | 'system'; // System-level cache

export type CacheNamespace =
    | 'rbac' // RBAC permissions/roles
    | 'brand' // Brand kits and layouts
    | 'ratelimit' // Rate limiting
    | 'dedupe' // Job deduplication
    | 'session' // User sessions
    | 'config' // Configuration
    | 'cache' // General caching
    | 'system' // System-level operations
    | 'temp'; // Temporary data

/**
 * Cache key segment - represents a part of the cache key
 */
interface KeySegment {
    type: CacheScope;
    id: string;
}

/**
 * Options for building cache keys
 */
export interface CacheKeyOptions {
    namespace?: CacheNamespace;
    version?: string | number;
    segments?: string[];
}

/**
 * Cache Key Builder
 * Constructs consistent, namespaced cache keys with type safety
 */
export class CacheKeyBuilder {
    private parts: string[] = [];

    /**
     * Create a new cache key builder with optional namespace
     */
    constructor(namespace?: CacheNamespace) {
        if (namespace) {
            this.parts.push(namespace);
        }
    }

    /**
     * Add organization scope
     */
    org(orgId: string): this {
        if (!orgId) {
            throw new Error('Organization ID is required for org scope');
        }
        this.parts.push('org', this.sanitize(orgId));
        return this;
    }

    /**
     * Add user scope
     */
    user(userId: string): this {
        if (!userId) {
            throw new Error('User ID is required for user scope');
        }
        this.parts.push('u', this.sanitize(userId));
        return this;
    }

    /**
     * Add app scope
     */
    app(appId: string): this {
        if (!appId) {
            throw new Error('App ID is required for app scope');
        }
        this.parts.push('app', this.sanitize(appId));
        return this;
    }

    /**
     * Add version segment
     */
    version(version: string | number): this {
        this.parts.push(`v${version}`);
        return this;
    }

    /**
     * Add custom segment
     */
    segment(segment: string): this {
        if (!segment) {
            throw new Error('Segment cannot be empty');
        }
        this.parts.push(this.sanitize(segment));
        return this;
    }

    /**
     * Add multiple custom segments
     */
    segments(...segments: string[]): this {
        for (const seg of segments) {
            this.segment(seg);
        }
        return this;
    }

    /**
     * Build the final cache key
     */
    build(): string {
        if (this.parts.length === 0) {
            throw new Error('Cache key must have at least one part');
        }
        return this.parts.join(':');
    }

    /**
     * Sanitize a key segment to prevent injection attacks
     */
    private sanitize(value: string): string {
        // Remove colons and whitespace to prevent key structure corruption
        return value.replace(/[:]/g, '-').trim();
    }

    /**
     * Create a new builder instance
     */
    static create(namespace?: CacheNamespace): CacheKeyBuilder {
        return new CacheKeyBuilder(namespace);
    }
}

/**
 * Helper functions for common cache key patterns
 */

/**
 * Build organization-scoped cache key
 * Example: brand:org:acme-corp:brandkit
 */
export function orgKey(namespace: CacheNamespace, orgId: string, ...segments: string[]): string {
    return CacheKeyBuilder.create(namespace)
        .org(orgId)
        .segments(...segments)
        .build();
}

/**
 * Build user-scoped cache key
 * Example: session:u:user123:active
 */
export function userKey(namespace: CacheNamespace, userId: string, ...segments: string[]): string {
    return CacheKeyBuilder.create(namespace)
        .user(userId)
        .segments(...segments)
        .build();
}

/**
 * Build app-scoped cache key
 * Example: config:app:web:settings
 */
export function appKey(namespace: CacheNamespace, appId: string, ...segments: string[]): string {
    return CacheKeyBuilder.create(namespace)
        .app(appId)
        .segments(...segments)
        .build();
}

/**
 * Build org+app composite cache key
 * Example: brand:org:acme:app:web:layout
 */
export function orgAppKey(namespace: CacheNamespace, orgId: string, appId: string, ...segments: string[]): string {
    return CacheKeyBuilder.create(namespace)
        .org(orgId)
        .app(appId)
        .segments(...segments)
        .build();
}

/**
 * Build org+user composite cache key
 * Example: rbac:org:acme:u:user123:roles
 */
export function orgUserKey(namespace: CacheNamespace, orgId: string, userId: string, ...segments: string[]): string {
    return CacheKeyBuilder.create(namespace)
        .org(orgId)
        .user(userId)
        .segments(...segments)
        .build();
}

/**
 * Build versioned org cache key (for O(1) invalidation)
 * Example: rbac:org:acme:v2:u:user123:perms
 */
export function versionedOrgKey(
    namespace: CacheNamespace,
    orgId: string,
    version: string | number,
    ...segments: string[]
): string {
    return CacheKeyBuilder.create(namespace)
        .org(orgId)
        .version(version)
        .segments(...segments)
        .build();
}

/**
 * Build global cache key (use sparingly)
 * Example: system:global:maintenance
 */
export function globalKey(namespace: CacheNamespace, ...segments: string[]): string {
    return CacheKeyBuilder.create(namespace)
        .segments(...segments)
        .build();
}

/**
 * Parse a cache key to extract its components
 * Useful for debugging and monitoring
 */
export function parseKey(key: string): {
    namespace?: string;
    scope?: CacheScope;
    orgId?: string;
    userId?: string;
    appId?: string;
    version?: string;
    segments: string[];
} {
    const parts = key.split(':');
    const result: ReturnType<typeof parseKey> = {
        segments: [],
    };

    let i = 0;

    // First part might be namespace
    if (parts[i] && !['org', 'u', 'app', 'v'].some((p) => parts[i].startsWith(p))) {
        result.namespace = parts[i];
        i++;
    }

    // Parse scope segments
    while (i < parts.length) {
        const part = parts[i];

        if (part === 'org' && parts[i + 1]) {
            result.scope = 'org';
            result.orgId = parts[i + 1];
            i += 2;
        } else if (part === 'u' && parts[i + 1]) {
            result.scope = 'user';
            result.userId = parts[i + 1];
            i += 2;
        } else if (part === 'app' && parts[i + 1]) {
            result.scope = 'app';
            result.appId = parts[i + 1];
            i += 2;
        } else if (part.startsWith('v')) {
            result.version = part.substring(1);
            i++;
        } else {
            result.segments.push(part);
            i++;
        }
    }

    return result;
}
