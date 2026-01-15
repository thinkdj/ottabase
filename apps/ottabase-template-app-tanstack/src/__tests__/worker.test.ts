import { beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../../cloudflare-worker';

// Helper to create a mock request
function createRequest(path: string, method = 'GET', body?: any) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('Cloudflare Worker API', () => {
  let env: any;
  const toRawRows = (rows: any[]) => rows.map((row) => Object.values(row));
  const createStatement = (rawResult: any[]) => ({
    bind: vi.fn().mockReturnThis(),
    raw: vi.fn().mockResolvedValue(toRawRows(rawResult)),
    all: vi.fn().mockResolvedValue({ results: rawResult, success: true }),
    first: vi.fn().mockResolvedValue(rawResult[0] ?? null),
    run: vi.fn().mockResolvedValue({
      success: true,
      meta: { changes: rawResult.length },
    }),
  });

  beforeEach(() => {
    env = {
      OBCF_D1: (global as any).OBCF_D1,
      OBCF_KV: (global as any).OBCF_KV,
      OBCF_R2: (global as any).OBCF_R2,
      OBCF_QUEUE: (global as any).OBCF_QUEUE,
      ENVIRONMENT: "test",
    };
    vi.clearAllMocks();

    // Default mock setup for D1
    env.OBCF_D1.prepare.mockImplementation(() => createStatement([]));
  });

  describe("/api/health", () => {
    it("should return health check", async () => {
      const resp = await worker.fetch(createRequest("/api/health"), env);
      const data = (await resp.json()) as any;
      expect(resp.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.name).toBe("ottabase-template-app-tanstack");
    });
  });

  describe("/api/ottaorm/shortlinks", () => {
    it("should list shortlinks", async () => {
      // Mock D1 response for listing
      env.OBCF_D1.prepare.mockImplementation(() => createStatement([]));

      const resp = await worker.fetch(
        createRequest("/api/ottaorm/shortlinks"),
        env,
      );
      expect(resp.status).toBe(200);
      const data = (await resp.json()) as any;
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
      // Check handleCrud implementation, it returns `jsonResponse(result.data, result.status)`
      // If Model.currentDriver.list returns array, then it is array.
    });

    it("should create a shortlink", async () => {
      const payload = {
        fullUrl: "https://google.com",
        shortCode: "goog",
        appName: "test",
      };

      // Mock findByCode (return null = not found)
      // Then mock create (return success)
      // Since handleCrud uses the model, and we know Shortlink calls D1.

      // We need to carefully mock the D1 calls sequence or use a more sophisticated mock that retains state in memory?
      // For now simple mock:
      // 1. check unique (select ... where shortCode = ?) -> returns []
      // 2. insert -> returns success

      const now = Math.floor(Date.now() / 1000);
      const createdRow = {
        id: "1",
        fullUrl: payload.fullUrl,
        shortCode: payload.shortCode,
        type: "redirect",
        appName: payload.appName,
        expiryDate: null,
        clicks: 0,
        lastClickedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      env.OBCF_D1.prepare.mockImplementation((sql: string) =>
        /insert/i.test(sql)
          ? createStatement([createdRow])
          : createStatement([]),
      );

      const resp = await worker.fetch(
        createRequest("/api/ottaorm/shortlinks", "POST", payload),
        env,
      );

      // Note: The generic handleCrud might fail if mocks aren't perfect, but let's see.
      expect(resp.status).toBe(201);
      const data = (await resp.json()) as any;
      expect(data.shortlink?.shortCode).toBe("goog");
    });
  });

  describe("Legacy /api/shortlinks", () => {
    it("should list shortlinks (paginated)", async () => {
      // Legacy endpoint returns paginated response structure
      env.OBCF_D1.prepare.mockImplementation(() => createStatement([]));

      const resp = await worker.fetch(createRequest("/api/shortlinks"), env);
      expect(resp.status).toBe(200);
      const data = (await resp.json()) as any;
      expect(data.data).toBeDefined();
      expect(data.pagination?.total).toBeDefined();
    });
  });

  describe('/api/demo', () => {
      it('should handle GET', async () => {
          const resp = await worker.fetch(createRequest('/api/demo'), env);
          const data = await resp.json() as any;
          expect(data.message).toBe('Hello from GET');
      });

      it('should handle POST', async () => {
          const resp = await worker.fetch(createRequest('/api/demo', 'POST', { name: 'Test' }), env);
          const data = await resp.json() as any;
          expect(data.message).toBe('Hello, Test!');
      });
  });
});
