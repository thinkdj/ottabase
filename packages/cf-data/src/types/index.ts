/**
 * Core type definitions for Cloudflare data layer
 */

/**
 * Cache operation options
 */
export interface CacheOptions {
  /** Time-to-live in seconds */
  ttl?: number;
  /** Namespace for cache keys */
  namespace?: string;
  /** Metadata to store with the cached value */
  metadata?: Record<string, unknown>;
}

/**
 * Cache entry with metadata
 */
export interface CacheEntry<T = unknown> {
  /** The cached value */
  value: T;
  /** When the entry was cached (timestamp) */
  cachedAt: number;
  /** When the entry expires (timestamp) */
  expiresAt?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * KV namespace options for get operations
 */
export interface KVGetOptions {
  /** Cache TTL for this specific operation */
  cacheTtl?: number;
  /** The type of value to return */
  type?: 'text' | 'json' | 'arrayBuffer' | 'stream';
}

/**
 * KV namespace options for put operations
 */
export interface KVPutOptions {
  /** Expiration time in seconds from now */
  expirationTtl?: number;
  /** Absolute expiration time (Unix timestamp) */
  expiration?: number;
  /** Metadata to store with the value */
  metadata?: Record<string, unknown>;
}

/**
 * KV namespace options for list operations
 */
export interface KVListOptions {
  /** Key prefix to filter by */
  prefix?: string;
  /** Maximum number of keys to return */
  limit?: number;
  /** Cursor for pagination */
  cursor?: string;
}

/**
 * KV list result
 */
export interface KVListResult {
  /** List of keys */
  keys: Array<{
    name: string;
    expiration?: number;
    metadata?: Record<string, unknown>;
  }>;
  /** Indicates if there are more keys */
  list_complete: boolean;
  /** Cursor for next page */
  cursor?: string;
}

/**
 * D1 query result
 */
export interface D1Result<T = unknown> {
  /** Query results */
  results: T[];
  /** Whether query was successful */
  success: boolean;
  /** Query metadata */
  meta?: {
    duration?: number;
    rows_read?: number;
    rows_written?: number;
  };
  /** Error if query failed */
  error?: string;
}

/**
 * D1 prepared statement parameters
 */
export type D1Params = (string | number | boolean | null | ArrayBuffer)[];

/**
 * Generic cache interface
 */
export interface ICache<T = unknown> {
  /**
   * Get a value from cache
   */
  get(key: string): Promise<T | null>;

  /**
   * Get a value with metadata
   */
  getWithMetadata(key: string): Promise<CacheEntry<T> | null>;

  /**
   * Put a value in cache
   */
  put(key: string, value: T, options?: CacheOptions): Promise<void>;

  /**
   * Delete a value from cache
   */
  delete(key: string): Promise<void>;

  /**
   * Check if a key exists
   */
  has(key: string): Promise<boolean>;

  /**
   * Refresh TTL for a cached value
   */
  refresh(key: string, ttl?: number): Promise<boolean>;

  /**
   * Clear all cache entries (if supported)
   */
  clear?(): Promise<void>;
}

/**
 * KV store interface
 */
export interface IKVStore {
  /**
   * Get a value from KV
   */
  get<T = string>(key: string, options?: KVGetOptions): Promise<T | null>;

  /**
   * Get a value with metadata
   */
  getWithMetadata<T = string>(
    key: string,
    options?: KVGetOptions
  ): Promise<{ value: T | null; metadata: Record<string, unknown> | null }>;

  /**
   * Put a value in KV
   */
  put(
    key: string,
    value: string | ArrayBuffer | ReadableStream,
    options?: KVPutOptions
  ): Promise<void>;

  /**
   * Delete a value from KV
   */
  delete(key: string): Promise<void>;

  /**
   * List keys in KV
   */
  list(options?: KVListOptions): Promise<KVListResult>;
}

/**
 * D1 database interface
 */
export interface ID1Database {
  /**
   * Execute a raw SQL query
   */
  query<T = unknown>(sql: string, params?: D1Params): Promise<D1Result<T>>;

  /**
   * Execute a prepared statement
   */
  prepare<T = unknown>(sql: string): ID1PreparedStatement<T>;

  /**
   * Execute multiple statements in a batch
   */
  batch<T = unknown>(
    statements: ID1PreparedStatement<unknown>[]
  ): Promise<D1Result<T>[]>;

  /**
   * Execute statements in a transaction
   */
  transaction<T>(
    callback: (tx: ID1Database) => Promise<T>
  ): Promise<T>;

  /**
   * Execute a query and return the first result
   */
  queryFirst?<T = unknown>(sql: string, params?: D1Params): Promise<T | null>;

  /**
   * Execute a non-query statement (INSERT, UPDATE, DELETE)
   */
  execute?(sql: string, params?: D1Params): Promise<D1Result<never>>;
}

/**
 * D1 prepared statement interface
 */
export interface ID1PreparedStatement<T = unknown> {
  /**
   * Bind parameters to the statement
   */
  bind(...params: D1Params): ID1PreparedStatement<T>;

  /**
   * Execute and return first result
   */
  first<R = T>(column?: string): Promise<R | null>;

  /**
   * Execute and return all results
   */
  all<R = T>(): Promise<D1Result<R>>;

  /**
   * Execute without returning results
   */
  run(): Promise<D1Result<never>>;
}

/**
 * Data layer configuration
 */
export interface DataLayerConfig {
  /** KV namespace binding */
  kv?: KVNamespace;
  /** D1 database binding */
  d1?: D1Database;
  /** Default cache TTL in seconds */
  defaultCacheTtl?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Re-export Cloudflare Worker types
 */
export type { KVNamespace, D1Database } from '@cloudflare/workers-types';
