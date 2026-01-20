# Ottabase Monorepo

Modern full-stack monorepo with pnpm workspaces and Turborepo. Deploy to Cloudflare Workers with D1, KV, R2, Queues, and Durable Objects.

## Structure

```
ottabase/
├── apps/
│   └── ottabase-template-app-tanstack/  # TanStack Router + Vite + Workers (primary)
├── packages/
│   ├── ottaorm/       # Fat models, auto-migrations, CRUD
│   ├── db/            # Drizzle D1 driver
│   ├── cf/            # Cloudflare bindings (D1, KV, R2, Queues)
│   ├── queue/         # Job queue (Laravel-style dispatch/handlers)
│   ├── auth/          # Auth.js v5 with D1
│   ├── state/         # Global state (Jotai)
│   ├── ui-shadcn/     # shadcn/ui components
│   ├── ui-mantine/    # Mantine provider + themes
│   ├── ottaupload/    # File uploads (R2, CF Images)
│   ├── ottaeditor/    # EditorJS wrapper
│   ├── cf-realtime/   # WebSocket pub/sub (Durable Objects)
│   ├── shortlinks/    # URL shortener schema
│   ├── referrals/     # Referral tracking
│   └── utils/         # Utilities (timezone, string, file, etc.)
└── turbo.json
```

## Prerequisites

- **Node.js**: `>=24.0.0`
- **pnpm**: `>=10.0.0`
- **Windows Users**: Ensure [Visual C++ Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170#latest-supported-redistributable-version) is installed for builds to work correctly.

## Quick Start

```bash
# Install
pnpm install

# Build packages (required first time)
pnpm build:pkg

# Start dev (Vite + Wrangler)
pnpm dev

# Initialize database
curl -X POST http://localhost:3004/api/ottaorm/init
```

## OttaORM: Fat Models

Central to the codebase. Each model contains schema, validation, relationships, and methods.

### Define Model

```typescript
// ottabase/models/Todo.ts
import { BaseModel } from "@ottabase/ottaorm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const todosTable = sqliteTable("todos", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  completed: integer("completed", { mode: "boolean" }).default(false).notNull(),
  userId: text("user_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export class Todo extends BaseModel {
  static entity = "todos";
  static table = todosTable;
  static primaryKey = "id";

  static casts = {
    completed: "boolean" as const,
    createdAt: "date" as const,
  };

  // Relationship
  async user() {
    const { User } = await import("@ottabase/ottaorm");
    return this.belongsTo(User, "userId");
  }

  // Custom methods
  static async incomplete() {
    return this.where({ completed: false });
  }

  async toggle() {
    this.set("completed", !this.get("completed"));
    return this.save();
  }
}
```

### Export in Schema

```typescript
// ottabase/db/schema.ts
export { usersTable, postsTable } from "@ottabase/ottaorm";  // Core
export { todosTable } from "../models/Todo";                   // App
```

### Use Model

```typescript
import { setDriver } from "@ottabase/ottaorm";
import { createD1Driver } from "@ottabase/db/drizzle-d1";
import { Todo } from "./ottabase/models/Todo";

// In worker
setDriver(createD1Driver(env.OBCF_D1));

// CRUD
const todo = await Todo.create({ title: "Buy groceries" });
const all = await Todo.all();
const one = await Todo.find("id");
await todo.toggle();
await todo.delete();
```

### Auto-Migrations

Tables created automatically from schema:

```bash
curl -X POST http://localhost:3004/api/ottaorm/init
```

Add columns by updating schema and re-running init.

## Client Hooks (TanStack Query)

```typescript
// ottabase/hooks/useTodo.ts
import { createModelHooks } from "@ottabase/ottaorm/client";
import type { TodoType } from "@/ottabase/models/Todo";

export const {
  useList: useTodos,
  useDetail: useTodo,
  useCreate: useCreateTodo,
  useUpdate: useUpdateTodo,
  useDelete: useDeleteTodo,
} = createModelHooks<TodoType>({ entity: "todos" });
```

```tsx
// Usage in component
const { data: todos } = useTodos();
const createTodo = useCreateTodo();
createTodo.mutate({ title: "New Todo" });
```

## Packages

### Database & ORM

| Package | Purpose |
|---------|---------|
| `@ottabase/ottaorm` | Fat models, CRUD, relationships, auto-migrations |
| `@ottabase/db` | Drizzle D1 driver (`createD1Driver`) |
| `@ottabase/cf` | D1, KV, R2, Queues, Rate Limiting wrappers |
| `@ottabase/queue` | Job queue system (dispatch, handlers, deduplication, chaining, priority) |
| `@ottabase/auth` | Auth.js v5 with D1 adapter |

### UI

| Package | Purpose |
|---------|---------|
| `@ottabase/ui-shadcn` | shadcn/ui components, ShadcnProviders |
| `@ottabase/ui-mantine` | Mantine provider, pre-built themes |
| `@ottabase/ui-base` | Framework-agnostic base styles |
| `@ottabase/ottaeditor` | EditorJS with 15 plugins |
| `@ottabase/ottaupload` | File upload (R2, CF Images) |

### State & Utils

| Package | Purpose |
|---------|---------|
| `@ottabase/state` | Jotai atoms (theme, user, sidebar) |
| `@ottabase/utils` | timezone, string, file, url, git utilities |

### Features

| Package | Purpose |
|---------|---------|
| `@ottabase/shortlinks` | URL shortener schema + model |
| `@ottabase/referrals` | Referral tracking system |
| `@ottabase/cf-realtime` | WebSocket pub/sub (Durable Objects) |

## Creating New Apps

```bash
cp -r apps/ottabase-template-app-tanstack apps/my-app
cd apps/my-app
# Update package.json name
# Delete src/pages/demo/
```

## Package with Model Pattern

When a package exports its own table (like `@ottabase/shortlinks`):

### 1. Package exports table

```typescript
// packages/shortlinks/src/schema.ts
export const shortlinksTable = sqliteTable("shortlinks", { ... });
```

### 2. App creates model

```typescript
// apps/my-app/ottabase/models/Shortlink.ts
import { BaseModel } from "@ottabase/ottaorm";
import { shortlinksTable } from "@ottabase/shortlinks/schema";

export class Shortlink extends BaseModel {
  static entity = "shortlinks";
  static table = shortlinksTable;
  // Add app-specific methods...
}
```

### 3. Export in schema

```typescript
// ottabase/db/schema.ts
export { shortlinksTable } from "@ottabase/shortlinks/schema";
```

### 4. Create hooks

```typescript
// ottabase/hooks/useShortlink.ts
import { createModelHooks } from "@ottabase/ottaorm/client";
export const { useList, useCreate, ... } = createModelHooks({ entity: "shortlinks" });
```

## Commands

```bash
pnpm dev              # Start all (Vite + Wrangler)
pnpm build            # Build everything
pnpm build:pkg        # Build packages only
pnpm test             # Run tests
pnpm lint             # Lint
pnpm type-check       # TypeScript check
pnpm storybook        # Component docs
```

## Cloudflare Deployment

```bash
cd apps/ottabase-template-app-tanstack
pnpm wrangler login
pnpm deploy

# Run migrations
curl -X POST https://your-app.workers.dev/api/ottaorm/init \
  -H "Authorization: Bearer ${MIGRATION_SECRET}"
```

## Docs

- [TanStack App README](./apps/ottabase-template-app-tanstack/README.md)
- [OttaORM README](./packages/ottaorm/README.md)
- [Cloudflare Deploy](./CLOUDFLARE_DEPLOY.md)
- [Cloudflare Config](./CLOUDFLARE_CONFIGURATION_GUIDE.md)
- [Testing](./TESTING.md)

---

[![Built on Cloudflare](https://workers.cloudflare.com/built-with-cloudflare.svg)](https://cloudflare.com)
