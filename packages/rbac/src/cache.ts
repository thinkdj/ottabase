// ============================================================
// @ottabase/rbac - Cache Layer (Production-Optimized)
// ============================================================

import type { KVNamespace } from '@cloudflare/workers-types';
import type { RBACContext } from './types';

/**
 * Cache configuration
 */
export interface RBACCacheConfig {
    kv?: KVNamespace;
    ttl?: number; // Cache TTL in seconds (default: 300 = 5 minutes)
    prefix?: string; // Cache key prefix (default: 'rbac:')
    enabled?: boolean; // Enable/disable caching (default: true if KV is provided)
    version?: string; // Cache version for instant invalidation (default: 'v1')
}

/**
 * In-memory cache for request-level caching
 * Prevents multiple DB queries within the same request
 */
class RequestCache {
    private cache = new Map<string, { data: any; expires: number }>();

    get<T>(key: string): T | null {
        const item = this.cache.get(key);
        if (!item) return null;

        if (Date.now() > item.expires) {
            this.cache.delete(key);
            return null;
        }

        return item.data as T;
    }

    set<T>(key: string, data: T, ttlSeconds: number = 60): void {
        this.cache.set(key, {
            data,
            expires: Date.now() + ttlSeconds * 1000,
        });
    }

    delete(key: string): void {
        this.cache.delete(key);
    }

    deletePattern(pattern: RegExp): void {
        for (const key of this.cache.keys()) {
            if (pattern.test(key)) {
                this.cache.delete(key);
            }
        }
    }

    clear(): void {
        this.cache.clear();
    }
}

/**
 * RBAC cache manager with multi-tenant support and cache versioning
 * Provides two-level caching:
 * 1. Request-level in-memory cache (short TTL, same request)
 * 2. KV cache (longer TTL, across requests)
 *
 * Cache versioning enables O(1) invalidation instead of O(n)
 */
export class RBACCache {
    private kv?: KVNamespace;
    private ttl: number;
    private prefix: string;
    private enabled: boolean;
    private requestCache: RequestCache;
    private version: string;
    private versionCacheKey: string;

    constructor(config: RBACCacheConfig = {}) {
        this.kv = config.kv;
        this.ttl = config.ttl || 300; // 5 minutes default
        this.prefix = config.prefix || 'rbac:';
        this.enabled = config.enabled !== undefined ? config.enabled : !!config.kv;
        this.requestCache = new RequestCache();
        this.version = config.version || 'v1';
        this.versionCacheKey = `${this.prefix}cache_version`;
    }

    /**
     * Get current cache version from KV (or use default)
     * Cache version enables instant invalidation
     */
    private async getCacheVersion(): Promise<string> {
        if (!this.kv) return this.version;

        try {
            const stored = await this.kv.get(this.versionCacheKey, 'text');
            return stored || this.version;
        } catch (error) {
            console.error('Failed to get cache version from KV:', error);
            return this.version;
        }
    }

    /**
     * Increment cache version for instant O(1) invalidation
     * Old cache entries will naturally expire, no need to delete them
     */
    private async incrementCacheVersion(): Promise<string> {
        if (!this.kv) return this.version;

        try {
            const current = await this.getCacheVersion();
            const match = current.match(/v(\d+)/);
            const num = match ? parseInt(match[1], 10) : 1;
            const newVersion = `v${num + 1}`;

            await this.kv.put(this.versionCacheKey, newVersion, {
                expirationTtl: 86400 * 30, // 30 days
            });

            this.version = newVersion;
            return newVersion;
        } catch (error) {
            console.error('Failed to increment cache version:', error);
            return this.version;
        }
    }

    /**
     * Build cache key with tenant/org scoping and versioning
     * Format: rbac:v1:org:org-123:user:user-456
     */
    private buildCacheKey(
        type: 'user' | 'roles' | 'perms',
        userId: string,
        organizationId?: string
    ): string {
        const version = this.version;
        const parts = [this.prefix, version];

        if (organizationId) {
            parts.push('org', organizationId);
        }

        parts.push(type, userId);
        return parts.join(':');
    }

    /**
     * Get user RBAC context from cache (tenant-aware)
     */
    async getUserContext(userId: string, organizationId?: string): Promise<RBACContext | null> {
        if (!this.enabled) return null;

        const version = await this.getCacheVersion();
        const requestCacheKey = this.buildCacheKey('user', userId, organizationId);

        // Check request cache first (fastest)
        const requestCached = this.requestCache.get<RBACContext>(requestCacheKey);
        if (requestCached) return requestCached;

        // Check KV cache
        if (this.kv) {
            try {
                const kvKey = this.buildCacheKey('user', userId, organizationId);
                const cached = await this.kv.get(kvKey, 'json');
                if (cached) {
                    const context = cached as RBACContext;
                    // Store in request cache for fast subsequent access
                    this.requestCache.set(requestCacheKey, context, 60);
                    return context;
                }
            } catch (error) {
                console.error('Failed to get RBAC context from KV:', error);
            }
        }

        return null;
    }

    /**
     * Set user RBAC context in cache (tenant-aware)
     */
    async setUserContext(userId: string, context: RBACContext, organizationId?: string): Promise<void> {
        if (!this.enabled) return;

        const version = await this.getCacheVersion();
        const requestCacheKey = this.buildCacheKey('user', userId, organizationId);

        // Always set in request cache
        this.requestCache.set(requestCacheKey, context, 60);

        // Set in KV if available
        if (this.kv) {
            try {
                const kvKey = this.buildCacheKey('user', userId, organizationId);
                await this.kv.put(kvKey, JSON.stringify(context), {
                    expirationTtl: this.ttl,
                });
            } catch (error) {
                console.error('Failed to set RBAC context in KV:', error);
            }
        }
    }

    /**
     * Get user roles from cache (tenant-aware)
     */
    async getUserRoles(userId: string, organizationId?: string): Promise<string[] | null> {
        if (!this.enabled) return null;

        const version = await this.getCacheVersion();
        const requestCacheKey = this.buildCacheKey('roles', userId, organizationId);

        // Check request cache first
        const requestCached = this.requestCache.get<string[]>(requestCacheKey);
        if (requestCached) return requestCached;

        // Check KV cache
        if (this.kv) {
            try {
                const kvKey = this.buildCacheKey('roles', userId, organizationId);
                const cached = await this.kv.get(kvKey, 'json');
                if (cached) {
                    const roles = cached as string[];
                    this.requestCache.set(requestCacheKey, roles, 60);
                    return roles;
                }
            } catch (error) {
                console.error('Failed to get roles from KV:', error);
            }
        }

        return null;
    }

    /**
     * Set user roles in cache (tenant-aware)
     */
    async setUserRoles(userId: string, roles: string[], organizationId?: string): Promise<void> {
        if (!this.enabled) return;

        const version = await this.getCacheVersion();
        const requestCacheKey = this.buildCacheKey('roles', userId, organizationId);

        // Always set in request cache
        this.requestCache.set(requestCacheKey, roles, 60);

        // Set in KV if available
        if (this.kv) {
            try {
                const kvKey = this.buildCacheKey('roles', userId, organizationId);
                await this.kv.put(kvKey, JSON.stringify(roles), {
                    expirationTtl: this.ttl,
                });
            } catch (error) {
                console.error('Failed to set roles in KV:', error);
            }
        }
    }

    /**
     * Get user permissions from cache (tenant-aware)
     */
    async getUserPermissions(userId: string, organizationId?: string): Promise<string[] | null> {
        if (!this.enabled) return null;

        const version = await this.getCacheVersion();
        const requestCacheKey = this.buildCacheKey('perms', userId, organizationId);

        // Check request cache first
        const requestCached = this.requestCache.get<string[]>(requestCacheKey);
        if (requestCached) return requestCached;

        // Check KV cache
        if (this.kv) {
            try {
                const kvKey = this.buildCacheKey('perms', userId, organizationId);
                const cached = await this.kv.get(kvKey, 'json');
                if (cached) {
                    const permissions = cached as string[];
                    this.requestCache.set(requestCacheKey, permissions, 60);
                    return permissions;
                }
            } catch (error) {
                console.error('Failed to get permissions from KV:', error);
            }
        }

        return null;
    }

    /**
     * Set user permissions in cache (tenant-aware)
     */
    async setUserPermissions(userId: string, permissions: string[], organizationId?: string): Promise<void> {
        if (!this.enabled) return;

        const version = await this.getCacheVersion();
        const requestCacheKey = this.buildCacheKey('perms', userId, organizationId);

        // Always set in request cache
        this.requestCache.set(requestCacheKey, permissions, 60);

        // Set in KV if available
        if (this.kv) {
            try {
                const kvKey = this.buildCacheKey('perms', userId, organizationId);
                await this.kv.put(kvKey, JSON.stringify(permissions), {
                    expirationTtl: this.ttl,
                });
            } catch (error) {
                console.error('Failed to set permissions in KV:', error);
            }
        }
    }

    /**
     * Invalidate all cache for a user (tenant-aware)
     * Only clears request cache, KV entries expire naturally
     */
    async invalidateUser(userId: string, organizationId?: string): Promise<void> {
        // Clear request cache for this user (all types)
        const userPattern = organizationId
            ? new RegExp(`${this.prefix}.*:org:${organizationId}:.*:${userId}$`)
            : new RegExp(`${this.prefix}.*:user:${userId}$|${this.prefix}.*:roles:${userId}$|${this.prefix}.*:perms:${userId}$`);

        this.requestCache.deletePattern(userPattern);

        // Note: We don't delete from KV - entries expire naturally
        // This avoids costly KV.delete() operations
    }

    /**
     * Invalidate role cache for all users (O(1) operation!)
     * Increments cache version instead of deleting individual entries
     * Old cache entries will naturally expire based on TTL
     */
    async invalidateRole(roleName: string): Promise<void> {
        // Increment cache version for instant invalidation
        await this.incrementCacheVersion();

        // Clear request cache
        this.requestCache.clear();

        console.log(`Cache invalidated for role: ${roleName}. New version: ${this.version}`);
    }

    /**
     * Clear all caches (useful for testing or emergency)
     * This is the only O(n) operation, but should rarely be used
     */
    async clear(): Promise<void> {
        this.requestCache.clear();

        if (this.kv) {
            try {
                // Only list and delete entries with current version
                const list = await this.kv.list({ prefix: `${this.prefix}${this.version}:` });
                if (list.keys.length > 0) {
                    const deletePromises = list.keys.map((key) => this.kv!.delete(key.name));
                    await Promise.all(deletePromises);
                }
            } catch (error) {
                console.error('Failed to clear RBAC cache in KV:', error);
            }
        }
    }

    /**
     * Get current cache statistics (for monitoring)
     */
    async getStats(): Promise<{
        version: string;
        requestCacheSize: number;
        enabled: boolean;
        kvAvailable: boolean;
    }> {
        return {
            version: await this.getCacheVersion(),
            requestCacheSize: this.requestCache['cache'].size,
            enabled: this.enabled,
            kvAvailable: !!this.kv,
        };
    }
}

/**
 * Global cache instance
 */
let globalCache: RBACCache | null = null;

/**
 * Initialize the global RBAC cache
 */
export function initRBACCache(config: RBACCacheConfig): RBACCache {
    globalCache = new RBACCache(config);
    return globalCache;
}

/**
 * Get the global RBAC cache instance
 */
export function getRBACCache(): RBACCache {
    if (!globalCache) {
        globalCache = new RBACCache({ enabled: false });
    }
    return globalCache;
}

/**
 * Clear the global cache
 */
export function clearRBACCache(): void {
    globalCache = null;
}
