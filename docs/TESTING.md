# Testing Guide - Ottabase Monorepo

This document describes the comprehensive automated testing setup for the Ottabase monorepo using Vitest, with support
for all packages and applications.

## Overview

The testing infrastructure includes:

- **Vitest** for fast, modern testing with ESM support
- **@testing-library** for component and DOM testing
- **V8 coverage** (Vitest `coverage.provider: 'v8'`) for code coverage reporting
- **Cloudflare Bindings Mocks** for local testing of Worker code
- **Root + Package-level configs** for flexible, isolated testing

## Quick Start

### Run All Tests

```bash
pnpm test                # Run all tests in monorepo
pnpm test:all            # Same as above, explicit
pnpm test:packages       # Run only package tests
pnpm test:apps           # Run only app tests
```

### Run Tests for Specific Targets

```bash
pnpm test:otta-web      # Test the Vite + Workers app
pnpm test:otta-landing  # Test the Next.js landing app
pnpm test --filter=@ottabase/utils  # Test specific package
```

### Coverage Reports

Coverage uses `@vitest/coverage-v8`, a root dev dependency pinned in the catalog to the exact installed `vitest` version
(the provider imports `vitest/node` internals, so a version mismatch fails at startup). Bump both together.

```bash
pnpm test:coverage              # Run tests with coverage (all)
pnpm test:coverage:packages     # Coverage for packages only
pnpm test:coverage:apps         # Coverage for apps only
```

### Development Mode

```bash
pnpm test:watch          # Watch mode for all tests
pnpm test:ui             # Open Vitest UI for interactive testing
```

## Project Structure

### Root Configuration

- **vitest.config.ts** - Root Vitest config (jsdom, shared coverage defaults). Per-package configs take precedence;
  `pnpm test` runs each workspace's own `test` script through Turbo, not the root config
- **vitest.setup.ts** - Global setup for DOM APIs, mocks, etc.

### Package-Level Configs

Each package has its own `vitest.config.ts`:

- `packages/utils/` - Node.js environment
- `packages/api/` - Node.js environment
- `packages/auth/` - Node.js environment
- `packages/state/` - Node.js environment
- `packages/ui-components/` - Browser/jsdom environment
- `packages/ui-shadcn/` - Browser/jsdom environment
- `packages/forms/` - Browser/jsdom environment
- `packages/db/` - Node.js environment
- `packages/cf/` - Node.js environment
- And more...

### App-Level Configs

- `apps/otta-web/vitest.config.ts` - Vitest config with Cloudflare mocks
- `apps/otta-web/vitest.setup.ts` - Setup with all CF bindings mocked
- `apps/otta-landing/vitest.config.ts` - Next.js app Vitest config
- `apps/otta-landing/vitest.setup.ts` - Next.js mocks + CF bindings

## Writing Tests

### Package Tests

Tests are placed in `src/__tests__/` directory with `.test.ts` or `.test.tsx` extensions:

```typescript
// packages/utils/src/__tests__/string.test.ts
import { describe, it, expect } from 'vitest';
import { isEmail, changeCase } from '../string';

describe('String Utilities', () => {
    describe('isEmail', () => {
        it('should validate correct emails', () => {
            expect(isEmail('user@example.com')).toBe(true);
        });

        it('should reject invalid emails', () => {
            expect(isEmail('invalid')).toBe(false);
        });
    });
});
```

### Component Tests

Use `@testing-library/react` for component testing:

```typescript
// packages/ui-components/src/__tests__/Button.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../Button';

describe('Button Component', () => {
  it('should render button', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toBeTruthy();
  });
});
```

### Testing with Cloudflare Bindings

The apps have all Cloudflare bindings mocked via `vitest.setup.ts`:

```typescript
// apps/otta-web/src/__tests__/database.test.ts
describe('Cloudflare D1 Integration', () => {
    it('should have D1 mock available', () => {
        expect((global as any).OBCF_D1).toBeDefined();
    });

    it('should mock D1 prepare method', async () => {
        const db = (global as any).OBCF_D1;
        const stmt = db.prepare('SELECT * FROM users');
        expect(stmt).toBeDefined();
    });
});
```

### Async Tests

```typescript
it('should handle async operations', async () => {
    const result = await fetchData();
    expect(result).toBe('expected');
});

// With promises
it('should resolve promises', () => {
    return expect(promise).resolves.toBe('value');
});
```

## Mocked Cloudflare Bindings

All Cloudflare bindings are mocked in app test setups:

| Binding               | Mock Methods                   | Purpose              |
| --------------------- | ------------------------------ | -------------------- |
| **OBCF_D1**           | prepare, bind, all, first, run | SQLite database      |
| **OBCF_KV**           | get, put, delete, list         | Key-value store      |
| **OBCF_R2**           | get, put, delete, list         | Object storage       |
| **OBCF_QUEUE**        | send, sendBatch                | Message queue        |
| **OBCF_RATE_LIMITER** | limit                          | Rate limiting        |
| **OBCF_REALTIME**     | get                            | Durable Objects      |
| **OBCF_ASSETS**       | fetch                          | Static asset serving |

You can customize mocks in your tests:

```typescript
import { vi } from 'vitest';

(global as any).OBCF_D1.prepare = vi.fn().mockReturnValue({
    all: vi.fn().mockResolvedValue([{ id: 1, name: 'test' }]),
});
```

## Coverage Configuration

### Thresholds

Coverage is a report, not a CI gate (CI runs `test`, never `--coverage`). A package sets `coverage.thresholds` in its
own `vitest.config.ts` only for a floor it currently meets, so a threshold failure means a real regression. Packages
with thresholds today: `api`, `i18n`, `ottaai`, `ottadate`, `ottarouter`, `premium`, `premium-webhooks`, `ui-tailwind`.
Every config uses `coverage.include: ['src/**/*.{ts,tsx}']` so untested source files still count (Vitest 4 removed
`coverage.all`).

### Excluded from Coverage

- node_modules/, dist/, build/
- Config files (_.config.ts, _.config.js)
- Type definitions (\*.d.ts)
- Index files (in some configs)
- Build outputs (.next/, .wrangler/, dist/)

### Generate Coverage Report

```bash
# All coverage
pnpm test:coverage

# View HTML report
open coverage/index.html

# Specific format
turbo test -- --coverage.reporter=text
```

## Package.json Scripts

Each package and app includes test scripts:

```json
{
    "scripts": {
        "test": "vitest run", // One-shot run (watch: pnpm --filter <pkg> exec vitest)
        "test:coverage": "vitest --coverage" // With coverage
    }
}
```

## Root Package.json Test Scripts

| Script                   | Purpose                        |
| ------------------------ | ------------------------------ |
| `test`                   | Run all tests via Turbo        |
| `test:all`               | Explicit: test packages + apps |
| `test:packages`          | Test all packages only         |
| `test:apps`              | Test all apps only             |
| `test:otta-web`          | Test the Vite + Workers app    |
| `test:otta-landing`      | Test the Next.js landing app   |
| `test:coverage`          | All tests with coverage        |
| `test:coverage:packages` | Packages with coverage         |
| `test:coverage:apps`     | Apps with coverage             |
| `test:watch`             | Watch mode for all tests       |
| `test:ui`                | Interactive Vitest UI          |

## Turbo Configuration

Test task in `turbo.json`:

- **Depends On**: `^build` (packages must build first)
- **Inputs**: `$TURBO_DEFAULT$` plus `vitest.config.*`, `vitest.setup.*`
- **Outputs**: none (coverage reports are not cached)
- **Environment**: NODE_ENV=test

## Best Practices

### 1. Test File Organization

```
packages/utils/
├── src/
│   ├── __tests__/
│   │   ├── string.test.ts
│   │   ├── currency.test.ts
│   │   └── file.test.ts
│   ├── string.ts
│   ├── currency.ts
│   └── file.ts
└── vitest.config.ts
```

### 2. Naming Conventions

- Test files: `ComponentName.test.tsx` or `module.test.ts`
- Test suites: `describe('Feature Name', ...)`
- Test cases: `it('should [expected behavior]', ...)`

### 3. Mock External Dependencies

```typescript
import { vi } from 'vitest';

vi.mock('../api', () => ({
    fetchUser: vi.fn().mockResolvedValue({ id: 1, name: 'John' }),
}));
```

### 4. Setup and Teardown

```typescript
beforeEach(() => {
    // Run before each test
});

afterEach(() => {
    // Cleanup after each test
    vi.clearAllMocks();
});
```

### 5. Test Isolation

- Tests run in parallel by default
- Use `describe.sequential()` for tests that must run in order
- Each test should be independent

### 6. Testing Async Code

```typescript
// Promises
it('should resolve', async () => {
    const result = await asyncFn();
    expect(result).toBe('value');
});

// Callbacks
it('should call callback', (done) => {
    asyncFn(() => {
        expect(true).toBe(true);
        done();
    });
});

// Fake timers
it('should delay', async () => {
    vi.useFakeTimers();
    const promise = delayedFn();
    vi.advanceTimersByTime(1000);
    await promise;
    vi.useRealTimers();
});
```

## CI/CD Integration

Tests run in GitHub Actions (`.github/workflows/ci.yml`):

- **Trigger**: pull requests to `main` / `develop`, and manual dispatch
- **Platform**: `ubuntu-24.04`
- **Node Version**: 24
- **Command**: `pnpm run ci:check` (`turbo run lint type-check test build`) — a failing test fails the job

Turbo silently skips a workspace that does not declare a `test` script, so every package and app must define one.

## Debugging Tests

### Run Single Test

```bash
pnpm --filter @ottabase/utils test -- string.test.ts
```

### Run Specific Test Suite

```bash
pnpm --filter @ottabase/utils test -- --grep "isEmail"
```

### Watch Mode

```bash
pnpm test:watch
```

### Vitest UI

```bash
pnpm test:ui
# Opens http://localhost:51204/
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
    "type": "node",
    "request": "launch",
    "program": "${workspaceRoot}/node_modules/vitest/vitest.mjs",
    "args": ["run", "--inspect-brk"],
    "console": "integratedTerminal"
}
```

## Troubleshooting

### Tests Not Running

1. Check `vitest.config.ts` exists and is valid
2. Verify test files match pattern (_.test.ts, _.test.tsx)
3. Ensure package.json has test script: `"test": "vitest run"`

### Module Not Found Errors

1. Check path aliases in `vitest.config.ts`
2. Verify imports are correct
3. Ensure dependencies are in package.json

### Coverage Not Detected

1. Confirm test files exercise the code
2. Check coverage thresholds in config
3. View HTML report for detailed coverage

### Cloudflare Bindings Not Mocked

1. Verify vitest.setup.ts is referenced in vitest.config.ts
2. Check `setupFiles` path is correct
3. Ensure binding names match (OBCF_D1, OBCF_KV, etc.)

## Extending Tests

### Add Tests to New Package

1. Create `vitest.config.ts` in package root
2. Create `src/__tests__/` directory
3. Add test files with `.test.ts` or `.test.tsx`
4. Add `test` and `test:coverage` scripts to package.json
5. Tests will be picked up by `pnpm test:packages`

### Add Tests to New App

1. Create `vitest.config.ts` in app root
2. Create `vitest.setup.ts` with necessary mocks
3. Create test files in `src/__tests__/` or `__tests__/`
4. Add `test` and `test:coverage` scripts to package.json
5. Tests will be picked up by `pnpm test:apps`

## References

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Vitest Coverage](https://vitest.dev/guide/coverage)
- [Turbo Tasks](https://turbo.build/repo/docs/core-concepts/monorepos/running-tasks)
