# Agents & Architecture

Ottabase is a Cloudflare-first monorepo for solo SaaS founders. It ships shared packages plus two starter apps. The primary template app is React + TanStack Router + Vite at apps/ottabase-template-app-tanstack (copy it for new apps).

## Structure
- apps/
	- ottabase-template-app/ (Next.js 15 + OpenNext reference)
	- ottabase-template-app-tanstack/ (React + TanStack Router template to copy)
- packages/ (shared libraries and features)
- docs/ (platform docs)

## Local Development (Windows)
- OS: Windows 11
- Terminal: cmd.exe (avoid PowerShell path issues)
- Runtime: Node.js 24+
- Package manager: pnpm workspaces
- Build: Turborepo
- Common commands:
	- pnpm build:pkg
	- pnpm dev
	- pnpm dev:worker (TanStack app with Wrangler)

## Core Concepts

### OttaORM (fat model system)
- Every model extends BaseModel and must set static entity/table/primaryKey.
- Drivers are per-request: setDriver(createD1Driver(env.OBCF_D1)).
- Schemas are collected from core models, app models, and package models.
- Auto-migrations: POST /api/ottaorm/init.
	- Adds tables/columns only (no rename/drop).
	- New NOT NULL columns must have DEFAULT values.
- registerModels([...]) enables /api/ottaorm/{entity} CRUD.
- createModelHooks(...) generates TanStack Query hooks.

```ts
import { BaseModel, registerModels, setDriver } from "@ottabase/ottaorm";
import { createD1Driver } from "@ottabase/db/drizzle-d1";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const todosTable = sqliteTable("todos", {
	id: text("id").primaryKey(),
	title: text("title").notNull(),
});

export class Todo extends BaseModel {
	static entity = "todos";
	static table = todosTable;
	static primaryKey = "id";
}

setDriver(createD1Driver(env.OBCF_D1));
registerModels([Todo]);
```

### Package-owned tables (DB integration)
If a package ships tables/models, integrate it the same way as app models.

Steps:
1) Export package tables in app schema.
2) Register package models in app bootstrap (worker or API entry).
3) Run /api/ottaorm/init for migrations.
4) Add client hooks if needed.

```ts
// apps/*/ottabase/db/schema.ts
export { shortlinksTable } from "@ottabase/shortlinks";

// apps/*/ottabase/registry.ts (or worker entry)
import { registerModels } from "@ottabase/ottaorm";
import { Shortlink } from "@ottabase/shortlinks";
registerModels([Shortlink]);
```

### Multi-app database sharing
- Use @ottabase/config to set appId and scopeByAppId.
- Packages with appId columns: @ottabase/ottaorm core models, @ottabase/shortlinks, @ottabase/referrals, @ottabase/ottablog.
- Env:
	- APP_ID="my-app"
	- SCOPE_BY_APP_ID="true"

## App Locations
- apps/*/ottabase/models/ (OttaORM models)
- apps/*/ottabase/db/schema.ts (table exports)
- apps/*/ottabase/migrations/ (custom migrations)
- apps/ottabase-template-app/app/api/* (Next.js route handlers)
- apps/ottabase-template-app-tanstack/cloudflare-worker.ts (Worker routes)
- apps/ottabase-template-app-tanstack/src/ (client app)

## UI Conventions
- Prefer Tailwind classes and shared components.
- Always include dark mode classes when styling.
- Icons: use @tabler/icons-react (Lucide/Radix as fallback).
- Keep components DRY; reuse @ottabase/ui-* and shared components.

## API and Auth Conventions
- Use @ottabase/api (or app wrapper like src/lib/api.ts) instead of raw fetch.
- Next.js route.ts inside a module should include the module prefix in the API path.
- For Auth.js v5 in React, use next-auth/react useSession.

## Packages (what they do and how to use)

### Data, ORM, Auth, Config
- @ottabase/ottaorm
	- Fat model ORM with auto-migrations and CRUD.
	- Core models: User, Account, Session, Post, Tag, VerificationToken, Authenticator, ScheduledTask.
	- Use createModelHooks for client queries/mutations.
- @ottabase/db
	- Drizzle D1 driver: createD1Driver, raw SQL helper.
	- Prisma client in @ottabase/db/prisma/client is NOT for D1.
	- For D1 + Prisma, use @ottabase/cf/d1-prisma.
- @ottabase/api
	- Type-safe fetch client with ApiError handling.
	- TanStack template wraps it in src/lib/api.ts for app-wide config.
- @ottabase/auth
	- Auth.js v5 + D1 + Drizzle adapter.
	- Auth tables come from OttaORM core migrations.
	- Use createOttabaseAuthConfig and createD1AuthAdapterCached.
- @ottabase/config
	- App config + env-driven defaults (appId, UI framework, storage).
	- Use envPrefix for Vite when needed.
- @ottabase/scripts
	- Prisma schema concatenation via db-prisma-schema-concatenate.
	- Configure ottabase/prisma/prisma.config.js and run pnpm db:generate.

### Cloudflare Platform
- @ottabase/cf
	- Typed bindings for D1, KV, R2, Images, Queues, Rate Limiting, Hyperdrive.
- @ottabase/cf-realtime
	- Durable Object WebSocket pub/sub.
	- Requires OBCF_REALTIME binding + wrangler DO migration.
- @ottabase/queue
	- Cloudflare Queues jobs with registry + handler.
	- Supports dedupe (KV), chaining, priority queues.
- @ottabase/cron
	- Static cron handlers or DB-backed scheduler (ScheduledTask model).
	- All schedules run in UTC.
	- Heavy work should dispatch to @ottabase/queue.
- @ottabase/email
	- Handlebars templates + mailer helpers.
	- Resend provider (edge-safe), Nodemailer for Node, Cloudflare provider stub.

### UI and UX
- @ottabase/ui-base
	- CSS reset + base styles. Use ProviderUIBase or import styles.
- @ottabase/ui-mantine
	- Mantine provider + theme presets.
	- Controlled by themeAtom from @ottabase/state (pass colorScheme).
- @ottabase/ui-shadcn
	- shadcn/ui components + ShadcnProviders (next-themes).
	- Add package paths to tailwind content and import styles.css.
- @ottabase/ui-tailwind
	- Shared Tailwind base config + tailwind.base.css.
- @ottabase/ui-components
	- Shared Logo + DarkModeToggle (Mantine + next-themes + Tabler icons).
- @ottabase/ui-code-highlight
	- ProviderCodeHighlight wrapper for syntax highlighting.
- @ottabase/ottaeditor
	- EditorJS wrapper with default plugins and useOttaEditor hook.
- @ottabase/ottarenderer
	- Render EditorJS blocks + HTML; import @ottabase/ottarenderer/styles.
	- Uses custom renderers (AdvancedImage, Checklist, Code, etc).
- @ottabase/ottaselect
	- Flexible select with Tailwind + dark mode.
	- Add packages/ottaselect/src to tailwind content.
- @ottabase/ottaupload
	- Dropzone/button uploader + hooks + server helpers.
	- R2 requires OBCF_R2; Images requires CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.
- @ottabase/forms
	- Auto-generated CRUD UI from OttaORM model metadata.
	- Peer deps: React + TanStack Query. Uses @ottabase/ottaselect.

### Feature Packages
- @ottabase/shortlinks
	- Shortlink model + schema (appId-aware).
	- Register Shortlink and export shortlinksTable in schema.
- @ottabase/referrals
	- Referral tracking model + schema.
	- Integrate with user model fields (referralUsername, referredById).
- @ottabase/ottablog
	- Blog/changelog/doc models + renderer.
	- Uses EditorJS content; register BlogPost/BlogTag/etc and export tables.
- @ottabase/hello-world
	- Simple demo component.

### Utilities
- @ottabase/utils
	- Tree-shakeable utilities (timezone, string, url, http, pagination, git).
	- Timezone rule: store UTC in DB, format in user timezone.

## Dependency Rules
- Use pnpm workspace catalog for shared libs (react, typescript, drizzle-orm).
- Use workspace:* for internal packages.
- Shared framework deps in packages should be peerDependencies.
- Add package-specific deps locally when only one package needs them.

## Commands Reference
- pnpm build:pkg
- pnpm dev
- pnpm dev:worker
- pnpm build
- pnpm test
- pnpm lint
- pnpm type-check
- pnpm storybook

## Docs and References
- apps/ottabase-template-app/README.md (Next.js template)
- apps/ottabase-template-app-tanstack/README.md (TanStack template)
- packages/ottaorm/README.md
- packages/ottablog/src/models (fat model examples)
- CLOUDFLARE_CONFIGURATION_GUIDE.md
- apps/ottabase-template-app/ottabase/migrations/README.md

---

🕊️
