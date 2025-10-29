/**
 * Cache layer with TTL and refresh strategies
 */

import type {
  ICache,
  IKVStore,
  CacheOptions,
  CacheEntry,
} from '../types';

/**
 * Cache configuration options
 */
export interface CacheConfig {
  /** Default TTL in seconds */
  defaultTtl?: number;
  /** Enable stale-while-revalidate */
  staleWhileRevalidate?: boolean;
  /** Stale time in seconds (for SWR) */
  staleTime?: number;
  /** Key prefix for namespacing */
  keyPrefix?: string;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * KV-based cache implementation
 */
export class KVCache<T = unknown> implements ICache<T> {
  private readonly defaultTtl: number;
  private readonly staleWhileRevalidate: boolean;
  private readonly staleTime: number;
  private readonly keyPrefix: string;
  private readonly debug: boolean;

  constructor(
    private readonly kv: IKVStore,
    config: CacheConfig = {}
  ) {
    this.defaultTtl = config.defaultTtl || 3600; // 1 hour default
    this.staleWhileRevalidate = config.staleWhileRevalidate || false;
    this.staleTime = config.staleTime || 60; // 1 minute default
    this.keyPrefix = config.keyPrefix || 'cache:';
    this.debug = config.debug || false;
  }

  /**
   * Get prefixed key
   */
  private getPrefixedKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * Log debug message
   */
  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log('[KVCache]', ...args);
    }
  }

  /**
   * Get a value from cache
   */
  async get(key: string): Promise<T | null> {
    const entry = await this.getWithMetadata(key);
    return entry?.value || null;
  }

  /**
   * Get a value with metadata
   */
  async getWithMetadata(key: string): Promise<CacheEntry<T> | null> {
    try {
      const prefixedKey = this.getPrefixedKey(key);
      const result = await this.kv.get<string>(prefixedKey, { type: 'text' });

      if (!result) {
        this.log('Cache miss:', key);
        return null;
      }

      const entry = JSON.parse(result) as CacheEntry<T>;
      const now = Date.now();

      // Check if expired
      if (entry.expiresAt && entry.expiresAt < now) {
        this.log('Cache expired:', key);
        await this.delete(key);
        return null;
      }

      this.log('Cache hit:', key);
      return entry;
    } catch (error) {
      console.error('Error getting from cache:', error);
      return null;
    }
  }

  /**
   * Put a value in cache
   */
  async put(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const ttl = options?.ttl || this.defaultTtl;
      const now = Date.now();
      const expiresAt = ttl > 0 ? now + ttl * 1000 : undefined;

      const entry: CacheEntry<T> = {
        value,
        cachedAt: now,
        expiresAt,
        metadata: options?.metadata,
      };

      const prefixedKey = this.getPrefixedKey(key);
      await this.kv.put(prefixedKey, JSON.stringify(entry), {
        expirationTtl: ttl,
        metadata: options?.metadata,
      });

      this.log('Cache put:', key, 'TTL:', ttl);
    } catch (error) {
      console.error('Error putting to cache:', error);
      throw error;
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<void> {
    try {
      const prefixedKey = this.getPrefixedKey(key);
      await this.kv.delete(prefixedKey);
      this.log('Cache delete:', key);
    } catch (error) {
      console.error('Error deleting from cache:', error);
      throw error;
    }
  }

  /**
   * Check if a key exists
   */
  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  /**
   * Refresh TTL for a cached value
   */
  async refresh(key: string, ttl?: number): Promise<boolean> {
    try {
      const entry = await this.getWithMetadata(key);
      if (!entry) {
        return false;
      }

      await this.put(key, entry.value, {
        ttl: ttl || this.defaultTtl,
        metadata: entry.metadata,
      });

      this.log('Cache refresh:', key);
      return true;
    } catch (error) {
      console.error('Error refreshing cache:', error);
      return false;
    }
  }

  /**
   * Get or set a value in cache with a factory function
   */
  async getOrSet(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.put(key, value, options);
    return value;
  }

  /**
   * Get with stale-while-revalidate pattern
   */
  async getWithSWR(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    const entry = await this.getWithMetadata(key);

    if (!entry) {
      // Cache miss - fetch and cache
      const value = await factory();
      await this.put(key, value, options);
      return value;
    }

    const now = Date.now();
    const isStale = entry.cachedAt + this.staleTime * 1000 < now;

    if (isStale && this.staleWhileRevalidate) {
      // Return stale value and revalidate in background
      this.log('Returning stale value and revalidating:', key);

      // Revalidate in background (don't await)
      factory()
        .then((value) => this.put(key, value, options))
        .catch((error) => console.error('Error revalidating cache:', error));

      return entry.value;
    }

    return entry.value;
  }
}

/**
 * Memory cache implementation (for edge runtime)
 */
export class MemoryCache<T = unknown> implements ICache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly defaultTtl: number;
  private readonly keyPrefix: string;
  private readonly debug: boolean;

  constructor(config: CacheConfig = {}) {
    this.defaultTtl = config.defaultTtl || 3600;
    this.keyPrefix = config.keyPrefix || 'mem:';
    this.debug = config.debug || false;
  }

  /**
   * Get prefixed key
   */
  private getPrefixedKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * Log debug message
   */
  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log('[MemoryCache]', ...args);
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get a value from cache
   */
  async get(key: string): Promise<T | null> {
    const entry = await this.getWithMetadata(key);
    return entry?.value || null;
  }

  /**
   * Get a value with metadata
   */
  async getWithMetadata(key: string): Promise<CacheEntry<T> | null> {
    const prefixedKey = this.getPrefixedKey(key);
    const entry = this.cache.get(prefixedKey);

    if (!entry) {
      this.log('Cache miss:', key);
      return null;
    }

    const now = Date.now();
    if (entry.expiresAt && entry.expiresAt < now) {
      this.log('Cache expired:', key);
      this.cache.delete(prefixedKey);
      return null;
    }

    this.log('Cache hit:', key);
    return entry;
  }

  /**
   * Put a value in cache
   */
  async put(key: string, value: T, options?: CacheOptions): Promise<void> {
    const ttl = options?.ttl || this.defaultTtl;
    const now = Date.now();
    const expiresAt = ttl > 0 ? now + ttl * 1000 : undefined;

    const entry: CacheEntry<T> = {
      value,
      cachedAt: now,
      expiresAt,
      metadata: options?.metadata,
    };

    const prefixedKey = this.getPrefixedKey(key);
    this.cache.set(prefixedKey, entry);
    this.log('Cache put:', key, 'TTL:', ttl);

    // Periodic cleanup
    if (Math.random() < 0.1) {
      this.cleanup();
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<void> {
    const prefixedKey = this.getPrefixedKey(key);
    this.cache.delete(prefixedKey);
    this.log('Cache delete:', key);
  }

  /**
   * Check if a key exists
   */
  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  /**
   * Refresh TTL for a cached value
   */
  async refresh(key: string, ttl?: number): Promise<boolean> {
    const entry = await this.getWithMetadata(key);
    if (!entry) {
      return false;
    }

    await this.put(key, entry.value, {
      ttl: ttl || this.defaultTtl,
      metadata: entry.metadata,
    });

    this.log('Cache refresh:', key);
    return true;
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.log('Cache cleared');
  }
}

/**
 * Multi-level cache implementation (Memory + KV)
 */
export class MultiLevelCache<T = unknown> implements ICache<T> {
  private l1Cache: MemoryCache<T>;
  private l2Cache: KVCache<T>;

  constructor(
    kv: IKVStore,
    config: CacheConfig = {}
  ) {
    this.l1Cache = new MemoryCache<T>({
      ...config,
      keyPrefix: 'l1:',
    });
    this.l2Cache = new KVCache<T>(kv, {
      ...config,
      keyPrefix: 'l2:',
    });
  }

  /**
   * Get a value from cache (L1 first, then L2)
   */
  async get(key: string): Promise<T | null> {
    // Try L1 first
    let value = await this.l1Cache.get(key);
    if (value !== null) {
      return value;
    }

    // Try L2
    value = await this.l2Cache.get(key);
    if (value !== null) {
      // Populate L1
      await this.l1Cache.put(key, value);
      return value;
    }

    return null;
  }

  /**
   * Get a value with metadata
   */
  async getWithMetadata(key: string): Promise<CacheEntry<T> | null> {
    // Try L1 first
    let entry = await this.l1Cache.getWithMetadata(key);
    if (entry) {
      return entry;
    }

    // Try L2
    entry = await this.l2Cache.getWithMetadata(key);
    if (entry) {
      // Populate L1
      await this.l1Cache.put(key, entry.value, {
        metadata: entry.metadata,
      });
      return entry;
    }

    return null;
  }

  /**
   * Put a value in cache (both L1 and L2)
   */
  async put(key: string, value: T, options?: CacheOptions): Promise<void> {
    await Promise.all([
      this.l1Cache.put(key, value, options),
      this.l2Cache.put(key, value, options),
    ]);
  }

  /**
   * Delete a value from cache (both L1 and L2)
   */
  async delete(key: string): Promise<void> {
    await Promise.all([
      this.l1Cache.delete(key),
      this.l2Cache.delete(key),
    ]);
  }

  /**
   * Check if a key exists
   */
  async has(key: string): Promise<boolean> {
    const l1Has = await this.l1Cache.has(key);
    if (l1Has) return true;
    return await this.l2Cache.has(key);
  }

  /**
   * Refresh TTL for a cached value
   */
  async refresh(key: string, ttl?: number): Promise<boolean> {
    const results = await Promise.all([
      this.l1Cache.refresh(key, ttl),
      this.l2Cache.refresh(key, ttl),
    ]);
    return results.some((r) => r);
  }

  /**
   * Clear L1 cache
   */
  async clear(): Promise<void> {
    await this.l1Cache.clear();
  }
}

/**
 * Create a KV cache
 */
export function createKVCache<T = unknown>(
  kv: IKVStore,
  config?: CacheConfig
): ICache<T> {
  return new KVCache<T>(kv, config);
}

/**
 * Create a memory cache
 */
export function createMemoryCache<T = unknown>(
  config?: CacheConfig
): ICache<T> {
  return new MemoryCache<T>(config);
}

/**
 * Create a multi-level cache
 */
export function createMultiLevelCache<T = unknown>(
  kv: IKVStore,
  config?: CacheConfig
): ICache<T> {
  return new MultiLevelCache<T>(kv, config);
}

/**
 * Export types
 */
export type { ICache, CacheOptions, CacheEntry } from '../types';
