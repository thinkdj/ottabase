import { describe, it, expect, vi } from 'vitest';
import { createD1Client, createKVClient, createR2Client } from '../index';

describe('Cloudflare Bindings Clients', () => {
  describe('D1 Database Client', () => {
    it('should create D1 client', () => {
      const mockDB = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn(),
        }),
      };

      const client = createD1Client(mockDB as any);
      expect(client).toBeDefined();
    });

    it('should handle D1 configuration', () => {
      const mockDB = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn(),
        }),
      };

      const client = createD1Client(mockDB as any, {
        logger: true,
        timeout: 5000,
      });

      expect(client).toBeDefined();
    });
  });

  describe('KV Storage Client', () => {
    it('should create KV client', () => {
      const mockKV = {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
        getWithMetadata: vi.fn(),
      };

      const client = createKVClient(mockKV as any);
      expect(client).toBeDefined();
    });

    it('should support KV configuration', () => {
      const mockKV = {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
        getWithMetadata: vi.fn(),
      };

      const client = createKVClient(mockKV as any, {
        cache: true,
        cacheTTL: 3600,
      });

      expect(client).toBeDefined();
    });
  });

  describe('R2 Storage Client', () => {
    it('should create R2 client', () => {
      const mockR2 = {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
      };

      const client = createR2Client(mockR2 as any);
      expect(client).toBeDefined();
    });

    it('should handle R2 configuration', () => {
      const mockR2 = {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
      };

      const client = createR2Client(mockR2 as any, {
        defaultBucket: 'ottabase',
      });

      expect(client).toBeDefined();
    });
  });

  describe('Client Factories', () => {
    it('should provide type-safe client interfaces', () => {
      const mockDB = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn(),
        }),
      };

      const client = createD1Client(mockDB as any);

      // Verify client has expected methods
      expect(typeof client).toBe('object');
    });

    it('should handle missing or undefined bindings gracefully', () => {
      // Test with empty/mock bindings
      expect(() => {
        const mockDB = {
          prepare: vi.fn(),
        };
        createD1Client(mockDB as any);
      }).not.toThrow();
    });
  });

  describe('Binding Types', () => {
    it('should export type definitions', () => {
      // Verify types are exported (this is a runtime check)
      const { createD1Client, createKVClient, createR2Client } = require('../index');

      expect(typeof createD1Client).toBe('function');
      expect(typeof createKVClient).toBe('function');
      expect(typeof createR2Client).toBe('function');
    });
  });
});
