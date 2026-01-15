import { createD1Driver } from "@ottabase/db/drizzle-d1";
import { clearAllConnections, registerConnection } from "@ottabase/ottaorm";
import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

vi.mock("@ottabase/cf-realtime/server", () => ({
  RealtimeActor: class RealtimeActor {},
  RealtimeBroadcaster: class RealtimeBroadcaster {},
}));

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Cloudflare Bindings
beforeAll(() => {
  // Mock environment variables
  process.env.ENVIRONMENT = "test";
  process.env.NODE_ENV = "test";

  // Mock global fetch for tests
  global.fetch = vi.fn();

  // Mock Cloudflare bindings in global scope
  (global as any).OBCF_D1 = {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      raw: vi.fn().mockResolvedValue([]),
      all: vi.fn().mockResolvedValue({ results: [], success: true }),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
    }),
    batch: vi.fn().mockResolvedValue([]),
    exec: vi.fn().mockResolvedValue({}),
  };

  (global as any).OBCF_KV = {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
  };

  (global as any).OBCF_R2 = {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
  };

  (global as any).OBCF_QUEUE = {
    send: vi.fn(),
    sendBatch: vi.fn(),
  };

  (global as any).OBCF_RATE_LIMITER = {
    limit: vi.fn().mockResolvedValue({ success: true }),
  };

  (global as any).OBCF_REALTIME = {
    get: vi.fn(),
  };

  (global as any).OBCF_ASSETS = {
    fetch: vi.fn(),
  };

  clearAllConnections();
  registerConnection("default", createD1Driver((global as any).OBCF_D1));
});

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;

afterAll(() => {
  vi.clearAllMocks();
});
