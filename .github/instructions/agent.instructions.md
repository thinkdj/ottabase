# Ottabase Monorepo - AI Coding Agent Instructions

> **Reference:** See `AGENTS.MD` at repo root for full architecture and package details.

## AI Guidelines (MUST FOLLOW)

1. **OttaORM First**: All data models MUST inherit from `BaseModel`. Do not write raw SQL or vanilla Drizzle queries
   unless absolutely necessary for performance. Logic belongs in the Model class, not in "Controllers" or "Services".
2. **Schema Integrity**: Drizzle schema lives in `apps/*/ottabase/db/schema.ts`. Export all tables there. Package tables
   come from package schemas (e.g. `@ottabase/shortlinks/schema`) and are wired via `schemas-helper.ts`.
3. **Workspace Protocol**: Always use `workspace:*` for internal package dependencies. Use `catalog:` for shared
   external dependencies (React, Drizzle, etc.).
4. **Don't Reinvent**: Check `@ottabase/utils` for internal helpers (date, string, currency) and `@ottabase/ui-shadcn`
   for UI components before creating new ones.
5. **Edge Runtime**: This is a Cloudflare Workers project. Avoid Node.js-only APIs (fs, child_process) in app code.
6. **Fat Models**: Encapsulate logic in models. E.g., `user.activate()` instead of `authService.activate(user)`.

## Implementation Nuances (Do This by Default)

### New feature in app

1. Use OttaORM CRUD first:
    - Prefer `createModelHooks()` + `/api/ottaorm/{entity}` for basic CRUD.
    - Add custom endpoints only for non-CRUD workflows.
2. Keep business/data logic inside `BaseModel` methods.
3. Reuse `@ottabase/ui-shadcn` and existing theme tokens/variables.
4. Keep worker code edge-compatible (no Node-only APIs).
5. Keep route handlers thin (auth/validation/orchestration), not data-heavy.
6. Every new feature must create/update its respective `README.MD` and include/update tests.

### New package

1. Decide if persistence is needed before coding:
    - If no persistence: keep package stateless/framework-agnostic.
    - If persistence: package exports schema; app owns `BaseModel`.
2. For persistence packages, always complete all wiring:
    - Export table from package `src/schema.ts`
    - Export table in app `ottabase/db/schema.ts`
    - Ensure schema collection includes table for init/migrations
    - Register model if generic CRUD API should expose the entity
3. Use dependency protocol:
    - Internal packages: `workspace:*`
    - Shared externals: `catalog:`
4. Every new package must create/update its own `README.MD` and include/update tests.

### Short examples

```typescript
// Basic CRUD hook setup (preferred path)
const hooks = createModelHooks({ entityName: 'shortlinks' });
```

```typescript
// Model-centric domain logic
await shortlink.rotateSlug();
```

---

## Architecture Overview

Monorepo using **pnpm workspaces** + **Turborepo**. TanStack Router + Vite app with Cloudflare Workers deployment.

```
ottabase/
├── apps/
│   └── ottabase-template-app-tanstack/  # Primary app (TanStack + Workers)
└── packages/                            # Shared code
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

- Create new tables
- Add columns to existing tables
- New NOT NULL columns need DEFAULT values
- Cannot rename/drop columns (use custom migration)

## Client Hooks (TanStack Query)

```typescript
// ottabase/hooks/useTodo.ts
import { createModelHooks } from '@ottabase/ottaorm/client';

export const {
    useList: useTodos,
    useDetail: useTodo,
    useFind: useTodoBySlug, // Find by field/value (e.g., slug, email)
    useCreate: useCreateTodo,
    useUpdate: useUpdateTodo,
    useDelete: useDeleteTodo,
    useInfiniteList: useTodosInfinite,
} = createModelHooks<TodoType>({ entityName: 'todos' });

// Usage: const { data: todo } = useTodoBySlug("slug", "my-todo-slug");
```

## Key Packages

| Package                 | Purpose                                                           |
| ----------------------- | ----------------------------------------------------------------- |
| `@ottabase/ottaorm`     | Fat models, CRUD, relationships, auto-migrations                  |
| `@ottabase/db`          | Drizzle D1 driver (`createD1Driver`)                              |
| `@ottabase/cf`          | D1, KV, R2, Queues, Rate Limiting wrappers                        |
| `@ottabase/auth`        | Auth.js v5 with D1 adapter                                        |
| `@ottabase/ui-shadcn`   | shadcn/ui components - use before custom UI                       |
| `@ottabase/ui-mantine`  | Mantine provider, pre-built themes                                |
| `@ottabase/state`       | Jotai atoms (theme, user, sidebar)                                |
| `@ottabase/utils`       | timezone, string, file, url - check before new helpers            |
| `@ottabase/queue`       | Job queue (dispatch, handlers, deduplication, chaining, priority) |
| `@ottabase/ottablog`    | Blog engine (Post, Tag)                                           |
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

- Used by 2+ packages/apps (react, typescript, drizzle-orm)
- Core framework libraries (mantine, tanstack, jotai)
- Shared tooling (tsup, vitest, eslint)

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

### When to Use Local (package.json only)

Add locally when:

- Package-specific utility (e.g., `editorjs` only in `ottaeditor`)
- App-specific tool not needed elsewhere
- Experimental/testing before promoting to catalog

```bash
# Add to specific package
pnpm add --filter @ottabase/ottaeditor @editorjs/editorjs

# Add to specific app
pnpm add --filter @ottabase/ottabase-template-app-tanstack some-package
```

### Adding to Catalog Steps

```bash
# 1. Add to pnpm-workspace.yaml catalog section
# 2. Add to root package.json if needed for scripts
pnpm add -w new-package

# 3. Reference in consuming package.json
{ "new-package": "catalog:" }

# 4. Install
pnpm install
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

export const { useList, useCreate, useUpdate, useDelete } = createModelHooks({ entityName: 'mytable' });
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
pnpm test --filter=@ottabase/ottaorm

# Quality
pnpm lint
pnpm type-check

# Docs
pnpm storybook
```

---

## IMPORTANT NOTES FOR CODING AGENTS

- **Build commands:** Agents should only run build and test commands for a particular package using the `--filter` flag
  (e.g., `pnpm build:pkg --filter=<package>` or `pnpm test --filter=<package>`). Do not run full app builds
  (`pnpm build`, `pnpm dev`, etc.) unless you are a cloud agent; only cloud agents may execute full builds or dev
  workflows. Local development user is responsible for running full app builds, and shall share output with the agent as
  required.
- Do not make stray .MD files after a task (like SUMMARY.MD).
- Add comments in code snippets to explain what they do, especially for complex logic.
- `README.MD`s should be concise, with examples. Don't be too verbose. Keep text sharply focused on the task at hand. Do
  not add Possible Issues or Troubleshooting sections unless directly relevant.
- Use consistent formatting and indentation in code snippets (check `.prettierrc`).
- Make tests for new features, modify existing ones if needed, and ensure they pass before marking a task as complete.
- When adding new packages, ensure they follow the same structure and conventions as existing ones.
- **UI:** Minimal design; use components from `@ottabase/ui-shadcn` where possible. Add tailwind classes in components;
  avoid new CSS files unless absolutely necessary. New UI should feel native (GitHub/Notion style - simple, clean,
  functional). Always add dark mode classes.
- **Golden Rule:** KISS, DRY, SIMPLEST SOLUTIONS. Think about developer experience for future maintainers.
- Code snippets in documentation: complete and copy-paste ready; include necessary imports and context.

## Agent Workflow Checklist

1. **Review documentation first** - Read this file and `AGENTS.MD` before making changes.
2. **Install dependencies** with `pnpm install` if needed; never use npm or yarn.
3. **Build packages first** with `pnpm build:pkg` when working with shared code.
4. **For code changes**, run quality checks:
    - `pnpm lint` - Lint all packages
    - `pnpm type-check` - TypeScript validation
    - `pnpm test --filter=<package>` - Run tests scoped to the package you changed
5. **When adding dependencies**, follow the decision flow above.
6. **For model changes**, ensure:
    - Model has `static entity` and `static table`
    - Table is exported in `ottabase/db/schema.ts`
    - Model is registered with `registerModels()` if CRUD API needed
    - Run `curl -X POST http://localhost:3004/api/ottaorm/init` to apply migrations

## CI / PR Checklist

- **CI:** Run `pnpm build:pkg && pnpm test --filter=@ottabase/ottaorm` before opening a PR.
- **Checks:** Ensure `pnpm lint` and `pnpm type-check` pass locally or in CI.
- **Formatting:** Ensure Prettier formatting is applied (`pnpm format`). Enforce via pre-commit (husky + lint-staged).
- **PR Description:** Short summary, list affected packages, testing notes, migration steps if any.

## Formatting / Pre-commit

- **Format command:** `pnpm format` (runs `prettier --write .` on the whole repo).
- **Pre-commit:** Husky + lint-staged run format and basic lint on staged files.

## Anti-Patterns

- Circular deps between packages
- Direct file imports across package boundaries
- Framework-specific code in generic packages
- Package-specific lock files
- Implicit dependencies
- Missing type definitions
- Models without `static entity` and `static table`
- Using npm or yarn instead of pnpm
- Logic in Controllers/Services instead of models
- Stray SUMMARY.MD or noise docs after tasks

## Maintainers

- **Maintainer:** @thinkdj - architecture questions & exceptions.
- **Escalation:** Open an issue with the `architecture` label or ping `#dev-ops` for urgent infra problems.
