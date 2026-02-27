<INSTRUCTIONS>
# Agents & Architecture

Monorepo using **pnpm workspaces** + **Turborepo**. TanStack Router + Vite app with Cloudflare Workers deployment.

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

## High-Impact Nuances (Agent Checklist)

Use this as the default decision tree when shipping new work.

### If adding a new app feature

1. **CRUD-first via OttaORM**
    - If it is standard entity CRUD, use model + `createModelHooks()` + `/api/ottaorm/{entity}`.
    - Do not introduce custom CRUD endpoints unless there is a real non-CRUD need.
2. **Keep data logic in models**
    - Put domain logic in model methods, not page/component handlers.
3. **Theme-safe UI**
    - Prefer design tokens/CSS variables and existing UI packages (`@ottabase/ui-shadcn`, `@ottabase/ui-mantine`).
    - Avoid hardcoded one-off colors/sizes that bypass theme runtime.
4. **Cloudflare edge-safe code**
    - Avoid Node-only APIs in app/worker code.
5. **Minimal route logic**
    - Worker routes should orchestrate/auth/validate; model should own persistence behavior.
6. **Docs + tests are required**
    - Every new feature must create/update its respective `README.MD` and include/update tests.

### If adding a new package

1. **Persistence decision first**
    - No DB persistence: keep package framework-agnostic and stateless where possible.
    - Needs DB persistence: follow OttaORM split below.
2. **OttaORM persistence split (required)**
    - Package exports table schema (`packages/<pkg>/src/schema.ts`).
    - App owns the `BaseModel` class (`apps/*/ottabase/models/*`).
    - App exports table from `apps/*/ottabase/db/schema.ts`.
    - Ensure schema collector includes it for init/migrations.
    - Register model for generic CRUD if entity should be API-accessible.
3. **Dependency protocol**
    - Internal deps: `workspace:*`
    - Shared external deps: `catalog:`
4. **Docs + tests are required**
    - Every new package must create/update its own `README.MD` and include/update tests.

### Quick examples

```typescript
// App feature CRUD hooks (preferred for basic CRUD)
import { createModelHooks } from '@ottabase/ottaorm/client';
export const { useList, useCreate, useUpdate, useDelete } = createModelHooks({ entityName: 'todos' });
```

```typescript
// Fat model method (preferred over route/controller business logic)
export class Todo extends BaseModel {
    static entity = 'todos';
    static table = todosTable;
    async markDone() {
        this.set('completed', true);
        return this.save();
    }
}
```

## Structure

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

## Core Concepts

### OttaORM: Fat Model System

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

### Schema Collection (3 Sources)

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

### Model Registry (for CRUD API)

Register models for dynamic lookup by entity name:

```typescript
import { registerModels, User, Post, Tag } from '@ottabase/ottaorm';
import { Todo } from './models/Todo';
import { Shortlink } from './models/Shortlink';

// Register all models for /api/ottaorm/{entity} CRUD
registerModels([User, Post, Tag, Todo, Shortlink]);
```

Then generic CRUD works: `GET /api/ottaorm/todos`, `POST /api/ottaorm/shortlinks`, etc.

### Auto-Migrations

Tables created/updated automatically:

```bash
curl -X POST http://localhost:3004/api/ottaorm/init
```

**Capabilities:**

- Create new tables
- Add columns to existing tables
- New NOT NULL columns need DEFAULT values
- Cannot rename/drop columns (use custom migration)

### Client Hooks

TanStack Query hooks generated from models:

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

// Usage:
// const { data: todo } = useTodoBySlug("slug", "my-todo-slug");
```

## Package Guide

### @ottabase/ottaorm

Fat model ORM. Core models: User, Post, Tag, Account, Session.

```typescript
import { BaseModel, setDriver, autoInit, collectTableSchemas, User, Post, Tag } from '@ottabase/ottaorm';
```

### @ottabase/db

D1 database driver.

```typescript
import { createD1Driver } from '@ottabase/db/drizzle-d1';

const driver = createD1Driver(env.OBCF_D1);
setDriver(driver);
```

### @ottabase/cf

Cloudflare service wrappers.

```typescript
import { createD1Client } from '@ottabase/cf/d1';
import { createKVClient } from '@ottabase/cf/kv';
import { createR2Client } from '@ottabase/cf/r2';
import { createRateLimitingClient } from '@ottabase/cf/rate-limiting';
```

### @ottabase/auth

Auth.js v5 with D1.

```typescript
import { createOttabaseAuthConfig, createGoogleProvider } from '@ottabase/auth';

const config = createOttabaseAuthConfig({
    d1: env.OBCF_D1,
    providers: [createGoogleProvider(env)],
});
```

### @ottabase/state

Global state (Jotai).

```typescript
import { createDefaultAppState } from '@ottabase/state';

const { appStateAtom, atoms } = createDefaultAppState();
export const { themeAtom, userAtom, scaleAtom } = atoms;
```

### @ottabase/utils

Utilities with tree-shakeable imports.

```typescript
import { toUTC, formatInUserTimezone } from '@ottabase/utils/timezone';
import { makeSlug, isValidUrl } from '@ottabase/utils/url';
import { changeCase, isEmail } from '@ottabase/utils/string';
```

### @ottabase/ottablog

Blog engine core logic and models.

```typescript
import { Post, Tag } from '@ottabase/ottablog';
```

### @ottabase/queue

Laravel-style job queue for Cloudflare Queues.

```typescript
import { dispatch, createRegistry, createQueueHandler } from '@ottabase/queue';

// Dispatch jobs
await dispatch(env.MY_QUEUE, 'send-email', { to: 'user@example.com' });

// With deduplication, chaining, priority
await dispatcher.dispatch('sync-user', payload, {
    uniqueKey: 'user-123', // Deduplication
    priority: 'high', // Priority queues
    then: [{ type: 'notify' }], // Job chaining
});

// Process jobs
const registry = createRegistry<Env>().register('send-email', async (job, ctx) => {
    /* handler */
});

export default { queue: createQueueHandler(registry) };
```

### @ottabase/cf-realtime

WebSocket pub/sub (Pusher alternative).

```typescript
// Client
import { RealtimeClient } from '@ottabase/cf-realtime';
client.subscribe('channel', (event, data) => {});

// Server
import { RealtimeBroadcaster } from '@ottabase/cf-realtime/server';
await broadcaster.send('channel', 'event', { data });
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

## Dependency Rules

### Adding New Dependencies

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

## File Locations

| Purpose      | Location                                          |
| ------------ | ------------------------------------------------- |
| Models       | `apps/*/ottabase/models/`                         |
| Schema       | `apps/*/ottabase/db/schema.ts`                    |
| Client hooks | `apps/*/ottabase/hooks/` or `src/ottabase/hooks/` |
| Migrations   | `apps/*/ottabase/migrations/`                     |
| API routes   | `apps/*/cloudflare-worker.ts`                     |
| Pages        | `apps/*/src/pages/`                               |

## Anti-Patterns

- Circular deps between packages
- Direct file imports across package boundaries
- Framework-specific code in generic packages
- Package-specific lock files
- Implicit dependencies
- Missing type definitions
- Models without `static entity` and `static table`

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

## VS Code

Install recommended extensions in `.vscode/extensions.json` for Prettier format-on-save.

### IMPORTANT NOTES FOR CODING AGENTS

- **Build commands:** Agents should only run build and test commands for a particular package using the `--filter` flag
  (e.g., `pnpm build:pkg --filter=<package>` or `pnpm test --filter=<package>`). Do not run full app builds
  (`pnpm build`, `pnpm dev`, etc.) unless you are a cloud agent; only cloud agents may execute full builds or dev
  workflows. Local development user is responsible for running full app builds, and shall share output with the agent as
  required.
- Do not make stray .MD files after a task (like SUMMARY.MD)
- Add comments in code snippets to explain what they do, especially for complex logic.
- `README.MD`s should be concise, and with examples. Don't be too verbose. Keep text sharply focused on the task at
  hand, and avoid unnecessary background information, tangents or noise. Do not add Possible Issues or Troubleshooting
  sections unless they are directly relevant to the task.
- Use consistent formatting and indentation in code snippets (check `.prettierrc`).
- Make tests for new features, modify existing ones if needed, and ensure they pass before marking a task as complete.
- When adding new packages, ensure they follow the same structure and conventions as existing ones for consistency.
- UI must follow minimal design, and use components from `@ottabase/ui-shadcn` where possible to maintain a cohesive
  look and feel across the app. If a new Component that requires design is to be made, add tailwind classes in the
  component, and avoid adding new CSS files unless absolutely necessary.
- New UI created should feel native to the app, and not like a separate module. Design like GitHub's or Notion's pages -
  simple, clean, and functional.
- Golden Rule throughout the repo: KISS, DRY, SIMPLEST SOLUTIONS, and always think about the developer experience for
  future maintainers (including yourself in 6 months).
- When writing code snippets in documentation, ensure they are complete and can be copy-pasted without modification.
  Include necessary imports and context.

### CI / PR Checklist

- **CI:** Run `pnpm build:pkg && pnpm test --filter=@ottabase/ottaorm` before opening a PR.
- **Checks:** Ensure `pnpm lint` and `pnpm type-check` pass locally or in CI.
- **Formatting:** Ensure Prettier formatting is applied; enforce via pre-commit hooks (`husky` + `lint-staged`).
- **PR Description:** Add a short summary, list affected packages, testing notes, and any required migration steps.

### Maintainers / Contacts

- **Maintainer:** @thinkdj: architecture questions & exceptions.
- **Escalation:** Open an issue with the `architecture` label or ping the `#dev-ops` channel for urgent infra problems.

### Formatting / Pre-commit

- **Format command:** `pnpm format` (runs `prettier --write .` on the whole repo).
- **Pre-commit:** We recommend `husky` + `lint-staged` to run format and basic lint on staged files.

</INSTRUCTIONS>
