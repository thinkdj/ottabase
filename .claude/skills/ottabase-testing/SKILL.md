---
name: ottabase-testing
description:
    The Ottabase way to write and run tests (Vitest across the monorepo). Use for "add a test", "run the tests", "why is
    CI not catching this", "test this package", "mock Cloudflare bindings". Encodes the per-package gate rule and the
    rebuild-before-test gotcha that trips agents.
---

# Testing the Ottabase way

Vitest everywhere. Tests live in `src/__tests__/` as `*.test.ts` / `*.test.tsx` (colocated). `@testing-library/react`
for components; Cloudflare bindings are mocked in app test setups.

## Running (agents: scope with `--filter`, do not run full builds locally)

```bash
pnpm test --filter=@ottabase/<pkg>        # the package you changed
pnpm --filter @ottabase/<pkg> test -- foo.test.ts   # a single file
pnpm --filter @ottabase/<pkg> test -- --run          # one-shot (no watch)
```

## Rules that actually bite

- **Every workspace must declare a `test` script.** Turbo silently skips an undeclared task — a package with no `test`
  is not passing, it is _invisible_ to CI.
- **`turbo test` depends on `^build`.** When you change a shared package and test a consumer, **rebuild first**
  (`pnpm build:pkg --filter=<pkg>`) or the consumer tests run against stale `dist/`. Same for `type-check`. This is the
  single most common false pass/fail.
- **Cloudflare bindings are mocked in apps** (`OBCF_D1`, `OBCF_KV`, `OBCF_R2`, `OBCF_QUEUE`, `OBCF_RATE_LIMITER`, …) via
  each app's `vitest.setup.ts`. Override per-test with `vi.fn()` on the global.
- New package → add its own `vitest.config.ts` + `test` script, or `pnpm test:packages` won't see it.

## Conventions

- `describe('Feature', ...)`, `it('should <behavior>', ...)`. Tests run in parallel and must be independent;
  `describe.sequential()` only when order truly matters.
- Keep it lazy: colocate one `*.test.ts`, no bespoke fixtures/frameworks unless the logic (a parser, a money/security
  path, a branch) genuinely needs them. Trivial one-liners don't need a test.
- `await` your async assertions — an un-awaited `expect(...).rejects.toThrow(...)` passes today but hard-fails under
  Vitest 3.

## Authoritative sources

`docs/TESTING.md` (full guide + CF-binding mock table). `AGENTS.MD` → "Always-On Rules" (four-scripts rule), "IMPORTANT
NOTES FOR CODING AGENTS" (per-package `--filter` only). Full docs: `/llms-full.txt`.
