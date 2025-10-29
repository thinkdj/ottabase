/**
 * Cloudflare KV adapter
 */

import type {
  IKVStore,
  KVGetOptions,
  KVPutOptions,
  KVListOptions,
  KVListResult,
  KVNamespace,
} from '../types';

/**
 * KV Store adapter for Cloudflare KV
 */
export class KVStoreAdapter implements IKVStore {
  constructor(private readonly namespace: KVNamespace) {
    if (!namespace) {
      throw new Error('KV namespace is required');
    }
  }

  /**
   * Get a value from KV
   */
  async get<T = string>(
    key: string,
    options?: KVGetOptions
  ): Promise<T | null> {
    try {
      const type = options?.type || 'text';

      switch (type) {
        case 'json':
          return await this.namespace.get(key, {
            type: 'json',
            cacheTtl: options?.cacheTtl,
          }) as T | null;
        case 'arrayBuffer':
          return await this.namespace.get(key, {
            type: 'arrayBuffer',
            cacheTtl: options?.cacheTtl,
          }) as T | null;
        case 'stream':
          return await this.namespace.get(key, {
            type: 'stream',
            cacheTtl: options?.cacheTtl,
          }) as T | null;
        case 'text':
        default:
          return await this.namespace.get(key, {
            type: 'text',
            cacheTtl: options?.cacheTtl,
          }) as T | null;
      }
    } catch (error) {
      console.error(`Error getting key "${key}" from KV:`, error);
      return null;
    }
  }

  /**
   * Get a value with metadata
   */
  async getWithMetadata<T = string>(
    key: string,
    options?: KVGetOptions
  ): Promise<{ value: T | null; metadata: Record<string, unknown> | null }> {
    try {
      const type = options?.type || 'text';

      let result: { value: unknown; metadata: unknown };

      switch (type) {
        case 'json':
          result = await this.namespace.getWithMetadata(key, 'json');
          break;
        case 'arrayBuffer':
          result = await this.namespace.getWithMetadata(key, 'arrayBuffer');
          break;
        case 'stream':
          result = await this.namespace.getWithMetadata(key, 'stream');
          break;
        case 'text':
        default:
          result = await this.namespace.getWithMetadata(key, 'text');
          break;
      }

      return {
        value: result.value as T | null,
        metadata: result.metadata as Record<string, unknown> | null,
      };
    } catch (error) {
      console.error(`Error getting key "${key}" with metadata from KV:`, error);
      return { value: null, metadata: null };
    }
  }

  /**
   * Put a value in KV
   */
  async put(
    key: string,
    value: string | ArrayBuffer | ReadableStream,
    options?: KVPutOptions
  ): Promise<void> {
    try {
      await this.namespace.put(key, value, {
        expirationTtl: options?.expirationTtl,
        expiration: options?.expiration,
        metadata: options?.metadata,
      });
    } catch (error) {
      console.error(`Error putting key "${key}" to KV:`, error);
      throw error;
    }
  }

  /**
   * Delete a value from KV
   */
  async delete(key: string): Promise<void> {
    try {
      await this.namespace.delete(key);
    } catch (error) {
      console.error(`Error deleting key "${key}" from KV:`, error);
      throw error;
    }
  }

  /**
   * List keys in KV
   */
  async list(options?: KVListOptions): Promise<KVListResult> {
    try {
      const result = await this.namespace.list({
        prefix: options?.prefix,
        limit: options?.limit,
        cursor: options?.cursor,
      });

      return {
        keys: result.keys.map((key) => ({
          name: key.name,
          expiration: key.expiration,
          metadata: key.metadata as Record<string, unknown> | undefined,
        })),
        list_complete: result.list_complete,
        cursor: 'cursor' in result ? result.cursor : undefined,
      };
    } catch (error) {
      console.error('Error listing keys from KV:', error);
      throw error;
    }
  }

  /**
   * Get multiple keys at once
   */
  async getMultiple<T = string>(
    keys: string[],
    options?: KVGetOptions
  ): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();

    await Promise.all(
      keys.map(async (key) => {
        const value = await this.get<T>(key, options);
        results.set(key, value);
      })
    );

    return results;
  }

  /**
   * Put multiple key-value pairs at once
   */
  async putMultiple(
    entries: Array<{
      key: string;
      value: string | ArrayBuffer | ReadableStream;
      options?: KVPutOptions;
    }>
  ): Promise<void> {
    await Promise.all(
      entries.map((entry) =>
        this.put(entry.key, entry.value, entry.options)
      )
    );
  }

  /**
   * Delete multiple keys at once
   */
  async deleteMultiple(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.delete(key)));
  }
}

/**
 * Create a KV store adapter
 */
export function createKVStore(namespace: KVNamespace): IKVStore {
  return new KVStoreAdapter(namespace);
}

/**
 * Export types
 */
export type {
  IKVStore,
  KVGetOptions,
  KVPutOptions,
  KVListOptions,
  KVListResult,
} from '../types';
