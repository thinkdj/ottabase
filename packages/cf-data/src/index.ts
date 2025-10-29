/**
 * @ottabase/cf-data
 *
 * Production-ready Cloudflare KV and D1 data layer with caching support
 */

// Export KV functionality
export {
  KVStoreAdapter,
  createKVStore,
} from './kv';

// Export D1 functionality
export {
  D1DatabaseAdapter,
  createD1Database,
  PrismaD1Adapter,
  createPrismaD1Adapter,
} from './d1';

// Export cache functionality
export {
  KVCache,
  MemoryCache,
  MultiLevelCache,
  createKVCache,
  createMemoryCache,
  createMultiLevelCache,
} from './cache';

// Export all types
export type {
  // Core types
  CacheOptions,
  CacheEntry,
  KVGetOptions,
  KVPutOptions,
  KVListOptions,
  KVListResult,
  D1Result,
  D1Params,
  DataLayerConfig,
  // Interfaces
  ICache,
  IKVStore,
  ID1Database,
  ID1PreparedStatement,
  // Cloudflare types
  KVNamespace,
  D1Database,
} from './types';

// Export cache config
export type { CacheConfig } from './cache';

/**
 * Create a complete data layer instance
 */
import type { KVNamespace, D1Database } from '@cloudflare/workers-types';
import type { DataLayerConfig, ICache, IKVStore, ID1Database } from './types';
import { createKVStore } from './kv';
import { createD1Database } from './d1';
import { createMultiLevelCache } from './cache';

export interface DataLayer {
  kv?: IKVStore;
  d1?: ID1Database;
  cache?: ICache;
}

/**
 * Create a data layer with KV, D1, and cache support
 */
export function createDataLayer(config: DataLayerConfig): DataLayer {
  const layer: DataLayer = {};

  if (config.kv) {
    layer.kv = createKVStore(config.kv);

    // Create cache if KV is available
    layer.cache = createMultiLevelCache(layer.kv, {
      defaultTtl: config.defaultCacheTtl,
      debug: config.debug,
    });
  }

  if (config.d1) {
    layer.d1 = createD1Database(config.d1);
  }

  return layer;
}
