# Testing Guide for Ottabase Monorepo

This guide explains how to use the testing infrastructure set up for the Ottabase monorepo.

## Overview

The monorepo uses **Vitest** as the test runner, with support for:
- **Unit tests** for utility functions and business logic
- **Component tests** for React components
- **Cloudflare Workers tests** using `@cloudflare/vitest-pool-workers`
- **Monorepo-wide test orchestration** via Turbo

## Quick Start

```bash
# Run all tests in the monorepo
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage

# Run tests using Turbo (respects caching)
pnpm test:turbo
```

## Running Tests for Specific Packages/Apps

```bash
# Test a specific package
cd packages/utils
pnpm test

# Test a specific app
cd apps/ottabase-template-app-tanstack
pnpm test

# Watch mode for a specific package
cd packages/utils
pnpm test:watch
```

## Project Structure

```
ottabase/
├── vitest.config.ts          # Base Vitest configuration
├── vitest.workspace.ts       # Workspace configuration for monorepo
├── vitest.setup.ts           # Global test setup
├── packages/
│   ├── utils/
│   │   └── src/
│   │       └── __tests__/    # Tests for utils package
│   │           ├── string.test.ts
│   │           └── url.test.ts
│   ├── cf/
│   │   ├── vitest.config.ts  # Cloudflare-specific config
│   │   ├── wrangler.toml     # Test Cloudflare bindings
│   │   └── src/
│   │       └── __tests__/    # Tests for Cloudflare wrappers
│   │           └── kv.test.ts
│   └── ...
└── apps/
    └── ottabase-template-app-tanstack/
        ├── vitest.config.ts  # App-specific config
        └── src/
            └── __tests__/    # Tests for TanStack app
                ├── setup.ts
                └── router.test.tsx
```

## Writing Tests

### 1. Unit Tests (Node Environment)

For utility functions and business logic:

```typescript
// packages/utils/src/__tests__/string.test.ts
import { describe, it, expect } from 'vitest';
import { changeCase } from '../string';

describe('changeCase', () => {
  it('should convert to camelCase', () => {
    expect(changeCase('hello world', 'camel')).toBe('helloWorld');
  });
});
```

### 2. React Component Tests (Browser Environment)

For React components:

```typescript
// apps/ottabase-template-app-tanstack/src/__tests__/component.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

function MyComponent() {
  return <h1>Hello World</h1>;
}

describe('MyComponent', () => {
  it('should render heading', () => {
    render(<MyComponent />);
    expect(screen.getByRole('heading')).toHaveTextContent('Hello World');
  });
});
```

### 3. Cloudflare Workers Tests

For Cloudflare-specific code (D1, KV, R2, etc.):

```typescript
// packages/cf/src/__tests__/kv.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { KVClient } from '../kv';
import type { KVNamespace } from '@cloudflare/workers-types';

// Create a mock KV namespace
function createMockKV(): KVNamespace {
  const store = new Map();
  return {
    get: async (key) => store.get(key),
    put: async (key, value) => store.set(key, value),
    // ... other methods
  } as KVNamespace;
}

describe('KVClient', () => {
  let kv: KVNamespace;
  let client: KVClient;

  beforeEach(() => {
    kv = createMockKV();
    client = new KVClient({ namespace: kv });
  });

  it('should get value by key', async () => {
    await kv.put('test', 'value');
    const result = await client.get('test');
    expect(result.success).toBe(true);
  });
});
```

## Testing Cloudflare Services

### Local Testing with Miniflare

The `@cloudflare/vitest-pool-workers` package provides local testing for Cloudflare Workers:

```typescript
// vitest.config.ts (in package with Cloudflare bindings)
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          compatibilityDate: '2024-01-01',
          d1Databases: ['TEST_DB'],
          kvNamespaces: ['TEST_KV'],
          r2Buckets: ['TEST_R2'],
        },
      },
    },
  },
});
```

### Mocking Cloudflare Bindings

For packages that don't need full Workers environment, mock the bindings:

```typescript
import type { KVNamespace, D1Database } from '@cloudflare/workers-types';

// Mock KV
const mockKV: KVNamespace = {
  get: vi.fn(),
  put: vi.fn(),
  // ... other methods
};

// Mock D1
const mockDB: D1Database = {
  prepare: vi.fn(() => ({
    bind: vi.fn().mockReturnThis(),
    all: vi.fn(),
    first: vi.fn(),
  })),
  // ... other methods
};
```

## Configuration Files

### Root Configuration

**vitest.config.ts** - Base configuration for all packages:
- Environment: `happy-dom` (fast DOM implementation)
- Coverage provider: `v8`
- Includes path aliases for monorepo packages

**vitest.workspace.ts** - Workspace configuration:
- Defines test projects for each package/app
- Sets appropriate environment for each (node/happy-dom)

**vitest.setup.ts** - Global setup:
- Imports `@testing-library/jest-dom` for DOM matchers
- Sets up environment variables

### Package-Specific Configuration

Each package/app can override the base config:

```typescript
// packages/your-package/vitest.config.ts
import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      // Package-specific overrides
      environment: 'node',
    },
  }),
);
```

## Best Practices

### 1. Test Organization

- Place tests in `__tests__` directories next to source code
- Name test files with `.test.ts` or `.spec.ts` extension
- Group related tests using `describe` blocks

### 2. Test Isolation

- Use `beforeEach` to set up fresh test state
- Use `afterEach` to clean up (especially for React tests)
- Don't rely on test execution order

### 3. Mocking

- Mock external dependencies (APIs, databases, etc.)
- Use `vi.mock()` for module mocking
- Use `vi.fn()` for function mocking

### 4. Assertions

Available matchers from `@testing-library/jest-dom`:
- `toBeInTheDocument()`
- `toHaveTextContent(text)`
- `toHaveClass(className)`
- `toBeVisible()`
- And many more...

### 5. Coverage

- Aim for meaningful coverage, not 100%
- Focus on critical business logic
- Use coverage reports to find untested code paths

```bash
# Generate coverage report
pnpm test:coverage

# View coverage in browser
open coverage/index.html
```

## Continuous Integration

Tests run automatically via Turbo's caching system:

```json
// turbo.json
{
  "tasks": {
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["**/*.test.ts", "**/*.test.tsx"],
      "outputs": ["coverage/**"]
    }
  }
}
```

## Troubleshooting

### "Cannot find module" errors

Make sure path aliases are configured in `vitest.config.ts`:

```typescript
resolve: {
  alias: {
    '@ottabase/utils': path.resolve(__dirname, './packages/utils/src'),
  },
}
```

### Tests timing out

Increase timeout for slow tests:

```typescript
it('slow test', async () => {
  // test code
}, { timeout: 10000 }); // 10 seconds
```

### Cloudflare bindings not working

1. Check `wrangler.toml` has correct bindings
2. Verify `vitest.config.ts` uses `defineWorkersConfig`
3. Ensure `@cloudflare/vitest-pool-workers` is installed

### React component tests failing

1. Check test setup file is imported
2. Verify `happy-dom` environment is set
3. Use `cleanup()` in `afterEach`

## Adding Tests to New Packages

1. Add test script to `package.json`:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest watch"
  }
}
```

2. (Optional) Create package-specific `vitest.config.ts`

3. Add test directory: `src/__tests__/`

4. Write tests!

5. Update `vitest.workspace.ts` to include new package:
```typescript
{
  extends: './vitest.config.ts',
  test: {
    name: '@ottabase/your-package',
    root: './packages/your-package',
  },
}
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Cloudflare Workers Testing](https://developers.cloudflare.com/workers/testing/vitest-integration/)
- [@cloudflare/vitest-pool-workers](https://github.com/cloudflare/workers-sdk/tree/main/packages/vitest-pool-workers)

## Examples

See the following packages for testing examples:
- `packages/utils/src/__tests__/` - Unit tests
- `packages/cf/src/__tests__/` - Cloudflare Workers tests
- `apps/ottabase-template-app-tanstack/src/__tests__/` - React component tests
