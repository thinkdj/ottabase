// ============================================================
// @ottabase/rbac - Cache Layer (Production-Optimized, Multi-Tenant Secure)
// ============================================================

import type { KVClient } from '@ottabase/cf';
import { CacheKeyBuilder, orgKey } from '@ottabase/cf/cache-keys';
import logger from '@ottabase/logger';
import type { RBACContext } from './types';

/** Escape special regex characters in a string for safe use in RegExp */
function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Cache configuration
 */
export interface RBACCacheConfig {
    kv?: KVClient;
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
 * RBAC cache manager with enforced multi-tenant security
 *
 * SECURITY: organizationId is REQUIRED in all operations to prevent cross-tenant data leakage
 * PERFORMANCE: Per-organization cache versioning enables O(1) invalidation
 *
 * Hierarchy: Tenant > App > User
 *
 * Cache Key Format (via @ottabase/cf/cache-keys builder):
 * - With app: rbac:org:org-123:v1:app:web:usr:user-456:roles
 * - Without app: rbac:org:org-123:v1:usr:user-456:roles
 *
 * Provides two-level caching:
 * 1. Request-level in-memory cache (short TTL, same request)
 * 2. KV cache (longer TTL, across requests)
 */
export class RBACCache {
    private kv?: KVClient;
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

    /** Namespace for cache key builder (prefix without trailing colon) */
    private get namespace(): string {
        return this.prefix.replace(/:$/, '');
    }

    /**
     * Get current cache version for an organization from KV
     * Each organization has its own cache version for isolated invalidation
     * Format: rbac:version:org:org-123 -> "v1", "v2", etc.
     */
    private async getOrgCacheVersion(organizationId: string): Promise<string> {
        if (!this.kv) return 'v1';

        try {
            const versionKey = orgKey(this.namespace, organizationId, 'version');
            const result = await this.kv.getText(versionKey);

            if (result.success && result.data) {
                return result.data;
            }
            return 'v1';
        } catch (error) {
            logger.error(
                'Failed to get cache version for organization',
                error instanceof Error ? error : new Error(String(error)),
                { organizationId },
            );
            return 'v1';
        }
    }

    /**
     * Increment cache version for a specific organization (O(1) invalidation!)
     * Only affects one organization, not all tenants
     */
    private async incrementOrgCacheVersion(organizationId: string): Promise<string> {
        if (!this.kv) return 'v1';

        try {
            const current = await this.getOrgCacheVersion(organizationId);
            const match = current.match(/v(\d+)/);
            const num = match ? parseInt(match[1], 10) : 1;
            const newVersion = `v${num + 1}`;

            const versionKey = orgKey(this.namespace, organizationId, 'version');
            const result = await this.kv.put(versionKey, newVersion, {
                expirationTtl: 86400 * 30, // 30 days
            });

            if (!result.success) {
                logger.error(
                    'Failed to increment cache version for organization',
                    result.error instanceof Error ? result.error : new Error(String(result.error)),
                    { organizationId },
                );
                return current; // Return current version on error
            }

            return newVersion;
        } catch (error) {
            logger.error(
                'Failed to increment cache version for organization',
                error instanceof Error ? error : new Error(String(error)),
                { organizationId },
            );
            return 'v1';
        }
    }

    /**
     * Build cache key with REQUIRED organization scoping and optional app scoping
     *
     * Format examples:
     * - With app: rbac:org:org-123:v1:app:web:usr:user-456:user
     * - Without app: rbac:org:org-123:v1:usr:user-456:user
     *
     * @param type Cache entry type (user, roles, perms)
     * @param userId User ID
     * @param organizationId Organization ID (REQUIRED for security)
     * @param appId Optional app ID (null means all apps)
     * @param version Cache version (will be fetched if not provided)
     */
    private async buildCacheKey(
        type: 'user' | 'roles' | 'perms',
        userId: string,
        organizationId: string,
        appId?: string | null,
        version?: string,
    ): Promise<string> {
        const orgVersion = version || (await this.getOrgCacheVersion(organizationId));
        const builder = CacheKeyBuilder.create(this.namespace).org(organizationId).version(orgVersion);
        if (appId) builder.app(appId);
        return builder.user(userId).segment(type).build();
    }

    /**
     * Get user RBAC context from cache
     * @param userId User ID
     * @param organizationId Organization ID (REQUIRED for security)
     * @param appId Optional app ID
     */
    async getUserContext(userId: string, organizationId: string, appId?: string | null): Promise<RBACContext | null> {
        if (!this.enabled) return null;
        if (!organizationId) {
            throw new Error('organizationId is required for tenant-scoped caching');
        }

        const version = await this.getOrgCacheVersion(organizationId);
        const requestCacheKey = await this.buildCacheKey('user', userId, organizationId, appId, version);

        // Check request cache first (fastest)
        const requestCached = this.requestCache.get<RBACContext>(requestCacheKey);
        if (requestCached) return requestCached;

        // Check KV cache
        if (this.kv) {
            try {
                const result = await this.kv.getJSON<RBACContext>(requestCacheKey);
                if (result.success && result.data) {
                    const context = result.data;
                    // Store in request cache for fast subsequent access
                    this.requestCache.set(requestCacheKey, context, 60);
                    return context;
                }
            } catch (error) {
                logger.error(
                    'Failed to get RBAC context from KV',
                    error instanceof Error ? error : new Error(String(error)),
                );
            }
        }

        return null;
    }

    /**
     * Set user RBAC context in cache
     * @param userId User ID
     * @param context RBAC context
     * @param organizationId Organization ID (REQUIRED for security)
     * @param appId Optional app ID
     */
    async setUserContext(
        userId: string,
        context: RBACContext,
        organizationId: string,
        appId?: string | null,
    ): Promise<void> {
        if (!this.enabled) return;
        if (!organizationId) {
            throw new Error('organizationId is required for tenant-scoped caching');
        }

        const version = await this.getOrgCacheVersion(organizationId);
        const cacheKey = await this.buildCacheKey('user', userId, organizationId, appId, version);

        // Always set in request cache
        this.requestCache.set(cacheKey, context, 60);

        // Set in KV if available
        if (this.kv) {
            try {
                const result = await this.kv.putJSON(cacheKey, context, {
                    expirationTtl: this.ttl,
                });
                if (!result.success) {
                    logger.error(
                        'Failed to set RBAC context in KV',
                        result.error instanceof Error ? result.error : new Error(String(result.error)),
                    );
                }
            } catch (error) {
                logger.error(
                    'Failed to set RBAC context in KV',
                    error instanceof Error ? error : new Error(String(error)),
                );
            }
        }
    }

    /**
     * Get user roles from cache
     * @param userId User ID
     * @param organizationId Organization ID (REQUIRED for security)
     * @param appId Optional app ID
     */
    async getUserRoles(userId: string, organizationId: string, appId?: string | null): Promise<string[] | null> {
        if (!this.enabled) return null;
        if (!organizationId) {
            throw new Error('organizationId is required for tenant-scoped caching');
        }

        const version = await this.getOrgCacheVersion(organizationId);
        const cacheKey = await this.buildCacheKey('roles', userId, organizationId, appId, version);

        // Check request cache first
        const requestCached = this.requestCache.get<string[]>(cacheKey);
        if (requestCached) return requestCached;

        // Check KV cache
        if (this.kv) {
            try {
                const result = await this.kv.getJSON<string[]>(cacheKey);
                if (result.success && result.data) {
                    const roles = result.data;
                    this.requestCache.set(cacheKey, roles, 60);
                    return roles;
                }
            } catch (error) {
                logger.error('Failed to get roles from KV', error instanceof Error ? error : new Error(String(error)));
            }
        }

        return null;
    }

    /**
     * Set user roles in cache
     * @param userId User ID
     * @param roles User roles
     * @param organizationId Organization ID (REQUIRED for security)
     * @param appId Optional app ID
     */
    async setUserRoles(userId: string, roles: string[], organizationId: string, appId?: string | null): Promise<void> {
        if (!this.enabled) return;
        if (!organizationId) {
            throw new Error('organizationId is required for tenant-scoped caching');
        }

        const version = await this.getOrgCacheVersion(organizationId);
        const cacheKey = await this.buildCacheKey('roles', userId, organizationId, appId, version);

        // Always set in request cache
        this.requestCache.set(cacheKey, roles, 60);

        // Set in KV if available
        if (this.kv) {
            try {
                const result = await this.kv.putJSON(cacheKey, roles, {
                    expirationTtl: this.ttl,
                });
                if (!result.success) {
                    logger.error(
                        'Failed to set roles in KV',
                        result.error instanceof Error ? result.error : new Error(String(result.error)),
                    );
                }
            } catch (error) {
                logger.error('Failed to set roles in KV', error instanceof Error ? error : new Error(String(error)));
            }
        }
    }

    /**
     * Get user permissions from cache
     * @param userId User ID
     * @param organizationId Organization ID (REQUIRED for security)
     * @param appId Optional app ID
     */
    async getUserPermissions(userId: string, organizationId: string, appId?: string | null): Promise<string[] | null> {
        if (!this.enabled) return null;
        if (!organizationId) {
            throw new Error('organizationId is required for tenant-scoped caching');
        }

        const version = await this.getOrgCacheVersion(organizationId);
        const cacheKey = await this.buildCacheKey('perms', userId, organizationId, appId, version);

        // Check request cache first
        const requestCached = this.requestCache.get<string[]>(cacheKey);
        if (requestCached) return requestCached;

        // Check KV cache
        if (this.kv) {
            try {
                const result = await this.kv.getJSON<string[]>(cacheKey);
                if (result.success && result.data) {
                    const permissions = result.data;
                    this.requestCache.set(cacheKey, permissions, 60);
                    return permissions;
                }
            } catch (error) {
                logger.error(
                    'Failed to get permissions from KV',
                    error instanceof Error ? error : new Error(String(error)),
                );
            }
        }

        return null;
    }

    /**
     * Set user permissions in cache
     * @param userId User ID
     * @param permissions User permissions
     * @param organizationId Organization ID (REQUIRED for security)
     * @param appId Optional app ID
     */
    async setUserPermissions(
        userId: string,
        permissions: string[],
        organizationId: string,
        appId?: string | null,
    ): Promise<void> {
        if (!this.enabled) return;
        if (!organizationId) {
            throw new Error('organizationId is required for tenant-scoped caching');
        }

        const version = await this.getOrgCacheVersion(organizationId);
        const cacheKey = await this.buildCacheKey('perms', userId, organizationId, appId, version);

        // Always set in request cache
        this.requestCache.set(cacheKey, permissions, 60);

        // Set in KV if available
        if (this.kv) {
            try {
                const result = await this.kv.putJSON(cacheKey, permissions, {
                    expirationTtl: this.ttl,
                });
                if (!result.success) {
                    logger.error(
                        'Failed to set permissions in KV',
                        result.error instanceof Error ? result.error : new Error(String(result.error)),
                    );
                }
            } catch (error) {
                logger.error(
                    'Failed to set permissions in KV',
                    error instanceof Error ? error : new Error(String(error)),
                );
            }
        }
    }

    /**
     * Invalidate all cache for a specific user in an organization
     * @param userId User ID
     * @param organizationId Organization ID (REQUIRED)
     * @param appId Optional app ID (if specified, only invalidate for that app)
     */
    async invalidateUser(userId: string, organizationId: string, appId?: string | null): Promise<void> {
        if (!organizationId) {
            throw new Error('organizationId is required for tenant-scoped cache invalidation');
        }

        // Clear request cache for this user
        const pattern = appId
            ? new RegExp(
                  `${escapeRegex(this.prefix)}org:${escapeRegex(organizationId)}:.*:app:${escapeRegex(appId)}:usr:${escapeRegex(userId)}:`,
              )
            : new RegExp(
                  `${escapeRegex(this.prefix)}org:${escapeRegex(organizationId)}:.*:usr:${escapeRegex(userId)}:`,
              );

        this.requestCache.deletePattern(pattern);

        // Note: We don't delete from KV - entries expire naturally
        // This avoids costly KV.delete() operations
    }

    /**
     * Invalidate role cache for an entire organization (O(1) operation!)
     * Increments the organization's cache version, instantly invalidating all cached data
     *
     * @param organizationId Organization ID (REQUIRED)
     * @param roleName Optional role name for logging
     */
    async invalidateOrganization(organizationId: string, roleName?: string): Promise<void> {
        if (!organizationId) {
            throw new Error('organizationId is required for organization cache invalidation');
        }

        // Increment cache version for THIS organization only (O(1)!)
        const newVersion = await this.incrementOrgCacheVersion(organizationId);

        // Clear request cache for this organization
        const pattern = new RegExp(`${escapeRegex(this.prefix)}org:${escapeRegex(organizationId)}:`);
        this.requestCache.deletePattern(pattern);

        const roleInfo = roleName ? ` (role: ${roleName})` : '';
        logger.info('Cache invalidated for organization', { organizationId, roleName, newVersion });
    }

    /**
     * Clear all caches (useful for testing or emergency)
     * WARNING: This is an O(n) operation across ALL organizations
     */
    async clear(): Promise<void> {
        this.requestCache.clear();

        if (this.kv) {
            try {
                // List and delete all entries with our prefix
                const listResult = await this.kv.list({ prefix: this.prefix });
                if (listResult.success && listResult.data.keys.length > 0) {
                    const deletePromises = listResult.data.keys.map((key) => this.kv!.delete(key.name));
                    await Promise.all(deletePromises);
                }
            } catch (error) {
                logger.error(
                    'Failed to clear RBAC cache in KV',
                    error instanceof Error ? error : new Error(String(error)),
                );
            }
        }
    }

    /**
     * Get current cache statistics for an organization (for monitoring)
     */
    async getOrgStats(organizationId: string): Promise<{
        organizationId: string;
        version: string;
        requestCacheSize: number;
        enabled: boolean;
        kvAvailable: boolean;
    }> {
        return {
            organizationId,
            version: await this.getOrgCacheVersion(organizationId),
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
