/**
 * KV (Key-Value) Storage wrapper
 * Type-safe wrapper for Cloudflare Workers KV
 *
 * @see https://developers.cloudflare.com/kv/
 */

import type { KVNamespace } from '@cloudflare/workers-types';
import { CloudflareError, type Result } from './types';

export interface KVConfig {
  namespace: KVNamespace;
}

export interface KVGetOptions {
  type?: 'text' | 'json' | 'arrayBuffer' | 'stream';
  cacheTtl?: number;
}

export interface KVPutOptions {
  expirationTtl?: number;
  expiration?: number;
  metadata?: Record<string, unknown>;
}

export interface KVListOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
}

/**
 * Type-safe KV storage wrapper
 */
export class KVClient {
  private kv: KVNamespace;

  constructor(config: KVConfig) {
    if (!config.namespace) {
      throw new CloudflareError(
        'KV namespace binding is required',
        'KV_MISSING_BINDING'
      );
    }
    this.kv = config.namespace;
  }

  /**
   * Get a value by key (defaults to JSON parsing)
   */
  async get<T = unknown>(
    key: string,
    options?: KVGetOptions
  ): Promise<Result<T | null, Error>> {
    try {
      const type = options?.type || 'json';
      let value: unknown;

      if (type === 'json') {
        value = await this.kv.get(key, { type: 'json', cacheTtl: options?.cacheTtl });
      } else if (type === 'text') {
        value = await this.kv.get(key, { type: 'text', cacheTtl: options?.cacheTtl });
      } else if (type === 'arrayBuffer') {
        value = await this.kv.get(key, { type: 'arrayBuffer', cacheTtl: options?.cacheTtl });
      } else {
        value = await this.kv.get(key, { type: 'stream', cacheTtl: options?.cacheTtl });
      }

      return {
        success: true,
        data: value as T | null,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get a value as text
   */
  async getText(key: string, cacheTtl?: number): Promise<Result<string | null, Error>> {
    return this.get<string>(key, { type: 'text', cacheTtl });
  }

  /**
   * Get a value as JSON
   */
  async getJSON<T = unknown>(key: string, cacheTtl?: number): Promise<Result<T | null, Error>> {
    return this.get<T>(key, { type: 'json', cacheTtl });
  }

  /**
   * Put a value with optional expiration
   */
  async put(
    key: string,
    value: string | ArrayBuffer | ReadableStream,
    options?: KVPutOptions
  ): Promise<Result<void, Error>> {
    try {
      await this.kv.put(key, value as any, options);

      return {
        success: true,
        data: undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Put a JSON value
   */
  async putJSON<T = unknown>(
    key: string,
    value: T,
    options?: KVPutOptions
  ): Promise<Result<void, Error>> {
    try {
      await this.kv.put(key, JSON.stringify(value), options);

      return {
        success: true,
        data: undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Delete a key
   */
  async delete(key: string): Promise<Result<void, Error>> {
    try {
      await this.kv.delete(key);

      return {
        success: true,
        data: undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * List keys with optional filtering
   */
  async list(options?: KVListOptions): Promise<Result<{ keys: Array<{ name: string; metadata?: unknown }>; list_complete: boolean; cursor?: string }, Error>> {
    try {
      const result = await this.kv.list(options);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get metadata for a key without fetching the value
   */
  async getWithMetadata<T = unknown, M = unknown>(
    key: string,
    options?: KVGetOptions
  ): Promise<Result<{ value: T | null; metadata: M | null }, Error>> {
    try {
      const type = options?.type || 'json';
      const result = await this.kv.getWithMetadata(key, { type: type as any, cacheTtl: options?.cacheTtl });

      return {
        success: true,
        data: {
          value: result.value as T | null,
          metadata: result.metadata as M | null,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get raw KVNamespace instance for advanced usage
   */
  getRaw(): KVNamespace {
    return this.kv;
  }
}

/**
 * Create a KV client instance
 */
export function createKVClient(config: KVConfig): KVClient {
  return new KVClient(config);
}
