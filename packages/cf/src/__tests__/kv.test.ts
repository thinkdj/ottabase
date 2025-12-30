import { describe, it, expect, beforeEach } from 'vitest';
import { KVClient, type KVConfig } from '../kv';
import { CloudflareError } from '../types';
import type { KVNamespace } from '@cloudflare/workers-types';

/**
 * Mock KV namespace for testing
 */
function createMockKVNamespace(): KVNamespace {
  const store = new Map<string, { value: unknown; metadata?: unknown }>();

  return {
    get: async (key: string, options?: any) => {
      const item = store.get(key);
      if (!item) return null;

      const type = options?.type || 'json';
      if (type === 'json') {
        // Parse JSON string if stored as string
        const value = item.value;
        return typeof value === 'string' ? JSON.parse(value) : value;
      }
      if (type === 'text') {
        return typeof item.value === 'string' ? item.value : JSON.stringify(item.value);
      }
      return item.value;
    },
    put: async (key: string, value: any, options?: any) => {
      store.set(key, {
        value: typeof value === 'string' ? value : value,
        metadata: options?.metadata,
      });
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    list: async (options?: any) => {
      const keys = Array.from(store.keys());
      const filtered = options?.prefix
        ? keys.filter((k) => k.startsWith(options.prefix))
        : keys;

      return {
        keys: filtered.slice(0, options?.limit || 1000).map((name) => ({
          name,
          metadata: store.get(name)?.metadata,
        })),
        list_complete: true,
        cursor: '',
      };
    },
    getWithMetadata: async (key: string, options?: any) => {
      const item = store.get(key);
      if (!item) return { value: null, metadata: null };

      const type = options?.type || 'json';
      let value = item.value;
      if (type === 'json') {
        // Parse JSON string if stored as string
        value = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
      } else if (type === 'text') {
        value = typeof item.value === 'string' ? item.value : JSON.stringify(item.value);
      }

      return {
        value,
        metadata: item.metadata || null,
      };
    },
  } as KVNamespace;
}

describe('KVClient', () => {
  let mockKV: KVNamespace;
  let kvClient: KVClient;

  beforeEach(() => {
    mockKV = createMockKVNamespace();
    kvClient = new KVClient({ namespace: mockKV });
  });

  describe('constructor', () => {
    it('should throw error when namespace is missing', () => {
      expect(() => new KVClient({ namespace: null as any })).toThrow(
        CloudflareError,
      );
      expect(() => new KVClient({ namespace: null as any })).toThrow(
        'KV namespace binding is required',
      );
    });

    it('should create instance with valid namespace', () => {
      const client = new KVClient({ namespace: mockKV });
      expect(client).toBeInstanceOf(KVClient);
    });
  });

  describe('get', () => {
    it('should get JSON value by key', async () => {
      const testData = { name: 'Test', value: 123 };
      await mockKV.put('test-key', JSON.stringify(testData));

      const result = await kvClient.get('test-key', { type: 'json' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(testData);
      }
    });

    it('should get text value by key', async () => {
      await mockKV.put('test-key', 'Hello World');

      const result = await kvClient.get('test-key', { type: 'text' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('Hello World');
      }
    });

    it('should return null for non-existent key', async () => {
      const result = await kvClient.get('non-existent');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeNull();
      }
    });

    it('should default to JSON type', async () => {
      const testData = { test: true };
      await mockKV.put('key', JSON.stringify(testData));

      const result = await kvClient.get('key');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(testData);
      }
    });
  });

  describe('getText', () => {
    it('should get text value', async () => {
      await mockKV.put('text-key', 'Plain text');

      const result = await kvClient.getText('text-key');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('Plain text');
      }
    });
  });

  describe('getJSON', () => {
    it('should get and parse JSON value', async () => {
      const data = { id: 1, name: 'Test' };
      await mockKV.put('json-key', JSON.stringify(data));

      const result = await kvClient.getJSON(data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(data);
      }
    });
  });

  describe('put', () => {
    it('should put string value', async () => {
      const result = await kvClient.put('key', 'value');

      expect(result.success).toBe(true);

      const stored = await mockKV.get('key', { type: 'text' });
      expect(stored).toBe('value');
    });

    it('should put value with expiration', async () => {
      const result = await kvClient.put('key', 'value', {
        expirationTtl: 3600,
      });

      expect(result.success).toBe(true);
    });

    it('should put value with metadata', async () => {
      const metadata = { type: 'test', version: 1 };
      const result = await kvClient.put('key', 'value', { metadata });

      expect(result.success).toBe(true);
    });
  });

  describe('putJSON', () => {
    it('should put JSON value', async () => {
      const data = { test: true, value: 123 };
      const result = await kvClient.putJSON('json-key', data);

      expect(result.success).toBe(true);

      const stored = await mockKV.get('json-key', { type: 'json' });
      expect(stored).toEqual(data);
    });
  });

  describe('delete', () => {
    it('should delete existing key', async () => {
      await mockKV.put('delete-me', 'value');

      const result = await kvClient.delete('delete-me');

      expect(result.success).toBe(true);

      const check = await mockKV.get('delete-me');
      expect(check).toBeNull();
    });

    it('should succeed even if key does not exist', async () => {
      const result = await kvClient.delete('non-existent');

      expect(result.success).toBe(true);
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await mockKV.put('user:1', 'User 1');
      await mockKV.put('user:2', 'User 2');
      await mockKV.put('post:1', 'Post 1');
    });

    it('should list all keys', async () => {
      const result = await kvClient.list();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.keys.length).toBeGreaterThanOrEqual(3);
      }
    });

    it('should list keys with prefix', async () => {
      const result = await kvClient.list({ prefix: 'user:' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.keys.length).toBe(2);
        expect(result.data.keys.every((k) => k.name.startsWith('user:'))).toBe(
          true,
        );
      }
    });

    it('should respect limit option', async () => {
      const result = await kvClient.list({ limit: 1 });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.keys.length).toBe(1);
      }
    });
  });

  describe('getWithMetadata', () => {
    it('should get value with metadata', async () => {
      const metadata = { author: 'test', version: 1 };
      await mockKV.put('meta-key', 'value', { metadata });

      const result = await kvClient.getWithMetadata('meta-key', { type: 'text' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.value).toBe('value');
        expect(result.data.metadata).toEqual(metadata);
      }
    });

    it('should return null metadata if not set', async () => {
      await mockKV.put('no-meta-key', 'value');

      const result = await kvClient.getWithMetadata('no-meta-key');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metadata).toBeNull();
      }
    });
  });
});
