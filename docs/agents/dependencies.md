# Dependency Rules — Agent Runbook

> How dependencies are added in this monorepo. Summary rule: internal = `workspace:*`, shared
> external = `catalog:`.

## Decision flow

1. **Will multiple packages/apps use this?** → Add to `pnpm-workspace.yaml` catalog
2. **Only one package/app needs it?** → Add directly to that package's `package.json`
3. **Is it a framework/runtime dep for a shared package?** → Add as `peerDependency`

## When to use catalog (pnpm-workspace.yaml)

Add to catalog when: used by 2+ packages/apps (react, typescript, drizzle-orm), core framework
libraries (tailwind, tanstack, jotai), or shared tooling (tsup, vitest, eslint).

```yaml
# pnpm-workspace.yaml
catalog:
    react: ^19.2.4
    typescript: ^5.9.3
    drizzle-orm: ^0.38.3
```

Then reference in package.json:

```json
{ "react": "catalog:" }
```

## When to use local (package.json only)

Package-specific utility (e.g., `editorjs` only in `ottaeditor`), app-specific tool, or
experimental dep before promoting to catalog.

```bash
pnpm add --filter @ottabase/ottaeditor @editorjs/editorjs   # to a package
pnpm add --filter @ottabase/otta-web some-package           # to an app
```

## Workspace protocol

Internal packages always use `workspace:*`:

```json
{ "@ottabase/ottaorm": "workspace:*" }
```

## Peer dependencies

Shared packages declare framework deps as peers to avoid duplication:

```json
{
    "peerDependencies": {
        "react": "catalog:",
        "drizzle-orm": "catalog:"
    }
}
```

## Adding to catalog — steps

```bash
# 1. Add to pnpm-workspace.yaml catalog section
# 2. Add to root package.json if needed for scripts
pnpm add -w new-package

# 3. Reference in consuming package.json:  { "new-package": "catalog:" }
# 4. Install
pnpm install
```

## Never

- npm or yarn (pnpm only)
- Package-specific lock files
- Implicit dependencies (import without declaring)
- Direct file imports across package boundaries
