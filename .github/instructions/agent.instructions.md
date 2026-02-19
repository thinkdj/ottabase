# Ottabase Monorepo - AI Coding Agent Instructions

## Architecture Overview

Monorepo using **pnpm workspaces** + **Turborepo**. TanStack Router + Vite app with Cloudflare Workers deployment.

```
ottabase/
├── apps/
│   └── ottabase-template-app-tanstack/  # Primary app (TanStack + Workers)
├── packages/                            # Shared code
└── turbo.json
```

## Local Development

- **OS**: Windows 11
- **Terminal**: Command Prompt (cmd) - avoid PowerShell due to path issues
- **Runtime**: Node.js 24+
- **Package Manager**: pnpm with workspaces
- **Build**: Turborepo

```bash
pnpm build:pkg    # Build packages first
pnpm dev          # Vite + Wrangler dev
```

## OttaORM: Fat Model System

**Central to the codebase.** All data models inherit from `BaseModel`. Each model is self-contained with:

- Drizzle table schema
- Type casting
- Field metadata (UI config, validation)
- Relationships (belongsTo, hasMany, hasOne, belongsToMany)
- Custom methods

```typescript
import { BaseModel } from '@ottabase/ottaorm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const todosTable = sqliteTable('todos', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    completed: integer('completed', { mode: 'boolean' }).default(false),
    userId: text('user_id'),
});

export class Todo extends BaseModel {
    static entity = 'todos';
    static table = todosTable;
    static primaryKey = 'id';

    static casts = {
        completed: 'boolean' as const,
    };

    async user() {
        const { User } = await import('@ottabase/ottaorm');
        return this.belongsTo(User, 'userId');
    }

    async toggle() {
        this.set('completed', !this.get('completed'));
        return this.save();
    }
}
```

## Schema Collection (3 Sources)

Tables are collected from 3 sources for auto-migrations:

```typescript
// ottabase/db/schemas-helper.ts
export function getAllSchemas() {
  // 1. CORE - from @ottabase/ottaorm (users, posts, auth tables)
  const coreTables = { usersTable, postsTable, sessionsTable, ... };

  // 2. APP - app-specific models
  const appTables = { todosTable };

  // 3. PACKAGES - enabled packages (shortlinks, referrals)
  const packageTables = getEnabledPackageTables();

  return { ...coreTables, ...appTables, ...packageTables };
}
```

## Model Registry (for CRUD API)

Register models for dynamic lookup by entity name:

```typescript
import { registerModels, User, Post, Tag } from '@ottabase/ottaorm';
import { Todo } from './models/Todo';
import { Shortlink } from './models/Shortlink';

// Register all models for /api/ottaorm/{entity} CRUD
registerModels([User, Post, Tag, Todo, Shortlink]);
```

Then generic CRUD works: `GET /api/ottaorm/todos`, `POST /api/ottaorm/shortlinks`, etc.

## Auto-Migrations

Tables created/updated automatically:

```bash
curl -X POST http://localhost:3004/api/ottaorm/init
```

**Capabilities:**

- ✅ Create new tables
- ✅ Add columns to existing tables
- ⚠️ New NOT NULL columns need DEFAULT values
- ❌ Cannot rename/drop columns (use custom migration)

## Client Hooks (TanStack Query)

```typescript
// ottabase/hooks/useTodo.ts
import { createModelHooks } from '@ottabase/ottaorm/client';

export const {
    useList: useTodos,
    useDetail: useTodo,
    useCreate: useCreateTodo,
    useUpdate: useUpdateTodo,
    useDelete: useDeleteTodo,
    useInfiniteList: useTodosInfinite,
} = createModelHooks<TodoType>({ entity: 'todos' });
```

## Key Packages

| Package                 | Purpose                                                           |
| ----------------------- | ----------------------------------------------------------------- |
| `@ottabase/ottaorm`     | Fat models, CRUD, relationships, auto-migrations                  |
| `@ottabase/db`          | Drizzle D1 driver (`createD1Driver`)                              |
| `@ottabase/cf`          | D1, KV, R2, Queues, Rate Limiting wrappers                        |
| `@ottabase/queue`       | Job queue (dispatch, handlers, deduplication, chaining, priority) |
| `@ottabase/auth`        | Auth.js v5 with D1 adapter                                        |
| `@ottabase/ui-shadcn`   | shadcn/ui components                                              |
| `@ottabase/ui-mantine`  | Mantine provider, pre-built themes                                |
| `@ottabase/state`       | Jotai atoms (theme, user, sidebar)                                |
| `@ottabase/utils`       | timezone, string, file, url utilities                             |
| `@ottabase/ottaupload`  | File upload (R2, CF Images)                                       |
| `@ottabase/cf-realtime` | WebSocket pub/sub (Durable Objects)                               |
| `@ottabase/shortlinks`  | URL shortener schema                                              |
| `@ottabase/referrals`   | Referral tracking                                                 |

## Adding New Dependencies

**Decision flow:**

1. **Will multiple packages/apps use this?** → Add to `pnpm-workspace.yaml` catalog
2. **Only one package/app needs it?** → Add directly to that package's `package.json`
3. **Is it a framework/runtime dep for a shared package?** → Add as `peerDependency`

### When to Use Catalog (pnpm-workspace.yaml)

Add to catalog when:

- ✅ Used by 2+ packages/apps (react, typescript, drizzle-orm)
- ✅ Core framework libraries (mantine, tanstack, jotai)
- ✅ Shared tooling (tsup, vitest, eslint)

```yaml
# pnpm-workspace.yaml
catalog:
    react: ^19.1.0
    typescript: ~5.8.4
    drizzle-orm: ^0.44.2
```

Then reference in package.json:

```json
{ "react": "catalog:" }
```

### When to Use Local (package.json only)

Add locally when:

- ✅ Package-specific utility (e.g., `editorjs` only in `ottaeditor`)
- ✅ App-specific tool not needed elsewhere
- ✅ Experimental/testing before promoting to catalog

```bash
# Add to specific package
pnpm add --filter @ottabase/ottaeditor @editorjs/editorjs

# Add to specific app
pnpm add --filter @ottabase/template-app-tanstack some-package
```

### Workspace Protocol

Internal packages always use `workspace:*`:

```json
{ "@ottabase/ottaorm": "workspace:*" }
```

### Peer Dependencies

Shared packages declare framework deps as peers to avoid duplication:

```json
{
    "peerDependencies": {
        "react": "catalog:",
        "drizzle-orm": "catalog:"
    }
}
```

## Adding a New Package with Model

When a package provides its own database table:

### 1. Package: Export schema only

```typescript
// packages/mypackage/src/schema.ts
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const myTable = sqliteTable('mytable', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
});
```

### 2. App: Create model

```typescript
// apps/my-app/ottabase/models/MyModel.ts
import { BaseModel } from '@ottabase/ottaorm';
import { myTable } from '@ottabase/mypackage/schema';

export class MyModel extends BaseModel {
    static entity = 'mytable';
    static table = myTable;
    static primaryKey = 'id';

    // App-specific logic here
}
```

### 3. App: Register in schema

```typescript
// ottabase/db/schema.ts
export { myTable } from '@ottabase/mypackage/schema';
```

### 4. App: Create hooks

```typescript
// ottabase/hooks/useMyModel.ts
import { createModelHooks } from '@ottabase/ottaorm/client';

export const { useList, useCreate, useUpdate, useDelete } = createModelHooks({ entity: 'mytable' });
```

### 5. Run migrations

```bash
curl -X POST http://localhost:3004/api/ottaorm/init
```

## File Locations

| Purpose      | Location                                          |
| ------------ | ------------------------------------------------- |
| Models       | `apps/*/ottabase/models/`                         |
| Schema       | `apps/*/ottabase/db/schema.ts`                    |
| Client hooks | `apps/*/ottabase/hooks/` or `src/ottabase/hooks/` |
| Migrations   | `apps/*/ottabase/migrations/`                     |
| API routes   | `apps/*/cloudflare-worker.ts`                     |
| Pages        | `apps/*/src/pages/`                               |

## TanStack App Structure

```
apps/ottabase-template-app-tanstack/
├── src/
│   ├── pages/         # TanStack Router pages
│   ├── ottabase/      # Client-side config (providers, state, hooks)
│   └── providers/     # React providers wrapper
├── ottabase/
│   ├── db/           # Drizzle schema
│   ├── models/       # OttaORM models
│   └── migrations/   # Database migrations
└── cloudflare-worker.ts  # API routes
```

## Commands Reference

```bash
# Dev
pnpm dev                          # All apps
pnpm dev:worker                   # Worker only

# Build
pnpm build                        # Everything
pnpm build:pkg                    # Packages only
pnpm build --filter=@ottabase/ui-mantine

# Test
pnpm test
pnpm test --filter=@ottabase/ottaorm

# Quality
pnpm lint
pnpm type-check

# Docs
pnpm storybook
```

## Agent Workflow Checklist

1. **Review documentation first** - Read this file and `AGENTS.MD` before making changes to confirm architecture and
   dependency rules.
2. **Install dependencies** with `pnpm install` if needed; never use npm or yarn.
3. **Build packages first** with `pnpm build:pkg` when working with shared code.
4. **For code changes**, run quality checks:
    - `pnpm lint` - Lint all packages
    - `pnpm type-check` - TypeScript validation
    - `pnpm test` - Run tests (use `--filter` to scope: `pnpm test --filter=@ottabase/ottaorm`)
5. **When adding dependencies**, follow the decision flow:
    - Multiple packages/apps will use it → Add to `pnpm-workspace.yaml` catalog first, then reference as `"catalog:"`
    - Single package/app only → Add directly to that package's `package.json`
    - Internal packages → Use `"workspace:*"`
6. **Validate shared changes** don't break `apps/ottabase-template-app-tanstack`:
    - Build the app: `pnpm build --filter=ottabase-template-app-tanstack`
    - Run dev: `pnpm dev` and test affected features
7. **For model changes**, ensure:
    - Model has `static entity` and `static table`
    - Table is exported in `ottabase/db/schema.ts`
    - Model is registered with `registerModels()` if CRUD API needed
    - Run `curl -X POST http://localhost:3004/api/ottaorm/init` to apply migrations

## Anti-Patterns

❌ Circular deps between packages  
❌ Direct file imports across package boundaries  
❌ Framework-specific code in generic packages  
❌ Package-specific lock files  
❌ Implicit dependencies  
❌ Missing type definitions  
❌ Models without `static entity` and `static table`  
❌ Using npm or yarn instead of pnpm
