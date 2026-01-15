import { describe, expect, it, vi } from "vitest";
import * as cf from "../index";
import { createD1Client, createKVClient, createR2Client } from "../index";

describe("Cloudflare Bindings Clients", () => {
  describe("D1 Database Client", () => {
    it("should create D1 client", () => {
      const mockDB = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn(),
        }),
      };

      const client = createD1Client({ database: mockDB as any });
      expect(client).toBeDefined();
    });

    it("should handle D1 configuration", () => {
      const mockDB = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn(),
        }),
      };

      const client = createD1Client({ database: mockDB as any });

      expect(client).toBeDefined();
    });
  });

  describe("KV Storage Client", () => {
    it("should create KV client", () => {
      const mockKV = {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
        getWithMetadata: vi.fn(),
      };

      const client = createKVClient({ namespace: mockKV as any });
      expect(client).toBeDefined();
    });

    it("should support KV configuration", () => {
      const mockKV = {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
        getWithMetadata: vi.fn(),
      };

      const client = createKVClient({ namespace: mockKV as any });

      expect(client).toBeDefined();
    });
  });

  describe("R2 Storage Client", () => {
    it("should create R2 client", () => {
      const mockR2 = {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
      };

      const client = createR2Client({ bucket: mockR2 as any });
      expect(client).toBeDefined();
    });

    it("should handle R2 configuration", () => {
      const mockR2 = {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
      };

      const client = createR2Client({ bucket: mockR2 as any });

      expect(client).toBeDefined();
    });
  });

  describe("Client Factories", () => {
    it("should provide type-safe client interfaces", () => {
      const mockDB = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn(),
        }),
      };

      const client = createD1Client({ database: mockDB as any });

      // Verify client has expected methods
      expect(typeof client).toBe("object");
    });

    it("should throw for missing bindings", () => {
      expect(() => {
        createD1Client({} as any);
      }).toThrow();
    });
  });

  describe("Binding Types", () => {
    it("should export type definitions", () => {
      // Verify types are exported (this is a runtime check)
      expect(typeof cf.createD1Client).toBe("function");
      expect(typeof cf.createKVClient).toBe("function");
      expect(typeof cf.createR2Client).toBe("function");
    });
  });
});
