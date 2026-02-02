// ============================================================
// @ottabase/rbac - Cache Layer
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

    clear(): void {
        this.cache.clear();
    }
}

/**
 * RBAC cache manager
 * Provides two-level caching:
 * 1. Request-level in-memory cache (short TTL, same request)
 * 2. KV cache (longer TTL, across requests)
 */
export class RBACCache {
    private kv?: KVNamespace;
    private ttl: number;
    private prefix: string;
    private enabled: boolean;
    private requestCache: RequestCache;

    constructor(config: RBACCacheConfig = {}) {
        this.kv = config.kv;
        this.ttl = config.ttl || 300; // 5 minutes default
        this.prefix = config.prefix || 'rbac:';
        this.enabled = config.enabled !== undefined ? config.enabled : !!config.kv;
        this.requestCache = new RequestCache();
    }

    /**
     * Get user RBAC context from cache
     */
    async getUserContext(userId: string): Promise<RBACContext | null> {
        if (!this.enabled) return null;

        // Check request cache first (fastest)
        const requestCacheKey = `${this.prefix}user:${userId}`;
        const requestCached = this.requestCache.get<RBACContext>(requestCacheKey);
        if (requestCached) return requestCached;

        // Check KV cache
        if (this.kv) {
            try {
                const kvKey = `${this.prefix}user:${userId}`;
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
     * Set user RBAC context in cache
     */
    async setUserContext(userId: string, context: RBACContext): Promise<void> {
        if (!this.enabled) return;

        const requestCacheKey = `${this.prefix}user:${userId}`;

        // Always set in request cache
        this.requestCache.set(requestCacheKey, context, 60);

        // Set in KV if available
        if (this.kv) {
            try {
                const kvKey = `${this.prefix}user:${userId}`;
                await this.kv.put(kvKey, JSON.stringify(context), {
                    expirationTtl: this.ttl,
                });
            } catch (error) {
                console.error('Failed to set RBAC context in KV:', error);
            }
        }
    }

    /**
     * Get user roles from cache
     */
    async getUserRoles(userId: string): Promise<string[] | null> {
        if (!this.enabled) return null;

        // Check request cache first
        const requestCacheKey = `${this.prefix}roles:${userId}`;
        const requestCached = this.requestCache.get<string[]>(requestCacheKey);
        if (requestCached) return requestCached;

        // Check KV cache
        if (this.kv) {
            try {
                const kvKey = `${this.prefix}roles:${userId}`;
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
     * Set user roles in cache
     */
    async setUserRoles(userId: string, roles: string[]): Promise<void> {
        if (!this.enabled) return;

        const requestCacheKey = `${this.prefix}roles:${userId}`;

        // Always set in request cache
        this.requestCache.set(requestCacheKey, roles, 60);

        // Set in KV if available
        if (this.kv) {
            try {
                const kvKey = `${this.prefix}roles:${userId}`;
                await this.kv.put(kvKey, JSON.stringify(roles), {
                    expirationTtl: this.ttl,
                });
            } catch (error) {
                console.error('Failed to set roles in KV:', error);
            }
        }
    }

    /**
     * Get user permissions from cache
     */
    async getUserPermissions(userId: string): Promise<string[] | null> {
        if (!this.enabled) return null;

        // Check request cache first
        const requestCacheKey = `${this.prefix}perms:${userId}`;
        const requestCached = this.requestCache.get<string[]>(requestCacheKey);
        if (requestCached) return requestCached;

        // Check KV cache
        if (this.kv) {
            try {
                const kvKey = `${this.prefix}perms:${userId}`;
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
     * Set user permissions in cache
     */
    async setUserPermissions(userId: string, permissions: string[]): Promise<void> {
        if (!this.enabled) return;

        const requestCacheKey = `${this.prefix}perms:${userId}`;

        // Always set in request cache
        this.requestCache.set(requestCacheKey, permissions, 60);

        // Set in KV if available
        if (this.kv) {
            try {
                const kvKey = `${this.prefix}perms:${userId}`;
                await this.kv.put(kvKey, JSON.stringify(permissions), {
                    expirationTtl: this.ttl,
                });
            } catch (error) {
                console.error('Failed to set permissions in KV:', error);
            }
        }
    }

    /**
     * Invalidate all cache for a user
     */
    async invalidateUser(userId: string): Promise<void> {
        // Clear request cache
        this.requestCache.delete(`${this.prefix}user:${userId}`);
        this.requestCache.delete(`${this.prefix}roles:${userId}`);
        this.requestCache.delete(`${this.prefix}perms:${userId}`);

        // Clear KV cache
        if (this.kv) {
            try {
                await Promise.all([
                    this.kv.delete(`${this.prefix}user:${userId}`),
                    this.kv.delete(`${this.prefix}roles:${userId}`),
                    this.kv.delete(`${this.prefix}perms:${userId}`),
                ]);
            } catch (error) {
                console.error('Failed to invalidate RBAC cache in KV:', error);
            }
        }
    }

    /**
     * Invalidate role cache for all users with a specific role
     */
    async invalidateRole(roleName: string): Promise<void> {
        // For role changes, we need to invalidate all user caches
        // This is expensive, so consider using a versioning strategy in production
        if (this.kv) {
            try {
                // List all RBAC cache keys and delete them
                const list = await this.kv.list({ prefix: this.prefix });
                const deletePromises = list.keys.map((key) => this.kv!.delete(key.name));
                await Promise.all(deletePromises);
            } catch (error) {
                console.error('Failed to invalidate role cache in KV:', error);
            }
        }

        // Clear request cache
        this.requestCache.clear();
    }

    /**
     * Clear all caches
     */
    async clear(): Promise<void> {
        this.requestCache.clear();

        if (this.kv) {
            try {
                const list = await this.kv.list({ prefix: this.prefix });
                const deletePromises = list.keys.map((key) => this.kv!.delete(key.name));
                await Promise.all(deletePromises);
            } catch (error) {
                console.error('Failed to clear RBAC cache in KV:', error);
            }
        }
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
