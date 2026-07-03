# Publishing @ottabase/ottarouter

Developer-facing notes for maintaining and publishing this package. If you only want to _use_ ottarouter, read
[README.md](./README.md) instead — this file is for people building or releasing the package itself.

## Package Design

- **Zero runtime dependencies.** `package.json` has no `dependencies` field, only `devDependencies` (build/test
  tooling). Keep it that way — this package trades on being safe to add to any Workers project without dragging in a
  dependency tree. If a feature would require a runtime dependency, it does not belong in the package.
- **Single source file.** All runtime logic lives in `src/router.ts`; `src/index.ts` is a re-export barrel only (kept
  out of coverage on purpose — see `vitest.config.ts`). Resist splitting the core across files: the "hold the whole
  mental model in your head" pitch depends on the implementation being small enough to read in one sitting.
- **No Node APIs.** Only `Request`, `Response`, `URL`, and `Headers` — the Fetch API surface every JS runtime (Workers,
  Deno, Bun, browsers, Node ≥ 18) implements. Do not import from `node:*`, do not reach for `Buffer`, and do not assume
  any global beyond what workerd provides.
- **Dual module output.** `tsup` builds CJS (`dist/index.js`) and ESM (`dist/index.mjs`) with a matching `.d.ts`, so the
  package works from both `require()` and `import` consumers. The `exports` map in `package.json` is the source of truth
  for what resolves where — update it if you add a new entry point.

## Local Development

```bash
# from the monorepo root
pnpm install
pnpm --filter @ottabase/ottarouter dev     # tsup --watch
pnpm --filter @ottabase/ottarouter test    # vitest, watch mode
```

Or from inside `packages/ottarouter/`:

```bash
pnpm dev            # tsup --watch
pnpm test           # vitest (watch)
pnpm test -- --run  # vitest (single run, what CI uses)
pnpm type-check      # tsc --noEmit
pnpm lint            # eslint src --ext .ts
pnpm build           # tsup — produces dist/
```

Workspace consumers (like `apps/otta-web`) resolve `@ottabase/ottarouter` through its built `dist/` output via normal
`workspace:*` + `exports` resolution. `apps/otta-web/vitest.config.ts` additionally aliases the specifier straight to
`src/index.ts` so app tests run without requiring a prior build — update that alias if the package's entry point ever
moves.

## Before Every Release

Run the full gate locally; CI runs the same commands via `turbo`:

```bash
cd packages/ottarouter
pnpm type-check
pnpm lint
pnpm test -- --run
pnpm build
```

Then sanity-check the built artifact — the most common publishing mistake is a green test suite against `src/` that
doesn't reflect what actually ships in `dist/`:

```bash
node -e "const r = require('./dist/index.js'); console.log(Object.keys(r))"
node --input-type=module -e "import * as r from './dist/index.mjs'; console.log(Object.keys(r))"
```

Both should print the same set of exports: `Router`, `RouteConflictError`, `withHeaders` (types are compile-time only
and won't appear here).

## Versioning

This package follows [Semantic Versioning](https://semver.org/). Because the whole public surface is one class, one
function, one error type, and a handful of type aliases (see the README's API Reference), most changes are easy to
classify:

- **Patch** (`0.0.x`): bug fixes that don't change documented behavior; internal refactors; doc/README fixes; new tests.
- **Minor** (`0.x.0`): new exported symbols or new optional parameters that are backward compatible; new behavior that
  is additive (e.g. a new `Router` method) and doesn't change what existing code does.
- **Major** (`x.0.0`): anything that changes the meaning of existing code without a source change — a precedence rule
  changing, a method signature changing, a default behavior changing (e.g. what `notFound()` returns by default),
  dropping support for a runtime.

Bump the version in `package.json` as part of the same commit/PR that contains the change. This package does not yet use
`changesets` or another automated release tool — versioning is manual. If the package graduates to its own independent
release cadence (outside the ottabase monorepo's lockstep versioning), consider adopting
[Changesets](https://github.com/changesets/changesets) at that point; until then, keep it simple.

## Publishing to npm

The package is scoped (`@ottabase/ottarouter`) and marked `"publishConfig": { "access": "public" }`, so a normal
`npm publish` (or `pnpm publish`) from an authenticated account with access to the `@ottabase` npm org will publish it
publicly without extra flags.

### One-time setup

```bash
npm login
# or, for an npm org you don't own yet:
#   npm access grant read-write <your-npm-username> @ottabase/ottarouter
```

You need publish rights on the `@ottabase` npm organization (or `access: public` won't be enough if the scope itself is
restricted — coordinate with whoever owns the `@ottabase` org on npmjs.com).

### Release steps

1. **Land the change** on `main` via a normal PR — code review and CI (`type-check`, `lint`, `test`, `build`) gate every
   merge.
2. **Bump the version** in `packages/ottarouter/package.json` following the SemVer rules above. Do this in its own
   commit (or as the final commit of the PR) so the version bump is easy to spot in history.
3. **Update `CHANGELOG.md`** at the repo root under `## [Unreleased]` (this package doesn't keep its own changelog — it
   follows the monorepo's single root changelog).
4. **Build clean and verify the artifact:**
    ```bash
    cd packages/ottarouter
    pnpm clean
    pnpm build
    npm pack --dry-run   # prints exactly what `files` would ship — confirm it's dist/ + README.md, nothing else
    ```
5. **Publish:**
    ```bash
    npm publish
    ```
    `pnpm publish` also works and additionally rewrites any `workspace:*` ranges — irrelevant here since this package
    has no `workspace:*` dependencies, but it's the safer default in a pnpm monorepo generally.
6. **Tag the release** (optional but recommended) so the published version is traceable in git history:
    ```bash
    git tag ottarouter-v<version>
    git push origin ottarouter-v<version>
    ```
7. **Verify on npm:** check `https://www.npmjs.com/package/@ottabase/ottarouter` shows the new version, and smoke test
   installation in a scratch project:
    ```bash
    mkdir /tmp/ottarouter-smoke && cd /tmp/ottarouter-smoke
    npm init -y && npm install @ottabase/ottarouter
    node -e "console.log(Object.keys(require('@ottabase/ottarouter')))"
    ```

### What NOT to publish

The `files` field in `package.json` is the allowlist (`dist`, `README.md`) — `npm pack --dry-run` is the fastest way to
confirm nothing else leaks (no `src/`, no test files, no `PUBLISHING.md`, no `tsconfig.json`). If you add new top-level
files to the package directory, check whether they belong in `files` or should stay excluded.

## Support Matrix

- **Runtime:** Cloudflare Workers (primary target — this is what `Ctx.ctx: ExecutionContextLike` and the `withHeaders`
  WebSocket-safety behavior are designed around). Also works anywhere the Fetch API is available: Deno, Bun, Node ≥ 18
  (`fetch`, `Request`, `Response`, `URL`, `Headers` globals), and browsers (minus the Workers `ExecutionContext`, which
  is optional — `handle()`/`fetch()` accept requests without one and fall back to a no-op stub).
- **TypeScript:** written against the version pinned in this monorepo's `catalog:` (`typescript` in
  `pnpm-workspace.yaml`). The public API uses template-literal types (`PathParams<P>`) — verify against the `typescript`
  catalog version before bumping it, since inference over recursive conditional types is one of the more
  version-sensitive corners of the compiler.
- **Module systems:** both ESM (`import`) and CommonJS (`require`) are supported via the dual build.

## Getting Help / Filing Issues

This package is developed inside the [ottabase](https://github.com/thinkdj/ottabase) monorepo. File issues and PRs
against that repository; there is no separate repo for `ottarouter`. Use the `directory` field in `package.json`
(`packages/ottarouter`) as the canonical location when linking to source from an issue.
