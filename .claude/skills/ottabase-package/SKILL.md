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

## The manifest (when the package owns a table, a route, a job or a page)

1. Package exports the Drizzle table (`packages/<pkg>/src/schema.ts`, or `src/persistence` for complex packages) and the
   `BaseModel` class, and declares a manifest in `packages/<pkg>/src/manifest.ts`:
   `definePackage({ key, name, version, tables, migrations, models, policies, routes, cron, queue, events, nav, env, health })`
   (`@ottabase/kernel`). Table keys end in `Table`. Expose `createXPackage(extras)` when the host supplies routes.
2. App: add ONE entry to `apps/*/ottabase/packages.ts`. Nothing else is edited. `otta add <pkg> [app]` does it (and
   step 3) from the package's `ottabase` descriptor in package.json
   (`{ key, factory, export?, manifestImport?, tables? }`); give every new package one.
3. App: re-export the table from `ottabase/db/schema.ts` (drizzle-kit), and add a client descriptor to
   `src/ottabase/config/packages.ts` if the package renders admin pages. The packages-registration test checks both.
4. Generic `/api/ottaorm/*` CRUD is default-deny: add the entity to `GENERIC_CRUD_ALLOWLIST`
   (`worker/routes/ottaorm-crud.ts`) only if it should be reachable there, with an RLS policy in the manifest.
5. Inside the manifest graph (handlers, lib code) read the registry from `ottabase/registry.ts`, not from the list.
6. A package that must tell the operator something (a failing poll, a new ticket) takes the app's engine as an optional
   `alerts?: AlertSink<Env>` option (type from `@ottabase/alerts`, never the engine itself) and calls
   `alerts.raise(env, input)`; unset, it logs. Export the mapping (`xAlertInput`) so an app can raise elsewhere. Errors
   thrown from its routes, cron and queue handlers reach alerts on their own through `registry.report()`. Messages to
   the app's users are not alerts: `@ottabase/notifications` or the app mailer. _(Premium packages are the same manifest
   plus licensing. See `docs/PREMIUM_PACKAGES.md`.)_

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
