# Ottabase Monorepo

Modern full-stack monorepo with pnpm workspaces and Turborepo. Deploy to Cloudflare Workers with D1, KV, R2, Queues, and
Durable Objects.

## Structure

```
ottabase/
├── apps/
│   ├── ottabase-template-app-tanstack/       # TanStack Router + Vite + Workers (primary)
│   └── ottabase-template-app-nextjs-homepage/ # Next.js + OpenNext (homepage/landing)
├── packages/
│   ├── ottaorm/          # Fat models, auto-migrations, CRUD, RLS
│   ├── db/               # Drizzle D1 driver
│   ├── cf/               # Cloudflare bindings (D1, KV, R2, Queues, Cache Keys)
│   ├── cf-realtime/      # WebSocket pub/sub (Durable Objects)
│   ├── queue/            # Job queue (dispatch, handlers, priority)
│   ├── auth/             # Auth.js v5 with D1
│   ├── rbac/             # Role-based access control with KV caching
│   ├── audit/            # Audit logging with change tracking
│   ├── analytics/        # Cloudflare Analytics Engine (WAE)
│   ├── notifications/    # Multi-channel notifications (email, WebSocket)
│   ├── shortlinks/       # URL shortener with interstitial + WAE tracking
│   ├── referrals/        # Referral tracking (first-touch, WAE)
│   ├── brand-engine/     # Design tokens, preset expansion, CSS injection
│   ├── brand-engine-react/ # BrandProvider, LayoutResolver, useBrand()
│   ├── ottalayout/       # Layout types, presets, path resolver, React slots
│   ├── ottablog/         # Blog/CMS (Post, Category, Tag, Series, Studio)
│   ├── email/            # Email sending (Resend, SES, MailChannels, SMTP)
│   ├── cron/             # Cron handlers (static + DB scheduler)
│   ├── logger/           # Structured logging (multi-transport)
│   ├── config/           # App config, env vars, storage keys
│   ├── scripts/          # CLI: cf:setup, cf:validate, cf:login, clean:*, db:*
│   ├── state/            # Jotai atoms (theme, user, sidebar)
│   ├── ui-shadcn/        # shadcn/ui components
│   ├── ui-mantine/       # Mantine provider + themes
│   ├── ui-components/    # Shared components (DarkModeToggle, Logo)
│   ├── ui-code-highlight/ # Code syntax highlighting
│   ├── ui-split-pane/    # Resizable split pane
│   ├── ottaeditor/       # EditorJS wrapper with 15+ plugins
│   ├── ottaupload/       # File uploads (R2, CF Images)
│   ├── ottarenderer/     # EditorJS block renderer
│   ├── ottaselect/       # Headless select/combobox
│   ├── cropper/          # Vanilla JS image cropper (~3-4 KB)
│   ├── spotlight/        # Command palette
│   ├── docs/             # Markdown doc viewer
│   ├── forms/            # Auto-generated CRUD forms from OttaORM models
│   ├── i18n/             # i18next wrapper (en, es, fr, de)
│   ├── api/              # Type-safe fetch wrapper
│   └── utils/            # Timezone, string, file, URL utilities
└── turbo.json
```

## Prerequisites

- **Node.js**: `>=24.0.0`
- **pnpm**: `>=10.0.0`
- **Windows Users**: Ensure
  [Visual C++ Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170#latest-supported-redistributable-version)
  is installed for builds to work correctly.

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
import { BaseModel } from '@ottabase/ottaorm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const todosTable = sqliteTable('todos', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    title: text('title').notNull(),
    completed: integer('completed', { mode: 'boolean' }).default(false).notNull(),
    userId: text('user_id'),
    createdAt: integer('created_at').$defaultFn(() => Date.now()),
});

export class Todo extends BaseModel {
    static entity = 'todos';
    static table = todosTable;
    static primaryKey = 'id';

    static casts = {
        completed: 'boolean' as const,
        createdAt: 'date' as const,
    };

    // Relationship
    async user() {
        const { User } = await import('@ottabase/ottaorm');
        return this.belongsTo(User, 'userId');
    }

    // Custom methods
    static async incomplete() {
        return this.where({ completed: false });
    }

    async toggle() {
        this.set('completed', !this.get('completed'));
        return this.save();
    }
}
```

### Export in Schema

```typescript
// ottabase/db/schema.ts
export { usersTable, postsTable } from '@ottabase/ottaorm'; // Core
export { todosTable } from '../models/Todo'; // App
```

### Use Model

```typescript
import { setDriver } from '@ottabase/ottaorm';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { Todo } from './ottabase/models/Todo';

// In worker
setDriver(createD1Driver(env.OBCF_D1));

// CRUD
const todo = await Todo.create({ title: 'Buy groceries' });
const all = await Todo.all();
const one = await Todo.find('id');
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
import { createModelHooks } from '@ottabase/ottaorm/client';
import type { TodoType } from '@/ottabase/models/Todo';

export const {
    useList: useTodos,
    useDetail: useTodo,
    useCreate: useCreateTodo,
    useUpdate: useUpdateTodo,
    useDelete: useDeleteTodo,
} = createModelHooks<TodoType>({ entity: 'todos' });
```

```tsx
// Usage in component
const { data: todos } = useTodos();
const createTodo = useCreateTodo();
createTodo.mutate({ title: 'New Todo' });
```

## Packages

### Database, Auth & Infrastructure

| Package               | Purpose                                                                  |
| --------------------- | ------------------------------------------------------------------------ |
| `@ottabase/ottaorm`   | Fat models, CRUD, relationships, RLS, auto-migrations                    |
| `@ottabase/db`        | Drizzle D1 driver (`createD1Driver`)                                     |
| `@ottabase/cf`        | D1, KV, R2, Queues, Rate Limiting, Cache Keys, read-through KV cache     |
| `@ottabase/queue`     | Job queue (dispatch, handlers, deduplication, chaining, priority)        |
| `@ottabase/auth`      | Auth.js v5 with D1 adapter, OAuth, Credentials, Magic Link               |
| `@ottabase/rbac`      | Role-based access control with per-org KV caching                        |
| `@ottabase/audit`     | Audit logging with change tracking and RBAC context                      |
| `@ottabase/logger`    | Structured logging (Console, HTTP, Sentry, Memory, Buffer transports)    |
| `@ottabase/analytics` | Cloudflare Analytics Engine (WAE) — write events, query, funnel, top-K  |
| `@ottabase/config`    | App config, env vars, storage key utilities                              |
| `@ottabase/cron`      | Cron handlers — static code-defined and DB scheduler (Laravel-style)     |
| `@ottabase/scripts`   | CLI tools: `cf:login`, `cf:setup`, `cf:validate`, `clean:*`, `db:*`     |

### UI Components

| Package                       | Purpose                                                  |
| ----------------------------- | -------------------------------------------------------- |
| `@ottabase/ui-shadcn`         | shadcn/ui components, ShadcnProviders                    |
| `@ottabase/ui-mantine`        | Mantine provider, pre-built themes                       |
| `@ottabase/ui-base`           | Framework-agnostic base styles                           |
| `@ottabase/ui-components`     | Shared components: DarkModeToggle, Logo                  |
| `@ottabase/ui-code-highlight` | Code syntax highlighting (Prism/Shiki)                   |
| `@ottabase/ui-split-pane`     | Resizable split-pane layout component                    |
| `@ottabase/ottaeditor`        | EditorJS wrapper with 15+ plugins (Spoiler, CTA, Review) |
| `@ottabase/ottaupload`        | File upload component (R2, Cloudflare Images)            |
| `@ottabase/ottarenderer`      | EditorJS block renderer for React                        |
| `@ottabase/ottaselect`        | Headless select/combobox component                       |
| `@ottabase/cropper`           | Vanilla JS image cropper (~3-4 KB, zero deps)            |
| `@ottabase/spotlight`         | Spotlight/command palette component                      |
| `@ottabase/docs`              | Markdown doc viewer with layout themes                   |
| `@ottabase/forms`             | Auto-generated CRUD forms from OttaORM models            |

### Brand, Layout & Content

| Package                         | Purpose                                                                |
| ------------------------------- | ---------------------------------------------------------------------- |
| `@ottabase/brand-engine`        | Design tokens, preset expansion, CSS injection, email branding         |
| `@ottabase/brand-engine-react`  | `BrandProvider`, `LayoutResolver`, `useBrand()` React bindings         |
| `@ottabase/ottalayout`          | Layout types, 10 presets, path resolver, React slots, LayoutMeta       |
| `@ottabase/ottablog`            | Blog/CMS models (Post, Category, Tag, Series, Version) + Blog Studio   |

### Features & Realtime

| Package                 | Purpose                                                  |
| ----------------------- | -------------------------------------------------------- |
| `@ottabase/cf-realtime` | WebSocket pub/sub via Durable Objects (Pusher alternative) |
| `@ottabase/shortlinks`  | URL shortener: short codes, interstitial, expiry, WAE clicks |
| `@ottabase/referrals`   | Referral tracking — first-touch attribution, WAE clicks  |
| `@ottabase/notifications` | Multi-channel notifications (email, WebSocket, system)  |

### Utilities & Integrations

| Package           | Purpose                                               |
| ----------------- | ----------------------------------------------------- |
| `@ottabase/state` | Jotai atoms (theme, user, sidebar, org)               |
| `@ottabase/utils` | Timezone, string, file, URL, git utilities            |
| `@ottabase/api`   | Type-safe fetch wrapper with deduping and error types |
| `@ottabase/email` | Email sending (Resend, SES, MailChannels, Nodemailer) |
| `@ottabase/i18n`  | i18next wrapper (en, es, fr, de)                      |

## Multi-App Database Sharing

Multiple apps can share a single database using the optional `appId` column.

### How It Works

| Mode          | `scopeByAppId` | `appId` column | Behavior                      |
| ------------- | -------------- | -------------- | ----------------------------- |
| **Default**   | `false`        | `null`         | Single app, no filtering      |
| **Multi-app** | `true`         | `"my-app"`     | Auto-inject/filter by `appId` |

### Configuration

```typescript
import { createAppConfig } from '@ottabase/config';

const config = createAppConfig({
    appId: 'my-unique-app-id',
    defaults: {
        features: { scopeByAppId: true }, // Enable appId scoping
    },
});
```

### Environment Variables

| Variable          | Default                   | Description                 |
| ----------------- | ------------------------- | --------------------------- |
| `APP_ID`          | `"ottabase-template-app"` | Unique app identifier       |
| `SCOPE_BY_APP_ID` | `"false"`                 | Enable appId scoping for DB |

### Schema Support

All models include a nullable `appId` column:

- `@ottabase/ottaorm` core models (User, Session, Account, Post, Tag, etc.)
- `@ottabase/shortlinks` fat model
- `@ottabase/referrals` fat model

## Creating New Apps

**Full-stack SPA** (TanStack Router, OttaORM, Auth, RBAC, all CF bindings):

```bash
cp -r apps/ottabase-template-app-tanstack apps/my-app
cd apps/my-app
# Update package.json name
# Delete src/pages/demo/  (optional — remove demo pages)
```

**Marketing homepage** (Next.js, OpenNext, Brand Engine):

```bash
cp -r apps/ottabase-template-app-nextjs-homepage apps/my-homepage
cd apps/my-homepage
# Update package.json name
# Edit config/brand.config.ts to customize theme
```

## Package Fat Model Pattern

When a package owns its tables (like `@ottabase/shortlinks`), the model and schema live together in the package.

### 1. Package exports fat model

```typescript
// packages/shortlinks/src/Shortlink.ts
export const shortlinksTable = sqliteTable("shortlinks", { ... });

export class Shortlink extends BaseModel {
  static entity = "shortlinks";
  static table = shortlinksTable;
}
```

### 2. App registers model

```typescript
import { Shortlink } from '@ottabase/shortlinks';
registerModels([Shortlink]);
```

### 3. Export table in schema

```typescript
// ottabase/db/schema.ts
export { shortlinksTable } from '@ottabase/shortlinks';
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
