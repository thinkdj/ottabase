# Cloudflare Testing Guide for Ottabase Monorepo

## Table of Contents

1. [Overview](#overview)
2. [Testing Architecture](#testing-architecture)
3. [How Cloudflare Testing Works](#how-cloudflare-testing-works)
4. [What Can Be Tested Locally](#what-can-be-tested-locally)
5. [Testing Items Without Local Emulation](#testing-items-without-local-emulation)
6. [Implementation Details](#implementation-details)
7. [Running Tests](#running-tests)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The ottabase monorepo uses **Vitest** with **@cloudflare/vitest-pool-workers** to test Cloudflare Workers, Durable Objects, and other Cloudflare bindings. This setup provides local testing capabilities through Miniflare, Cloudflare's local development environment.

### What Changed

**Dependencies Added:**
```json
{
  "vitest": "^2.1.8",
  "@vitest/ui": "^2.1.8",
  "@vitest/coverage-v8": "^2.1.8",
  "@cloudflare/vitest-pool-workers": "^0.9.0"
}
```

**Configuration Files:**
- `/vitest.config.ts` - Root configuration
- `/packages/cf-realtime/vitest.config.ts` - Package-specific config using Workers pool
- `/packages/cf-realtime/wrangler.toml` - Cloudflare bindings configuration

**Test Suite:**
- 38 RealtimeClient tests (Node environment)
- 13 RealtimeActor tests (Workers runtime with Durable Objects)
- 19 Integration tests (full pub/sub flows)

---

## Testing Architecture

### Three-Layer Testing Approach

```
┌─────────────────────────────────────────────────────┐
│                  Test Layers                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. Unit Tests (Client)                            │
│     ├─ Run in Node.js environment                  │
│     ├─ Mock WebSocket connections                  │
│     └─ Test business logic independently           │
│                                                     │
│  2. Unit Tests (Server/Durable Objects)            │
│     ├─ Run in Workers runtime (Miniflare)          │
│     ├─ Real Durable Objects emulation              │
│     └─ Test Worker endpoints and DO behavior       │
│                                                     │
│  3. Integration Tests                              │
│     ├─ Test complete flows                         │
│     ├─ Multi-component interactions                │
│     └─ End-to-end scenarios                        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Directory Structure

```
packages/cf-realtime/
├── vitest.config.ts                    # Vitest config using Workers pool
├── wrangler.toml                       # Cloudflare bindings
├── src/
│   ├── client/                         # Client-side code
│   ├── server/                         # Worker & Durable Object code
│   ├── types/                          # Shared types
│   └── __tests__/
│       ├── client/                     # Node.js tests
│       │   └── RealtimeClient.test.ts
│       ├── server/                     # Workers runtime tests
│       │   └── RealtimeActor.test.ts
│       ├── integration/                # End-to-end tests
│       │   └── realtime-flow.test.ts
│       ├── mocks/                      # Mock implementations
│       │   └── websocket.ts
│       ├── fixtures/                   # Test data factories
│       │   └── messages.ts
│       └── utils/                      # Test utilities
│           └── async-helpers.ts
```

---

## How Cloudflare Testing Works

### The Workers Test Pool

`@cloudflare/vitest-pool-workers` provides a **custom Vitest pool** that runs tests in a Cloudflare Workers environment using **Miniflare**.

#### Key Components

1. **Miniflare** - Local Cloudflare Workers simulator
   - Emulates the Workers runtime
   - Provides real implementations of Cloudflare bindings
   - Isolated storage per test
   - WebSocket support (with limitations)

2. **Workers Test Pool** - Vitest integration
   - Runs tests in Workers context
   - Manages test isolation
   - Handles Durable Object lifecycle
   - Provides test utilities via `cloudflare:test`

3. **Configuration via wrangler.toml**
   ```toml
   # Defines bindings available during tests
   [[durable_objects.bindings]]
   name = "REALTIME"
   class_name = "RealtimeActor"
   ```

### Test Execution Flow

```
┌────────────────────────────────────────────────────────┐
│                  Test Execution                        │
├────────────────────────────────────────────────────────┤
│                                                        │
│  1. Vitest starts                                      │
│     ├─ Loads vitest.config.ts                         │
│     └─ Detects Workers pool configuration             │
│                                                        │
│  2. Workers Pool initializes                           │
│     ├─ Starts Miniflare runtime                       │
│     ├─ Loads wrangler.toml configuration              │
│     ├─ Sets up Durable Objects                        │
│     └─ Creates isolated test environments             │
│                                                        │
│  3. Tests run                                          │
│     ├─ Each test file gets isolated runtime           │
│     ├─ Durable Objects are instantiated               │
│     ├─ Tests interact via stubs                       │
│     └─ Storage is isolated per test                   │
│                                                        │
│  4. Cleanup                                            │
│     ├─ Miniflare shuts down                           │
│     └─ Test results are collected                     │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### How Durable Object Tests Work

```typescript
// Import the test environment
import { env } from "cloudflare:test";

// Define your environment interface
interface Env {
  REALTIME: DurableObjectNamespace<RealtimeActor>;
}

describe("Durable Object Tests", () => {
  let stub: DurableObjectStub<RealtimeActor>;

  beforeEach(() => {
    // Get a unique Durable Object ID for this test
    const id = (env as unknown as Env).REALTIME.idFromName(
      `test-${Date.now()}`
    );

    // Get a stub to interact with the DO
    stub = (env as unknown as Env).REALTIME.get(id);
  });

  it("should handle requests", async () => {
    // Make HTTP requests to the Durable Object
    const response = await stub.fetch("https://test.example.com/health");
    expect(response.status).toBe(200);
  });
});
```

**Key Points:**
- Don't instantiate Durable Objects directly
- Use `env.NAMESPACE.get(id)` to get a stub
- Interact through the stub's `fetch()` method
- Each test gets a fresh DO instance (isolated storage)

---

## What Can Be Tested Locally

### ✅ Fully Supported (via Miniflare)

| Binding Type | Support Level | Notes |
|-------------|---------------|-------|
| **Durable Objects** | ✅ Full | Complete emulation with storage |
| **KV** | ✅ Full | In-memory key-value store |
| **R2** | ✅ Full | In-memory object storage |
| **D1** | ✅ Full | SQLite database |
| **Queues** | ✅ Full | In-memory queue implementation |
| **Service Bindings** | ✅ Full | Call other Workers |
| **Environment Variables** | ✅ Full | Set via wrangler.toml |
| **Secrets** | ✅ Full | Mock secrets in tests |

### ⚠️ Partially Supported

| Feature | Support Level | Limitations |
|---------|---------------|-------------|
| **WebSockets** | ⚠️ Partial | Difficult to test message handling |
| **Alarms** | ⚠️ Partial | Can be triggered but timing is different |
| **Analytics Engine** | ⚠️ Mock | No real analytics |
| **Hyperdrive** | ⚠️ Mock | No actual connection pooling |

### ❌ Not Supported Locally

| Feature | Alternative Testing Strategy |
|---------|------------------------------|
| **Email Workers** | Integration tests in staging |
| **Browser Rendering** | Integration tests in staging |
| **Tail Workers** | Integration tests in staging |
| **Cloudflare Images** | Mock responses, test in staging |
| **Live HTTP origins** | Mock fetch(), use MSW for HTTP mocking |
| **Cloudflare CDN behavior** | Test in staging/production |

---

## Testing Items Without Local Emulation

When Wrangler/Miniflare doesn't support local emulation, use these strategies:

### 1. Mock External Services

For features like Cloudflare Images, email, or external APIs:

```typescript
// Create mock implementations
vi.mock("./cloudflare-images", () => ({
  uploadImage: vi.fn(async () => ({
    id: "mock-image-id",
    url: "https://example.com/mock-image.jpg",
  })),
}));

// Test business logic
it("should process image upload", async () => {
  const result = await processUserAvatar(mockFile);
  expect(result.imageId).toBe("mock-image-id");
});
```

### 2. Integration Tests in Staging

For features that require real Cloudflare services:

```typescript
// Mark tests as integration tests
describe("Image Upload Integration", () => {
  // Only run in CI or staging environment
  const isIntegrationTest = process.env.RUN_INTEGRATION === "true";

  it.skipIf(!isIntegrationTest)("should upload to Cloudflare Images", async () => {
    const realClient = new CloudflareImagesClient(process.env.CF_API_KEY);
    const result = await realClient.upload(testImage);
    expect(result.variants).toBeDefined();
  });
});
```

### 3. Contract Testing

Define contracts between your code and Cloudflare services:

```typescript
// Define expected interface
interface ImagesService {
  upload(file: File): Promise<{ id: string; url: string }>;
  delete(id: string): Promise<void>;
}

// Test against contract
it("should implement ImagesService contract", () => {
  const service = new CloudflareImagesAdapter();

  // Verify types
  expect(typeof service.upload).toBe("function");
  expect(typeof service.delete).toBe("function");
});

// Mock implementation for tests
class MockImagesService implements ImagesService {
  async upload(file: File) {
    return { id: "mock-id", url: "mock-url" };
  }
  async delete(id: string) {}
}
```

### 4. Snapshot Testing for HTTP Responses

For external APIs, record and replay responses:

```typescript
// Record real responses once
const mockResponse = {
  success: true,
  result: { /* ... */ },
};

// Test against snapshot
it("should handle Cloudflare API response", () => {
  const processed = processCloudflareResponse(mockResponse);
  expect(processed).toMatchSnapshot();
});
```

### 5. E2E Tests with Wrangler Dev/Deploy

```bash
# Run E2E tests against deployed Worker
wrangler deploy --env staging

# Run tests that hit real endpoints
npm run test:e2e -- --env=staging
```

```typescript
// E2E test
describe("Live Worker Tests", () => {
  const workerUrl = process.env.WORKER_URL || "http://localhost:8787";

  it("should handle real requests", async () => {
    const response = await fetch(`${workerUrl}/api/health`);
    expect(response.status).toBe(200);
  });
});
```

### 6. Feature Flags for Testing

```typescript
// Use feature flags to swap implementations
const imagesService = env.USE_MOCK_IMAGES
  ? new MockImagesService()
  : new CloudflareImagesService(env.CF_IMAGES);

// Enable mocks in tests
export default {
  async fetch(request, env) {
    const testEnv = { ...env, USE_MOCK_IMAGES: true };
    return handleRequest(request, testEnv);
  },
};
```

### 7. Adapter Pattern

Create adapters that can be swapped:

```typescript
// Abstract interface
interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

// Real implementation
class R2Adapter implements StorageAdapter {
  constructor(private bucket: R2Bucket) {}
  async get(key: string) {
    const obj = await this.bucket.get(key);
    return obj?.text() || null;
  }
  async set(key: string, value: string) {
    await this.bucket.put(key, value);
  }
}

// Test implementation
class InMemoryAdapter implements StorageAdapter {
  private store = new Map<string, string>();
  async get(key: string) {
    return this.store.get(key) || null;
  }
  async set(key: string, value: string) {
    this.store.set(key, value);
  }
}

// Swap in tests
const storage = env.TESTING
  ? new InMemoryAdapter()
  : new R2Adapter(env.MY_BUCKET);
```

---

## Implementation Details

### Configuration Breakdown

#### Root `/vitest.config.ts`
```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: { /* ... */ },
  },
});
```
- Default config for packages
- Node environment by default
- Shared coverage settings

#### Package `/packages/cf-realtime/vitest.config.ts`
```typescript
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          compatibilityDate: "2024-01-01",
          compatibilityFlags: ["nodejs_compat"],
        },
        isolatedStorage: true, // Each test gets clean storage
      },
    },
  },
});
```
- Uses `defineWorkersConfig` instead of `defineConfig`
- Points to wrangler.toml for bindings
- Enables isolated storage per test

#### `/packages/cf-realtime/wrangler.toml`
```toml
name = "cf-realtime-test"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[[durable_objects.bindings]]
name = "REALTIME"              # Binding name used in code
class_name = "RealtimeActor"   # Class to instantiate
```
- Defines Durable Object binding
- Sets compatibility flags
- Used by Miniflare during tests

### Test Patterns

#### Pattern 1: Durable Object HTTP Tests
```typescript
it("should handle health check", async () => {
  const response = await stub.fetch("https://test.example.com/health");
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.status).toBe("ok");
});
```

#### Pattern 2: Durable Object Isolation Tests
```typescript
it("should maintain separate state", async () => {
  const stub1 = env.REALTIME.get(env.REALTIME.idFromName("instance-1"));
  const stub2 = env.REALTIME.get(env.REALTIME.idFromName("instance-2"));

  // Each has independent state
  await stub1.fetch("/set-value", { method: "POST", body: "A" });
  await stub2.fetch("/set-value", { method: "POST", body: "B" });

  const value1 = await stub1.fetch("/get-value");
  const value2 = await stub2.fetch("/get-value");

  expect(await value1.text()).toBe("A");
  expect(await value2.text()).toBe("B");
});
```

#### Pattern 3: Client-Side Unit Tests with Mocks
```typescript
import { createMockWebSocketConstructor } from "../mocks/websocket";

const MockWS = createMockWebSocketConstructor();
global.WebSocket = MockWS as any;

it("should connect to WebSocket", async () => {
  client.connect();
  const mockWs = MockWS.getLastInstance();
  mockWs.simulateOpen();

  expect(client.getState()).toBe(ConnectionState.CONNECTED);
});
```

---

## Running Tests

### Commands

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm test --filter @ottabase/cf-realtime

# Watch mode (re-run on changes)
pnpm test:watch

# Interactive UI
pnpm test:ui

# Coverage report
pnpm test:coverage

# Run specific test file
pnpm vitest run src/__tests__/server/RealtimeActor.test.ts

# Run tests matching pattern
pnpm vitest run --grep "Durable Object"
```

### CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm test
      - run: pnpm test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## Troubleshooting

### Issue: Tests timeout

**Symptoms:** Tests hang indefinitely

**Solutions:**
```typescript
// Increase timeout in vitest.config.ts
export default defineWorkersConfig({
  test: {
    testTimeout: 30000, // 30 seconds
    hookTimeout: 30000,
  },
});
```

### Issue: "Cannot find module 'cloudflare:test'"

**Symptoms:** Import error for `cloudflare:test`

**Solutions:**
- Ensure `@cloudflare/vitest-pool-workers` is installed
- Check that you're using `defineWorkersConfig`
- Verify wrangler.toml exists and is configured

### Issue: Durable Object not found

**Symptoms:** `TypeError: env.REALTIME is undefined`

**Solutions:**
```toml
# Ensure wrangler.toml has the binding
[[durable_objects.bindings]]
name = "REALTIME"
class_name = "RealtimeActor"

[[migrations]]
tag = "v1"
new_classes = ["RealtimeActor"]
```

### Issue: Storage not isolated between tests

**Symptoms:** Tests pass individually but fail when run together

**Solutions:**
```typescript
// Use unique IDs per test
beforeEach(() => {
  const id = env.REALTIME.idFromName(`test-${Date.now()}-${Math.random()}`);
  stub = env.REALTIME.get(id);
});

// Or enable isolated storage
export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        isolatedStorage: true, // ← Add this
      },
    },
  },
});
```

### Issue: WebSocket tests failing

**Symptoms:** WebSocket connection tests don't work

**Solutions:**
- WebSocket testing in Miniflare is limited
- Test HTTP upgrades instead:
  ```typescript
  it("should upgrade to WebSocket", async () => {
    const response = await stub.fetch("https://example.com/ws", {
      headers: { "Upgrade": "websocket" },
    });
    expect(response.status).toBe(101);
    expect(response.webSocket).toBeDefined();
  });
  ```
- For full WebSocket testing, use integration tests

### Issue: Module resolution errors

**Symptoms:** Can't import from Workers modules

**Solutions:**
```typescript
// Use proper TypeScript paths
{
  "compilerOptions": {
    "types": ["@cloudflare/workers-types", "vitest/globals"]
  }
}
```

---

## Summary

### What You Get

✅ **Local Durable Object Testing** - Full emulation via Miniflare
✅ **Isolated Test Environments** - Each test has clean storage
✅ **Fast Feedback** - Tests run locally without deployment
✅ **Comprehensive Coverage** - Unit, integration, and E2E tests
✅ **CI/CD Ready** - Runs in GitHub Actions and other CI systems

### What to Remember

1. **Use the Workers pool** for Durable Object tests
2. **Mock what Miniflare doesn't support** (Images, Email, etc.)
3. **Use stubs, not direct instantiation** for Durable Objects
4. **Isolate storage** with unique IDs per test
5. **Supplement with staging tests** for unsupported features

### Next Steps

1. **Add tests for `@ottabase/cf` package** (D1, KV, R2)
2. **Set up CI/CD pipeline** with GitHub Actions
3. **Add integration tests** for template app
4. **Monitor Cloudflare updates** for new testing APIs
5. **Aim for >80% coverage** across all packages

---

## Resources

- [Cloudflare Workers Testing Docs](https://developers.cloudflare.com/workers/testing/)
- [Miniflare Documentation](https://miniflare.dev/)
- [@cloudflare/vitest-pool-workers](https://github.com/cloudflare/workers-sdk/tree/main/packages/vitest-pool-workers)
- [Vitest Documentation](https://vitest.dev/)
- [Cloudflare Blog: Better Testing for Workflows](https://blog.cloudflare.com/better-testing-for-workflows/)
