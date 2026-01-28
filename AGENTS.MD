# Agents & Architecture Guide

A comprehensive monorepo for **solo SaaS founders** using pnpm workspaces + Turborepo. Deploy to Cloudflare Workers with D1, KV, R2, Queues, Durable Objects.

## Structure Overview

```
ottabase/
├── apps/
│   ├── ottabase-template-app-tanstack/  # PRIMARY: TanStack Router + Vite (copy for new apps)
│   └── ottabase-template-app/           # LEGACY: Next.js template (reference only)
├── packages/                            # Shared code (29+ packages)
├── pnpm-workspace.yaml                  # Dependency catalog
└── turbo.json                           # Build orchestration
```

## Development Environment

| Item | Value |
|------|-------|
| **OS** | Windows 11 (use cmd, avoid PowerShell for path issues) |
| **Node.js** | >=24.0.0 |
| **Package Manager** | pnpm >=10.0.0 with workspaces |
| **Build** | Turborepo |
| **Test** | Vitest |

### Essential Commands

```bash
pnpm install           # Install all dependencies
pnpm build:pkg         # Build packages first (REQUIRED before dev)
pnpm dev               # Start all dev servers
pnpm dev:fe            # Frontend only (Vite)
pnpm dev:be            # Backend only (Wrangler)
pnpm test              # Run tests
pnpm lint              # Lint check
pnpm type-check        # TypeScript check
pnpm storybook         # Component docs
```

---

## CRITICAL: OttaORM Fat Model System

**This is the most important pattern in the codebase.** All database models MUST follow the Fat Model pattern.

### What is a Fat Model?

A Fat Model contains everything in one class:
- Drizzle table schema
- Type casting
- Field metadata (UI config, validation)
- Relationships (belongsTo, hasMany, hasOne, belongsToMany)
- Custom query methods
- Business logic

### Defining a Model

```typescript
import { BaseModel, ModelFields } from "@ottabase/ottaorm";
import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// 1. Define table schema FIRST
export const todosTable = sqliteTable("todos", {
	id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
	title: text("title").notNull(),
	completed: integer("completed", { mode: "boolean" }).default(false).notNull(),
	userId: text("user_id"),
	appId: text("app_id"),  // For multi-app DB sharing (optional)
	createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`).$onUpdate(() => new Date()),
});

// 2. Define model class
export class Todo extends BaseModel {
	// REQUIRED: Entity name (used for API routes)
	static entity = "todos";

	// REQUIRED: Reference to table schema
	static table = todosTable;

	// REQUIRED: Primary key field name
	static primaryKey = "id";

	// Type casting (automatic conversion)
	static casts = {
		completed: "boolean" as const,
		createdAt: "date" as const,
		updatedAt: "date" as const,
	};

	// Default values
	protected static defaults = {
		completed: false,
	};

	// Field metadata (for UI generation)
	protected static fields: ModelFields = {
		title: {
			type: "string",
			editable: true,
			searchable: true,
			sortable: true,
			uiConfig: {
				label: "Title",
				placeholder: "What needs to be done?",
			},
			validation: {
				rules: "required",
				messages: { required: "Title is required" },
			},
		},
		// ... more fields
	};

	// Relationship: belongs to User
	async user(select?: string[]) {
		const { User } = await import("@ottabase/ottaorm");
		return this.belongsTo(User, "userId", { select });
	}

	// Custom static method
	static async incomplete() {
		return this.where({ completed: false });
	}

	// Custom instance method
	async toggle() {
		this.set("completed", !this.get("completed"));
		return this.save();
	}
}
```

### Using Models

```typescript
import { setDriver, registerConnection, registerModels } from "@ottabase/ottaorm";
import { createD1Driver } from "@ottabase/db/drizzle-d1";
import { Todo } from "./ottabase/models/Todo";

// In Cloudflare Worker - MUST initialize driver first
registerConnection("default", createD1Driver(env.OBCF_D1));

// Register models for generic CRUD API
registerModels([Todo, User, Post]);

// CRUD operations
const todo = await Todo.create({ title: "Buy groceries" });
const all = await Todo.all();
const one = await Todo.find("id-123");
const filtered = await Todo.where({ completed: false });
await todo.toggle();
await todo.delete();

// Pagination
const result = await Todo.paginate(1, 10, { completed: false }, {
	orderBy: "createdAt",
	orderDirection: "desc"
});
```

---

## Package Categories & Patterns

### Core ORM & Database

| Package | Purpose | Key Exports |
|---------|---------|-------------|
| `@ottabase/ottaorm` | Fat model ORM | `BaseModel`, `registerModels`, `autoInit`, `handleCrud`, `User`, `Post`, `Tag` |
| `@ottabase/db` | Database drivers | `createD1Driver` |

**Pattern: Packages that need DB tables MUST use OttaORM model approach**

```typescript
// ❌ WRONG: Package creates its own DB layer
import { drizzle } from "drizzle-orm";

// ✅ CORRECT: Package exports fat model with schema
export class MyFeature extends BaseModel {
	static entity = "myfeature";
	static table = myFeatureTable;
}
```

### Cloudflare Services (`@ottabase/cf`)

```typescript
// D1 (SQLite)
import { createD1Client } from "@ottabase/cf/d1";

// KV (Key-Value)
import { createKVClient } from "@ottabase/cf/kv";
const kv = createKVClient({ namespace: env.OBCF_KV });
await kv.put("key", "value", { expirationTtl: 3600 });
const result = await kv.getText("key");

// R2 (Object Storage)
import { createR2Client } from "@ottabase/cf/r2";

// Queues
import { createQueuesClient } from "@ottabase/cf/queues";

// Rate Limiting
import { createRateLimitingClient } from "@ottabase/cf/rate-limiting";

// Images (Cloudflare Images API)
import { createImagesClient } from "@ottabase/cf/images";
```

### Queue System (`@ottabase/queue`)

Laravel-style job queue for background processing:

```typescript
import { dispatch, dispatchBatch, createRegistry, createQueueHandler } from "@ottabase/queue";

// Dispatch jobs
await dispatch(env.MY_QUEUE, "send-email", { to: "user@example.com" });

// With options
await dispatch(env.MY_QUEUE, "process-order", { orderId: 123 }, {
	delay: 60,              // Delay in seconds
	maxAttempts: 5,         // Retry count
	uniqueKey: "order-123", // Deduplication
	priority: "high",       // Priority queues
	then: [{ type: "send-receipt", payload: { orderId: 123 } }] // Job chaining
});

// Register handlers
const registry = createRegistry<Env>()
	.register("send-email", async (job, ctx) => {
		await sendEmail(job.payload.to);
	})
	.register("process-order", async (job, ctx) => {
		await processOrder(job.payload.orderId, ctx.env.DB);
	});

// Export in worker
export default {
	fetch: handleRequest,
	queue: createQueueHandler(registry, {
		chainQueue: env.MY_QUEUE,
		onFailure: async (job, error, env) => {
			await storeToDLQ(env.KV, job, error);
		}
	}),
};
```

### Cron System (`@ottabase/cron`)

```typescript
import { createCronHandler, createScheduler } from "@ottabase/cron";

// Static handler (code-defined)
const cron = createCronHandler<Env>()
	.on("0 0 * * *", async ({ env }) => {
		await cleanupSessions(env.DB);
	});

// DB Scheduler (Laravel-style)
const scheduler = createScheduler<Env>()
	.handler("cleanup:sessions", async ({ env }) => {
		// Handler logic
	});

export default {
	scheduled: cron.handler,
};
```

### Authentication (`@ottabase/auth`)

Auth.js v5 integration for Cloudflare D1:

```typescript
import { createOttabaseAuthConfig, createGoogleProvider, handleAuthRequest } from "@ottabase/auth";

// Configure auth
const config = createOttabaseAuthConfig({
	d1: env.OBCF_D1,
	providers: [createGoogleProvider(env)],
});

// Handle auth routes in worker
if (url.pathname.startsWith("/api/auth/")) {
	return handleAuthRequest(request, env);
}
```

### State Management (`@ottabase/state`)

Jotai-based global state:

```typescript
import { createAppState, ProviderState } from "@ottabase/state";

const { appStateAtom, atoms } = createAppState({
	appName: "My App",
	initialState: { theme: "dark" },
});

export const { themeAtom, userAtom, sidebarOpenAtom } = atoms;

// In components
import { useAtom, useAtomValue, useSetAtom } from "jotai";
const theme = useAtomValue(themeAtom);
```

### UI Packages

| Package | Purpose | Usage |
|---------|---------|-------|
| `@ottabase/ui-shadcn` | shadcn/ui components | `import { Button } from "@ottabase/ui-shadcn/button"` |
| `@ottabase/ui-mantine` | Mantine themes/providers | `import { ProviderUIMantine } from "@ottabase/ui-mantine"` |
| `@ottabase/ui-base` | Framework-agnostic styles | Base CSS imports |
| `@ottabase/ui-components` | Shared components | Buttons, inputs, layouts |
| `@ottabase/ui-tailwind` | Tailwind base config | Extend in tailwind.config.cjs |

**Design Priority:** Tailwind classes > shadcn components > Mantine components > Tremor.so

**Icons:** Use `@tabler/icons-react`. Lucide and Radix icons as fallback.

**Dark Mode:** ALWAYS add dark mode classes when creating/modifying UI.

### Feature Packages (with DB Models)

These packages export fat models that apps must register:

| Package | Model | Table | Purpose |
|---------|-------|-------|---------|
| `@ottabase/shortlinks` | `Shortlink` | `shortlinks` | URL shortener |
| `@ottabase/referrals` | `ReferralTracking` | `referral_tracking` | Referral tracking |
| `@ottabase/ottablog` | `BlogPost`, `BlogCategory`, `BlogTag`, `BlogSeries` | `blog_*` | Blog CMS |

**Pattern for feature packages:**

```typescript
// 1. Package exports model
// packages/shortlinks/src/Shortlink.ts
export class Shortlink extends BaseModel {
	static entity = "shortlinks";
	static table = shortlinksTable;
	// ... full model with fields, methods
}

// 2. App registers model
// apps/my-app/cloudflare-worker.ts
import { Shortlink } from "@ottabase/shortlinks";
registerModels([Shortlink, User, Post]);

// 3. App exports table in schema (for migrations)
// apps/my-app/ottabase/db/schema.ts
export { shortlinksTable } from "@ottabase/shortlinks";

// 4. App creates hooks (optional)
// apps/my-app/ottabase/hooks/useShortlink.ts
import { createModelHooks } from "@ottabase/ottaorm/client";
export const { useList, useCreate } = createModelHooks({ entity: "shortlinks" });
```

### Utility Packages

| Package | Purpose | Key Imports |
|---------|---------|-------------|
| `@ottabase/utils` | General utilities | `import { formatInUserTimezone } from "@ottabase/utils/timezone"` |
| `@ottabase/config` | App configuration | `import { createAppConfig } from "@ottabase/config"` |
| `@ottabase/api` | Fetch wrapper | `import { api } from "@ottabase/api"` |
| `@ottabase/email` | Email templating | `import { sendTemplatedEmail } from "@ottabase/email"` |

### Content & Media

| Package | Purpose |
|---------|---------|
| `@ottabase/ottaeditor` | EditorJS wrapper with 15 plugins |
| `@ottabase/ottarenderer` | Render EditorJS content |
| `@ottabase/ottaupload` | File uploads (R2, CF Images) |
| `@ottabase/ottaselect` | Searchable select component |
| `@ottabase/forms` | Auto-generated CRUD forms from model metadata |

### Realtime (`@ottabase/cf-realtime`)

Pusher alternative using Cloudflare Durable Objects:

```typescript
// Client
import { RealtimeClient } from "@ottabase/cf-realtime";
const client = new RealtimeClient({ url: "wss://your-worker/realtime" });
client.subscribe("channel", (event, data) => console.log(event, data));

// Server
import { RealtimeBroadcaster } from "@ottabase/cf-realtime/server";
const broadcaster = new RealtimeBroadcaster(env.OBCF_REALTIME);
await broadcaster.send("channel", "event", { data }, { persistForOffline: true });
```

---

## Schema & Migration System

### Three Schema Sources

Tables are collected from 3 sources for auto-migrations:

```typescript
// ottabase/db/schemas-helper.ts
export function getAllSchemas() {
	// 1. CORE - from @ottabase/ottaorm
	const coreTables = { usersTable, postsTable, sessionsTable, ... };

	// 2. APP - app-specific models
	const appTables = { todosTable };

	// 3. PACKAGES - enabled feature packages
	const packageTables = { shortlinksTable, referralTrackingTable };

	return { ...coreTables, ...appTables, ...packageTables };
}
```

### Running Migrations

```bash
# Development
curl -X POST http://localhost:3004/api/ottaorm/init

# Production (requires MIGRATION_SECRET)
curl -X POST https://your-app.workers.dev/api/ottaorm/init \
  -H "Authorization: Bearer ${MIGRATION_SECRET}"
```

**Capabilities:**
- ✅ Create new tables
- ✅ Add columns to existing tables
- ⚠️ New NOT NULL columns need DEFAULT values
- ❌ Cannot rename/drop columns (use custom migration)

---

## Creating a New App

```bash
# Copy template
cp -r apps/ottabase-template-app-tanstack apps/my-new-app
cd apps/my-new-app

# Update package.json name
# Delete src/pages/demo/ (demo content)
# Update wrangler.jsonc with your bindings
# Run migrations: curl -X POST http://localhost:3004/api/ottaorm/init
```

---

## Creating a New Package

### Package Structure

```
packages/my-package/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts           # Barrel exports
│   ├── MyFeature.ts       # Main code
│   └── __tests__/         # Tests
└── dist/                  # Generated (gitignored)
```

### package.json Template

```json
{
  "name": "@ottabase/my-package",
  "version": "1.0.0",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    }
  },
  "sideEffects": false,
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts --clean",
    "dev": "tsup src/index.ts --format cjs,esm --dts --watch",
    "test": "vitest"
  },
  "dependencies": {
    "@ottabase/config": "workspace:*"
  },
  "peerDependencies": {
    "react": ">=18.0.0"
  },
  "devDependencies": {
    "typescript": "catalog:",
    "tsup": "catalog:"
  }
}
```

### If Package Needs Database

**MUST** use OttaORM fat model pattern:

```typescript
// packages/my-package/src/MyFeature.ts
import { BaseModel, ModelFields } from "@ottabase/ottaorm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const myFeatureTable = sqliteTable("my_feature", {
	id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
	name: text("name").notNull(),
	appId: text("app_id"), // Multi-app support
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export class MyFeature extends BaseModel {
	static entity = "my_feature";
	static table = myFeatureTable;
	static primaryKey = "id";

	static casts = {
		createdAt: "date" as const,
	};

	protected static fields: ModelFields = {
		name: {
			type: "string",
			editable: true,
			searchable: true,
			uiConfig: { label: "Name" },
			validation: { rules: "required" },
		},
	};
}

// packages/my-package/src/index.ts
export { MyFeature, myFeatureTable } from "./MyFeature";
```

---

## Dependency Management

### Catalog (pnpm-workspace.yaml)

Add to catalog when used by 2+ packages:

```yaml
catalog:
  react: ^19.2.3
  drizzle-orm: ^0.38.3
  typescript: ^5.9.3
```

Reference in package.json: `"react": "catalog:"`

### Workspace Protocol

Internal packages always use workspace:*:

```json
{ "@ottabase/ottaorm": "workspace:*" }
```

### Adding Dependencies

```bash
# To specific package
pnpm add --filter @ottabase/my-package some-library

# To root (dev tools)
pnpm add -w some-dev-tool

# Then reference in package.json
```

---

## File Locations Reference

| Purpose | Location |
|---------|----------|
| Models | `apps/*/ottabase/models/` |
| Schema exports | `apps/*/ottabase/db/schema.ts` |
| Schema helpers | `apps/*/ottabase/db/schemas-helper.ts` |
| Client hooks | `apps/*/src/ottabase/hooks/` |
| Custom migrations | `apps/*/ottabase/migrations/` |
| API routes | `apps/*/cloudflare-worker.ts` |
| Pages | `apps/*/src/pages/` |
| Providers | `apps/*/src/providers/` or `apps/*/src/ottabase/providers/` |
| Global state | `apps/*/src/ottabase/state/` |
| App config | `apps/*/src/ottabase/config/` |

---

## Client Hooks Pattern

Generate TanStack Query hooks from models:

```typescript
// apps/my-app/src/ottabase/hooks/useTodo.ts
import { createModelHooks } from "@ottabase/ottaorm/client";
import type { TodoType } from "@/ottabase/models/Todo";

export const {
	useList: useTodos,
	useDetail: useTodo,
	useCreate: useCreateTodo,
	useUpdate: useUpdateTodo,
	useDelete: useDeleteTodo,
	useInfiniteList: useTodosInfinite,
} = createModelHooks<TodoType>({ entity: "todos" });

// Usage in components
const { data: todos } = useTodos();
const createTodo = useCreateTodo();
createTodo.mutate({ title: "New Todo" });
```

---

## API Patterns

### Generic CRUD (Automatic)

All registered models get CRUD endpoints automatically:

```
GET    /api/ottaorm/{entity}           List (paginated)
GET    /api/ottaorm/{entity}/{id}      Get by ID
POST   /api/ottaorm/{entity}           Create
PATCH  /api/ottaorm/{entity}/{id}      Update
DELETE /api/ottaorm/{entity}/{id}      Delete
```

Query params: `page`, `per_page`, `sort`, `order`, `where` (JSON)

### Custom API Routes

Add to `cloudflare-worker.ts`:

```typescript
if (url.pathname === "/api/my-endpoint" && request.method === "POST") {
	registerConnection("default", createD1Driver(env.OBCF_D1));

	const body = await request.json();
	// ... logic

	return jsonResponse({ success: true, data: result });
}
```

### Response Helpers

```typescript
import { jsonResponse } from "@ottabase/utils/http-response";
import { errorResponse, ServiceError } from "@ottabase/utils/http-errors";
import { paginatedJsonResponse, parsePaginationParams } from "@ottabase/utils/pagination";

// Success
return jsonResponse({ data: result });

// Error
return errorResponse("Something went wrong", 400, {
	code: "VALIDATION_ERROR",
	hint: "Check your input",
});

// Paginated
const { page, perPage } = parsePaginationParams(url.searchParams);
return paginatedJsonResponse({ data, total, page, perPage, path: "/api/items" });
```

---

## Environment Variables

### Cloudflare Bindings (wrangler.jsonc)

```jsonc
{
  "d1_databases": [{ "binding": "OBCF_D1", "database_name": "app-db" }],
  "kv_namespaces": [{ "binding": "OBCF_KV" }],
  "r2_buckets": [{ "binding": "OBCF_R2", "bucket_name": "app-bucket" }],
  "queues": { "producers": [{ "binding": "OBCF_QUEUE", "queue": "app-queue" }] },
  "durable_objects": { "bindings": [{ "name": "OBCF_REALTIME", "class_name": "RealtimeActor" }] }
}
```

### App Environment Variables

```bash
# Required
AUTH_SECRET=           # Auth.js secret

# Optional
MIGRATION_SECRET=      # For production migrations
APP_ID=               # Multi-app DB scoping
SCOPE_BY_APP_ID=      # Enable appId filtering

# Email
EMAIL_RESEND_API_KEY=  # Resend API
EMAIL_FROM=           # From address

# Cloudflare Images
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
```

---

## Anti-Patterns to Avoid

| ❌ Don't | ✅ Do |
|---------|------|
| Create DB tables without OttaORM model | Use `BaseModel` with `static entity` and `static table` |
| Direct Drizzle queries in packages | Export fat model, let app register and query |
| Circular dependencies between packages | Keep dependency flow one-directional |
| Import files across package boundaries | Use proper exports from package index |
| Framework-specific code in packages | Keep packages framework-agnostic |
| Package-specific lock files | One root pnpm-lock.yaml |
| Missing type definitions | Export types with every package |
| Models without `static entity` | Always define entity name |
| Hardcoded API URLs | Use config or env variables |
| Skip dark mode classes | Always add dark mode support |

---

## Cloudflare Deployment

```bash
# Login
pnpm wrangler login

# Create resources
pnpm wrangler d1 create app-db
pnpm wrangler kv:namespace create OTTABASE_KV
pnpm wrangler r2 bucket create app-bucket
pnpm wrangler queues create app-queue

# Deploy
cd apps/ottabase-template-app-tanstack
pnpm deploy

# Run migrations
curl -X POST https://your-app.workers.dev/api/ottaorm/init \
  -H "Authorization: Bearer ${MIGRATION_SECRET}"
```

---

## Testing

```bash
# All tests
pnpm test

# Specific package
pnpm test --filter=@ottabase/ottaorm

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage
```

Test files location: `src/__tests__/` or adjacent to source files.

---

## Quick Reference: Common Tasks

### Add a new model

1. Create `apps/my-app/ottabase/models/MyModel.ts` with table + class
2. Export table in `apps/my-app/ottabase/db/schema.ts`
3. Register model in `cloudflare-worker.ts`
4. Run migrations: `curl -X POST http://localhost:3004/api/ottaorm/init`
5. Create hooks in `apps/my-app/src/ottabase/hooks/useMyModel.ts`

### Add a new package

1. Create `packages/my-package/` structure
2. Add to catalog if deps are shared
3. Build: `pnpm build --filter=@ottabase/my-package`
4. Use in apps: `"@ottabase/my-package": "workspace:*"`

### Add feature package with DB

1. Create package with fat model (extends `BaseModel`)
2. Export model + table from package index
3. In app: import model, register it, export table in schema
4. Run migrations

---

🕊️
