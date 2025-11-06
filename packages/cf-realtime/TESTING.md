# Testing Guide for @ottabase/cf-realtime

This guide covers the testing infrastructure and best practices for testing the cf-realtime package.

## Table of Contents

- [Overview](#overview)
- [Test Infrastructure](#test-infrastructure)
- [Running Tests](#running-tests)
- [Test Structure](#test-structure)
- [Best Practices](#best-practices)
- [Writing Tests](#writing-tests)
- [Cloudflare Workers Testing](#cloudflare-workers-testing)

## Overview

The cf-realtime package uses **Vitest** as its testing framework, with special support for testing Cloudflare Workers and Durable Objects through `@cloudflare/vitest-pool-workers`.

### Test Coverage

- **Unit Tests**: Test individual components in isolation (RealtimeClient, RealtimeActor)
- **Integration Tests**: Test interactions between components (client-server communication)
- **Mocks & Utilities**: Reusable test helpers and mock implementations

## Test Infrastructure

### Dependencies

```json
{
  "vitest": "^2.1.8",
  "@vitest/ui": "^2.1.8",
  "@vitest/coverage-v8": "^2.1.8",
  "@cloudflare/vitest-pool-workers": "^0.9.0"
}
```

### Configuration Files

**`vitest.config.ts`** - Package-level configuration using Cloudflare Workers pool:

```typescript
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    globals: true,
    environment: "node",
    poolOptions: {
      workers: {
        wrangler: {
          configPath: "./wrangler.toml",
        },
      },
    },
  },
});
```

**`wrangler.toml`** - Cloudflare Workers configuration for testing:

```toml
name = "cf-realtime-test"
compatibility_date = "2024-01-01"

[[durable_objects.bindings]]
name = "REALTIME"
class_name = "RealtimeActor"
```

## Running Tests

### Available Commands

```bash
# Run all tests once
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage
```

### From Root Directory

```bash
# Run tests for all packages
pnpm test

# Run tests for cf-realtime only
pnpm test --filter @ottabase/cf-realtime
```

## Test Structure

```
src/__tests__/
├── client/
│   └── RealtimeClient.test.ts      # Unit tests for client
├── server/
│   └── RealtimeActor.test.ts       # Unit tests for Durable Object
├── integration/
│   └── realtime-flow.test.ts       # Integration tests
├── mocks/
│   └── websocket.ts                # WebSocket mock implementation
├── fixtures/
│   └── messages.ts                 # Test data and fixtures
├── utils/
│   └── async-helpers.ts            # Testing utilities
└── setup.ts                        # Global test setup
```

## Best Practices

### 1. Use Fixtures for Test Data

Create reusable test data using fixtures:

```typescript
import { createChannelMessage } from "../fixtures/messages";

const message = createChannelMessage("test-channel", "event-name", { foo: "bar" });
```

### 2. Mock WebSocket Connections

Use the provided WebSocket mock for client testing:

```typescript
import { createMockWebSocketConstructor } from "../mocks/websocket";

const MockWSConstructor = createMockWebSocketConstructor();
global.WebSocket = MockWSConstructor as any;

// Get the mock instance
const mockWs = MockWSConstructor.getLastInstance();
mockWs.simulateOpen();
mockWs.simulateMessage(JSON.stringify(message));
```

### 3. Use Fake Timers for Time-Dependent Tests

```typescript
import { vi } from "vitest";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// Advance time
vi.advanceTimersByTime(5000);
```

### 4. Clean Up After Tests

```typescript
afterEach(() => {
  client.disconnect();
  MockWSConstructor.clearInstances();
});
```

### 5. Test Error Paths

Always test error handling:

```typescript
it("should handle connection errors", () => {
  const errorHandler = vi.fn();
  client.onError(errorHandler);

  mockWs.simulateError(new Error("Connection failed"));

  expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
});
```

## Writing Tests

### Testing RealtimeClient

Example unit test for the client:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { RealtimeClient } from "../../client/RealtimeClient";
import { ConnectionState } from "../../types";
import { createMockWebSocketConstructor } from "../mocks/websocket";

const MockWSConstructor = createMockWebSocketConstructor();
global.WebSocket = MockWSConstructor as any;

describe("RealtimeClient", () => {
  let client: RealtimeClient;
  let mockWs: MockWebSocket;

  beforeEach(() => {
    vi.useFakeTimers();
    client = new RealtimeClient({
      url: "wss://test.example.com/ws",
      clientId: "test-client",
    });
  });

  it("should connect to WebSocket server", async () => {
    client.connect();
    mockWs = MockWSConstructor.getLastInstance();
    mockWs.simulateOpen();

    expect(client.getState()).toBe(ConnectionState.CONNECTED);
  });
});
```

### Testing RealtimeActor

Example unit test for the Durable Object:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { RealtimeActor } from "../../server/RealtimeActor";

describe("RealtimeActor", () => {
  let actor: RealtimeActor;
  let state: DurableObjectState;

  beforeEach(() => {
    // Mock DurableObjectState
    state = {
      storage: {
        get: async (key: string) => {},
        put: async (key: string, value: any) => {},
        // ... other storage methods
      },
      // ... other state methods
    } as DurableObjectState;

    actor = new RealtimeActor(state, {});
  });

  it("should handle health check", async () => {
    const request = new Request("https://test.example.com/health");
    const response = await actor.fetch(request);

    expect(response.status).toBe(200);
  });
});
```

### Integration Testing

Test complete flows:

```typescript
describe("Pub/Sub Integration", () => {
  it("should deliver messages to subscribers", async () => {
    const handler = vi.fn();

    // Connect and subscribe
    client.connect();
    mockWs.simulateOpen();
    client.subscribe("test-channel", handler);

    // Receive message
    mockWs.simulateMessage(JSON.stringify({
      type: "message",
      channel: "test-channel",
      event: "test-event",
      data: { foo: "bar" },
      timestamp: Date.now(),
    }));

    expect(handler).toHaveBeenCalledWith("test-event", { foo: "bar" }, undefined);
  });
});
```

## Cloudflare Workers Testing

### Testing Durable Objects

When testing Durable Objects, the `@cloudflare/vitest-pool-workers` package provides a Workers-compatible environment:

```typescript
// vitest.config.ts
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: {
          configPath: "./wrangler.toml",
        },
        miniflare: {
          compatibilityDate: "2024-01-01",
          compatibilityFlags: ["nodejs_compat"],
        },
      },
    },
  },
});
```

### Limitations

Current test mocks provide basic Durable Object behavior. For comprehensive Durable Object testing:

1. Use the Workers test pool for real Durable Object functionality
2. Mock storage operations for unit tests
3. Use integration tests to verify complete flows

### Future Enhancements

As mentioned in the Cloudflare blog post about [Better Testing for Workflows](https://blog.cloudflare.com/better-testing-for-workflows/), Cloudflare is adding introspection APIs:

```typescript
// Future: Introspection for Durable Objects
import { introspectWorkflowInstance } from "cloudflare:test";

await using instance = await introspectWorkflowInstance(
  env.REALTIME,
  "my-instance-id"
);

await instance.modify(async (m) => {
  await m.mockStepResult({ name: "broadcast" }, { success: true });
});
```

These APIs are currently available for Cloudflare Workflows. Similar patterns may be adopted for Durable Objects testing in the future.

## Coverage

Generate coverage reports:

```bash
pnpm test:coverage
```

Coverage reports are generated in:
- **Text**: Console output
- **HTML**: `coverage/index.html`
- **JSON**: `coverage/coverage-final.json`

## CI/CD Integration

The test suite is configured to run in CI/CD pipelines via Turbo:

```json
{
  "test": {
    "dependsOn": ["^build"],
    "outputs": ["coverage/**"]
  }
}
```

## Troubleshooting

### WebSocket Mock Issues

If tests fail with WebSocket-related errors:

1. Ensure `global.WebSocket` is mocked before creating clients
2. Clear instances between tests: `MockWSConstructor.clearInstances()`
3. Check that timers are advanced properly: `vi.runAllTimersAsync()`

### Durable Object State Issues

If Durable Object tests fail:

1. Verify `wrangler.toml` is properly configured
2. Check that storage methods are properly mocked
3. Ensure the Workers pool is configured in `vitest.config.ts`

### Async Timing Issues

For flaky async tests:

1. Use `vi.useFakeTimers()` for deterministic timing
2. Use `waitFor` utility for condition-based waiting
3. Ensure proper cleanup in `afterEach`

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Cloudflare Workers Testing](https://developers.cloudflare.com/workers/testing/)
- [Cloudflare Vitest Pool Workers](https://github.com/cloudflare/workers-sdk/tree/main/packages/vitest-pool-workers)
- [Better Testing for Cloudflare Workflows](https://blog.cloudflare.com/better-testing-for-workflows/)

## Contributing

When adding new features:

1. Write unit tests for new components
2. Add integration tests for new flows
3. Update fixtures if new message types are added
4. Maintain >80% code coverage
5. Document complex test scenarios

## License

Same as package license (MIT)
