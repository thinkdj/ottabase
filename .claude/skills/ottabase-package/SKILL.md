---
name: ottabase-package
description:
    The Ottabase way to add a new workspace package (with or without its own DB table) and wire it into the monorepo's
    build/migration/CI gates. Use for "create a package", "new @ottabase/* package", "extract this into a package", "add
    a shared library". Encodes the registration steps and the headless/rendered split that make a package actually work
    in CI.
---

# Add a new package

## Persistence decision first

- **No DB**: keep it framework-agnostic and stateless where possible.
- **Needs a table**: follow the OttaORM persistence split below.

## OttaORM persistence split (when the package owns a table)

1. Package exports the Drizzle table (`packages/<pkg>/src/schema.ts`, or `src/persistence` for complex packages).
2. App: add the table to `ottabase/config.migrations.ts` `PACKAGE_REGISTRY`.
3. App: add the package key to `ottabase.config.ts` `packages` (built-in) or `customPackages` (custom). Custom packages
   also register routes in `ottabase/config.routes.ts`.
4. App owns the `BaseModel` class (`apps/*/ottabase/models/*`) and registers it in `worker/lib/db-utils.ts`.
5. App exports the table from `ottabase/db/schema.ts` and adds it to `db/schemas-helper.ts`. _(Premium packages bypass
   all of this — one registration in `config.premium.ts`. See `docs/PREMIUM_PACKAGES.md`.)_

## Headless vs rendered (required when both exist)

- Root entry `@ottabase/<pkg>` stays **headless**: types, pure utils, models, schemas, hooks — **zero rendered UI**.
- Rendered React behind an explicit subpath: `@ottabase/<pkg>/react` (or `/server` for server-only). Declare each in
  `package.json` `exports`; add a boundary test asserting the root exports no UI.

## Wire into the gates (or CI silently skips the package)

6. Declare **all four** scripts: `lint` (`"eslint src"`, no `--ext`, no package-local eslint config), `type-check`,
   `test`, `build`. Turbo skips undeclared tasks without reporting — a missing script is invisible to CI, not passing.
    - **Carve-out**: a package whose `exports` point at `./src` (no build output) defines lint/type-check/test and
      deliberately **no** `build` — adding one emits a `dist/` nothing imports (and for module-level singletons, a
      second registry copy = a correctness bug).
7. Deps: internal → `workspace:*`; shared external → `catalog:`; framework/runtime dep for a shared package →
   `peerDependency`.
8. README.md + tests are mandatory.

## Authoritative sources

`AGENTS.MD` → "If adding a new package", "Always-On Rules" (the four-scripts rule + carve-out), "Dependency Rules".
`docs/PACKAGE_CREATION_GUIDE.md`, `packages/premium/README.md` (for paid add-ons). Full docs: `/llms-full.txt`.
