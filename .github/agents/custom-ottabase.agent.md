# Ottabase Monorepo Agent Instructions

## Architecture
- **Monorepo**: pnpm workspaces + Turborepo
- **Stack**: Next.js 16+, React 19, TypeScript 5+, Cloudflare (Workers, D1, KV, Durable Objects)
- **Structure**: `apps/*` (Next.js apps), `packages/*` (shared packages)
- **Requirements**: Node >=24.0.0, pnpm >=10.0.0

## Key Packages
- **db**: Multi-ORM support (Prisma, Drizzle, MongoDB) with D1/local adapters
- **ottaorm**: Type-safe ORM layer with schema definitions
- **auth**: Auth.js integration with D1 adapters
- **ui-***: UI packages (mantine, shadcn, tailwind, components)
- **ottalayout**: Layout system for applications
- **state**: Global state management with Jotai
- **migrate**: Database migration utilities
- **cf/cf-realtime**: Cloudflare bindings and realtime utilities

## Workflow Commands
```bash
pnpm install                # Install dependencies
pnpm build                  # Build all packages/apps (Turbo cached)
pnpm dev                    # Start template app in dev mode
pnpm dev:all                # Start all apps/packages in dev mode
pnpm type-check             # Type check all packages
pnpm lint                   # Lint all packages
pnpm test                   # Run tests

# Package-specific
pnpm --filter @ottabase/db build
pnpm --filter @ottabase/ottabase-template-app dev
```

## Coding Guidelines
1. **Dependencies**: Use `catalog:` protocol for shared deps in pnpm-workspace.yaml, `workspace:*` for internal packages
2. **Imports**: Use package aliases (`@ottabase/*`), relative imports within same package
3. **TypeScript**: Strict mode enabled, extend from root tsconfig.json
4. **Cloudflare**: Env vars use `OBCF_*` prefix (OBCF_DB, OBCF_KV, etc.)
5. **Database**:
   - Prisma for D1: Use `@ottabase/db` with `PrismaAdapter`
   - OttaORM: Define schemas in `ottaorm/schemas`, use type-safe models
6. **UI**:
   - Mantine components via `@ottabase/ui-mantine`
   - Shadcn components via `@ottabase/ui-shadcn`
   - Use `@ottabase/ui-base` for framework-agnostic styles
7. **State**: Jotai atoms in `@ottabase/state` or app-level `ottabase/state/`
8. **Turbo**: Build tasks have `dependsOn: ["^build"]` for proper ordering

## Critical Patterns
- **No FOUC**: UI packages include FOUC prevention utilities
- **Tree-shakeable**: All packages use ESM + CJS dual format (tsup)
- **D1 Local Dev**: Use `--local` flag with wrangler for local D1 database
- **Prisma Generation**: Run `pnpm --filter @ottabase/db prisma:generate` after schema changes
- **Build Order**: Packages before apps, db/ottaorm before consumers

## Common Tasks
- **New package**: Create in `packages/`, add to workspace, use tsup for bundling
- **New app**: Create in `apps/`, reference packages with `workspace:*`
- **Database migration**: Use `@ottabase/migrate` or Prisma migrations
- **Add dependency**: `pnpm add <pkg> --filter <workspace>` or add to catalog
- **Cloudflare setup**: `pnpm cloudflare:setup` for initial config

## File Locations
- App routing: `apps/*/app/**` (Next.js App Router)
- Package exports: `packages/*/src/index.ts`
- DB schemas: `packages/db/prisma/schema.prisma`, `packages/ottaorm/schemas/**`
- Config: Root-level turbo.json, tsconfig.json, pnpm-workspace.yaml
- Environment: Apps use `.dev.vars` for Cloudflare local dev
