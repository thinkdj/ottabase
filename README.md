# Ottabase Monorepo

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node-%3E%3D24-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10.27.0-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![CI - Build & Test](https://github.com/thinkdj/ottabase/actions/workflows/ci.yml/badge.svg)](https://github.com/thinkdj/ottabase/actions/workflows/ci.yml)

> **[Get started in five minutes →](./QUICKSTART.md)** - Clone, configure, bootstrap, and ship.

A Cloudflare-native monorepo for SaaS apps and content sites, built with pnpm workspaces, Turborepo, and Cloudflare
Workers.

## Why Ottabase?

- Cloudflare-first: Workers, D1, KV, R2, Queues, and Durable Objects are built in.
- SaaS foundations: auth, RBAC, OttaORM, forms, uploads, realtime, queues, and a blog/CMS.
- Fat models keep domain logic close to data instead of scattering it across controllers and services.
- One monorepo for integrated app and package changes.

<p align="center">
    <a href="https://demo.ottabase.com/" target="_blank" rel="noopener noreferrer">
        <img src="./apps/otta-web/public/ottabase-demo/ottabase_screenshot_1_demo.png" alt="Ottabase demo overview" width="32.5%" style="border-radius: 4px;" />
    </a>
    <a href="https://demo.ottabase.com/" target="_blank" rel="noopener noreferrer">
        <img src="./apps/otta-web/public/ottabase-demo/ottabase_screenshot_2_admin.png" alt="Ottabase admin media library" width="32.5%" style="border-radius: 4px;" />
    </a>
    <a href="https://demo.ottabase.com/" target="_blank" rel="noopener noreferrer">
        <img src="./apps/otta-web/public/ottabase-demo/ottabase_screenshot_3_uploads.png" alt="Ottabase content management" width="32.5%" style="border-radius: 4px;" />
    </a>
</p>

## Info

> **▲ You own the code.**
>
> Ottabase is a **monorepo you clone and modify**, not an npm package. When you fork it, you own:
>
> - **Upstream changes** - merge or rebase updates and resolve any conflicts yourself.
> - **Schema and data migrations** - reconcile upstream changes with your production data; back up first.
> - **Infrastructure, security, and costs** - deploy to and operate your own Cloudflare account.
> - **Breaking changes** - adapt your customizations when an upstream API or tool changes.
>
> **Recommended**: Read [ARCHITECTURE.md](./ARCHITECTURE.md), [CONTRIBUTING.md](./.github/CONTRIBUTING.md), and
> [SECURITY.md](./.github/SECURITY.md) before making structural changes.

## Quick Links

- Docs: [Quick Start](./QUICKSTART.md), [README](./README.md), [Architecture](./ARCHITECTURE.md),
  [Changelog](./CHANGELOG.md), [Releases](./docs/RELEASES.md)
- Project health: [Contributing](./.github/CONTRIBUTING.md), [Code of Conduct](./.github/CODE_OF_CONDUCT.md),
  [Security](./.github/SECURITY.md), [Support](./.github/SUPPORT.md), [Maintainers](./.github/MAINTAINERS.md)
- Demo: demo.ottabase.com
- Community: [GitHub Discussions](https://github.com/thinkdj/ottabase/discussions)

## Comparison

| Capability               | Ottabase        | DIY Stack (Next.js + Supabase + Stripe + etc) |
| ------------------------ | --------------- | --------------------------------------------- |
| Setup complexity         | ✓ Minimal       | ▲ High                                        |
| Integration effort       | ✓ None          | ▲ High                                        |
| Time to MVP / App Launch | » Hours to days | ◔ Weeks to months                             |

### Positioning

| Capability         | Ottabase                                    | Supabase                          | Railway                   | Convex                            |
| ------------------ | ------------------------------------------- | --------------------------------- | ------------------------- | --------------------------------- |
| Primary model      | Edge-native full-stack framework (monorepo) | Backend-as-a-service              | App hosting platform      | Realtime backend platform         |
| Best for           | Solo founders shipping SaaS - super fast    | Backend-heavy apps / Firebase alt | Simple deployments        | Realtime-first apps               |
| Opinionation level | ✓ Strong (batteries-included)               | ◑ Medium                          | ✗ Low                     | ◑ Medium                          |
| Build vs Configure | **Build product directly**                  | Configure backend + build app     | Build everything yourself | Build within platform constraints |

---

### Developer Speed

| Capability                          | Ottabase            | Supabase     | Railway            | Convex    |
| ----------------------------------- | ------------------- | ------------ | ------------------ | --------- |
| Time to MVP                         | » Hours to days     | ◔ Days–weeks | ◔ Weeks            | ◔ Days    |
| Full-stack starter in your repo     | ✓ Yes               | ✗ No         | ✗ No               | ◑ Partial |
| Model-driven CRUD primitives        | ✓ Built in          | ◑ DIY        | ✗ No               | ◑ Partial |
| RBAC + multi-tenant SaaS primitives | ✓ Included          | ◑ DIY        | ✗ No               | ◑ DIY     |
| UI/component packages included      | ✓ Yes               | ✗ No         | ✗ No               | ✗ No      |
| Blog/CMS package included           | ✓ Yes               | ✗ No         | ✗ No               | ✗ No      |
| Type safety (TS-first)              | ✓ Deeply integrated | ◑ Partial    | ◑ Depends on stack | ✓ Strong  |
| Local dev experience                | ✓ Unified           | ◑ Mixed      | ◑ Basic            | ✓ Good    |

---

### Infrastructure & Scale

| Capability             | Ottabase                            | Supabase                  | Railway        | Convex                     |
| ---------------------- | ----------------------------------- | ------------------------- | -------------- | -------------------------- |
| Edge-native (global)   | ✓ Cloudflare Workers-first          | ✗ No                      | ✗ No           | ✗ No                       |
| AI Gateway (global)    | ✓ Cloudflare Workers-first          | ✗ No                      | ✗ No           | ✗ No                       |
| Global latency         | ✓ Low (edge execution)              | ◑ Region-based            | ◑ Region-based | ◑ Region-based             |
| Cold starts            | ✓ Minimal                           | ◑ Possible                | ◑ Possible     | ◑ Possible                 |
| Built-in CDN / caching | ✓ Native (Cloudflare)               | ✗ No                      | ✗ No           | ✗ No                       |
| Queues / cron support  | ✓ Native (CF bindings)              | ◑ Limited / external      | ◑ External     | ◑ Limited                  |
| Cost predictability    | ✓ High                              | ◑ Can scale unpredictably | ◑ Infra-based  | ◑ Usage-based              |
| Vendor lock-in         | ◑ High (Framework + infra coupling) | ◑ Medium (infra coupling) | ◑ Low          | ▲ High (proprietary model) |

## Structure

```text
ottabase/
├── apps/
│   ├── otta-web/       # TanStack Router + Vite + Workers (primary)
│   └── otta-landing/ # Next.js + OpenNext (homepage/landing)
├── packages/
│   ├── ottaorm/          # Fat models, auto-migrations, CRUD, RLS
│   ├── ottarouter/        # Cloudflare Workers router (order-free precedence, middleware)
│   ├── db/               # Drizzle D1 driver
│   ├── cf/               # Cloudflare bindings (D1, KV, R2, Queues, Cache Keys)
│   ├── cf-realtime/      # WebSocket pub/sub (Durable Objects)
│   ├── queue/            # Job queue (dispatch, handlers, priority)
│   ├── auth/             # Lightweight custom auth (sessions, OAuth, magic links) with D1
│   ├── rbac/             # Role-based access control with KV caching
│   ├── audit/            # Audit logging with change tracking
│   ├── analytics/        # Cloudflare Analytics Engine (WAE)
│   ├── notifications/    # Multi-channel notifications (email, WebSocket)
│   ├── shortlinks/       # URL shortener with interstitial + WAE tracking
│   ├── referrals/        # Referral tracking (first-touch, WAE)
│   ├── brand-engine/     # Design tokens, preset expansion, CSS injection
│   ├── brand-engine-react/ # BrandProvider, LayoutResolver, useBrand()
│   ├── ottalayout/       # Layout types, presets, path resolver, React slots
│   ├── ottablog/         # Blog/CMS (articles, blurbs, photo journals, taxonomy, series, Studio)
│   ├── email/            # Email sending (Resend, SES, MailChannels, SMTP)
│   ├── cron/             # Cron handlers (static + DB scheduler)
│   ├── logger/           # Structured logging (multi-transport)
│   ├── config/           # App config, env vars, storage keys
│   ├── scripts/          # CLI: cf:setup, cf:validate, cf:login, clean:*
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
│   ├── ui-cropper/       # Vanilla JS image cropper (~3-4 KB)
│   ├── spotlight/        # Command palette
│   ├── docs/             # Markdown doc viewer
│   ├── forms/            # Auto-generated CRUD forms from OttaORM models
│   ├── i18n/             # i18next wrapper (en, es, fr, de)
│   ├── api/              # Type-safe fetch wrapper
│   └── utils/            # Timezone, string, file, URL utilities
└── turbo.json
```

> Note: The structure list is curated for readability; the source of truth for all publishable modules is
> `packages/*/package.json`.

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

# Start the default app (otta-web: Vite + Wrangler)
pnpm dev

# Initialize database
curl -X POST http://localhost:3004/api/ottaorm/init
```

## Otta CLI

`pnpm otta` is the single app-scoped interface. It discovers apps from `apps/*`, uses the root default when the app is
omitted, and accepts either an app directory name or package name.

```bash
# Start apps
pnpm otta start                         # Default app, development
pnpm otta start otta-landing            # A specific app
pnpm otta start otta-web --env stage    # Built Worker locally with env.staging
pnpm otta start otta-web --env preview  # Built Worker locally with env.preview
pnpm otta start otta-web --env prod     # Built Worker locally with env.production
pnpm otta dev otta-web --process worker # One process from the dev topology

# Scaffold a new app
pnpm otta new web my-app                # Vite + TanStack Router + Workers
pnpm otta new landing my-site           # Next.js landing page

# App-scoped quality commands
pnpm otta build otta-web
pnpm otta test otta-web
pnpm otta lint otta-web
pnpm otta list
```

Named environment starts are always local, require the environment to exist in `wrangler.jsonc`, and pass `--local` to
Wrangler; deployment remains a separate CI/manual operation. Supervised output is labeled by process, and the entire
process tree is stopped when one member fails. The workspace CLI rebuilds itself only when its source is newer than its
compiled output. See `pnpm otta --help` or the [CLI README](./packages/cli/README.md) for the lifecycle contract and
options.

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
} = createModelHooks<TodoType>({ entityName: 'todos' });
```

```tsx
// Usage in component
const { data: todos } = useTodos();
const createTodo = useCreateTodo();
createTodo.mutate({ title: 'New Todo' });
```

## Packages

### Database, Auth & Infrastructure

| Package                | Purpose                                                                  |
| ---------------------- | ------------------------------------------------------------------------ |
| `@ottabase/ottaorm`    | Fat models, CRUD, relationships, RLS, auto-migrations                    |
| `@ottabase/ottarouter` | Cloudflare Workers router - order-free precedence, middleware, mounts    |
| `@ottabase/db`         | Drizzle D1 driver (`createD1Driver`)                                     |
| `@ottabase/cf`         | D1, KV, R2, Queues, Rate Limiting, Cache Keys, read-through KV cache     |
| `@ottabase/cf-pdf`     | Cloudflare HTML-to-PDF export with Browser Rendering and safe downloads  |
| `@ottabase/queue`      | Job queue (dispatch, handlers, deduplication, chaining, priority)        |
| `@ottabase/auth`       | Lightweight custom auth: signed sessions, OAuth, Credentials, Magic Link |
| `@ottabase/rbac`       | Role-based access control with per-org KV caching                        |
| `@ottabase/audit`      | Audit logging with change tracking and RBAC context                      |
| `@ottabase/logger`     | Structured logging (Console, HTTP, Sentry, Memory, Buffer transports)    |
| `@ottabase/analytics`  | Cloudflare Analytics Engine (WAE) - write events, query, funnel, top-K   |
| `@ottabase/config`     | App config, env vars, storage key utilities                              |
| `@ottabase/cron`       | Cron handlers - static code-defined and DB scheduler (Laravel-style)     |
| `@ottabase/scripts`    | CLI tools: `cf:login`, `cf:setup`, `cf:validate`, `clean:*`              |

### Premium Packages

Sell add-ons for your app, or install someone else's. One server manifest carries everything a Premium Package
contributes — tables, models, routes, nav, entitlements and lifecycle hooks — and installing it starts with
`ottabase/config.premium.ts`. Rendered pages and Drizzle's static schema export are explicit build-time adapters, kept
in sync by the app's premium-registration test. Licenses are signed tokens verified **offline** (Web Crypto), so nothing
phones home. An app with no Premium Packages is completely unaffected: nothing mounts and nothing is fetched.

| Package                      | Purpose                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------- |
| `@ottabase/premium`          | Manifests, license verification, entitlements, lifecycle, gated routes, admin UI |
| `@ottabase/premium-webhooks` | Worked example: HMAC-signed outbound webhooks, free tier + licensed delivery log |

See [`docs/PREMIUM_PACKAGES.md`](docs/PREMIUM_PACKAGES.md).

### Brand, Layout & Content

| Package                        | Purpose                                                              |
| ------------------------------ | -------------------------------------------------------------------- |
| `@ottabase/brand-engine`       | Design tokens, preset expansion, CSS injection, email branding       |
| `@ottabase/brand-engine-react` | `BrandProvider`, `LayoutResolver`, `useBrand()` React bindings       |
| `@ottabase/ottalayout`         | Layout types, 10 presets, path resolver, React slots, LayoutMeta     |
| `@ottabase/ottablog`           | Blog/CMS models (Post, Category, Tag, Series, Version) + Blog Studio |

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
| `@ottabase/ui-cropper`        | Vanilla JS image cropper (~3-4 KB, zero deps)            |
| `@ottabase/spotlight`         | Spotlight/command palette component                      |
| `@ottabase/docs`              | Markdown doc viewer with layout themes                   |
| `@ottabase/forms`             | Auto-generated CRUD forms from OttaORM models            |

### Features & Realtime

| Package                   | Purpose                                                      |
| ------------------------- | ------------------------------------------------------------ |
| `@ottabase/cf-realtime`   | WebSocket pub/sub via Durable Objects (Pusher alternative)   |
| `@ottabase/shortlinks`    | URL shortener: short codes, interstitial, expiry, WAE clicks |
| `@ottabase/referrals`     | Referral tracking - first-touch attribution, WAE clicks      |
| `@ottabase/notifications` | Multi-channel notifications (email, WebSocket, system)       |

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

| Variable          | Default      | Description                 |
| ----------------- | ------------ | --------------------------- |
| `APP_ID`          | `"otta-web"` | Unique app identifier       |
| `SCOPE_BY_APP_ID` | `"false"`    | Enable appId scoping for DB |

### Schema Support

All models include a nullable `appId` column:

- `@ottabase/ottaorm` core models (User, Session, Account, Post, Tag, etc.)
- `@ottabase/shortlinks` fat model
- `@ottabase/referrals` fat model

## Creating New Apps

**Full-stack SPA** (TanStack Router, OttaORM, Auth, RBAC, all CF bindings):

```bash
# Unix/macOS: cp -r apps/otta-web apps/my-new-app
# Windows:    xcopy /E /I apps\otta-web apps\my-new-app
cd apps/my-new-app
# Update package.json name
# Delete src/pages/demo/  (optional - remove demo pages)
```

**Marketing homepage** (Next.js, OpenNext, Brand Engine):

```bash
# Unix/macOS: cp -r apps/otta-landing apps/my-new-homepage
# Windows:    xcopy /E /I apps\otta-landing apps\my-new-homepage
cd apps/my-new-homepage
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
export const { useList, useCreate, ... } = createModelHooks({ entityName: "shortlinks" });
```

## Commands

```bash
pnpm commands         # Every script in one annotated table — start here
pnpm commands clean   # Filter to a topic
```

The table is generated from `package.json`, so it always matches the scripts that actually exist. The essentials:

```bash
pnpm dev              # Start the default app (alias for pnpm otta start)
pnpm otta --help       # Parameterized app/environment lifecycle
pnpm build            # Build everything
pnpm build:pkg        # Build packages only
pnpm test             # Run tests
pnpm lint             # Lint
pnpm type-check       # TypeScript check
pnpm storybook        # Component docs
```

## Cloudflare Deployment

```bash
cd apps/otta-web
pnpm wrangler login
pnpm deploy

# Run migrations
curl -X POST https://your-app.workers.dev/api/ottaorm/init \
  -H "Authorization: Bearer ${MIGRATION_SECRET}"
```

## Docs

- [Architecture](./ARCHITECTURE.md)
- [Changelog](./CHANGELOG.md)
- [Contributing Guide](./.github/CONTRIBUTING.md)
- [Security Policy](./.github/SECURITY.md)
- [Template App README](./apps/otta-web/README.md)
- [OttaORM README](./packages/ottaorm/README.md)
- [Cloudflare Deploy](./docs/CLOUDFLARE_DEPLOY.md)
- [Cloudflare Config](./docs/CLOUDFLARE_CONFIGURATION_GUIDE.md)
- [Testing](./docs/TESTING.md)

---

[![Built on Cloudflare](https://workers.cloudflare.com/built-with-cloudflare.svg)](https://cloudflare.com)

~ by [@thinkdj](https://twitter.com/@thinkdj/). Licensed under [MIT](./LICENSE).
