# Ottabase Template App

TanStack Router + Query template with automated OttaORM migrations and Cloudflare Workers deployment.

## Features

- **TanStack Router** - Type-safe routes defined in code (`src/router.tsx`)
- **Admin Access Routing** - Organization members page is keyed by the typed `$organizationId` route param with a direct
  back path to `/admin/access/organizations`
- **TanStack Query** - Powerful async state management
- **OttaORM** - Fat models with automated migrations
- **Owner Safety Guardrail** - Admin member APIs prevent demoting, deactivating, or removing the last active
  organization owner
- **Ottablog CMS** - Rich articles, short thoughts, and photo-first travel journals in one chronological timeline
- **Custom Auth** - OAuth, Magic Link, and Credentials authentication via a lightweight, dependency-free implementation
- **Vite** - Fast development server and optimized builds
- **Cloudflare Workers** - D1, KV, R2, Queues, Rate Limiting, Durable Objects
- **shadcn/ui on Tailwind** - UI components; Mantine is an optional adapter package the app does not ship
- **Jotai** - Global state management
- **Three.js landing hero** - A theme-aware, drag-spinnable WebGL network scene that respects reduced-motion
  preferences; the rest of the home page remains rendered from its Editor.js blocks

Worker runtime note: database/model/RLS setup is cached once per Cloudflare isolate and reused across later requests, so
the worker avoids rebuilding OttaORM state on every request. Static asset requests skip that setup entirely.

The router and outer Worker handler share one final error boundary. Unhandled 5xx responses expose only a stable error
code plus request ID, while the server emits one bounded, secret-redacted JSON log for correlation.

## Quick Start

```bash
# Install
pnpm install

# From the repo root: start Vite + Wrangler as one supervised app
pnpm otta start otta-web

# Optional: start only one process
pnpm otta dev otta-web --process web
pnpm otta dev otta-web --process worker

# Initialize database (creates all tables automatically)
curl -X POST http://localhost:3004/api/ottaorm/init

# Done! Visit http://localhost:3003
```

### API request bodies

The configured `api()` client serializes JSON request bodies. Pass objects directly; reserve `JSON.stringify()` for raw
`fetch()` calls:

```typescript
import { api } from '@/lib/api';

await api('/api/email/test', {
    method: 'POST',
    body: { recipients: ['you@example.com'], provider: 'auto' },
});
```

## Configuration

### Config Files

| File                                     | Why                                                                                                                                    | When to Edit                                                |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **`ottabase/ottabase.config.ts`**        | Main config (SSOT): app identity, packages (ottablog, shortlinks, referrals), features, meta, UI. brandEngine is core, always enabled. | Always: primary config surface                              |
| **`.env.local`** (from `.env.example`)   | Secrets and env-specific values: auth, OAuth, email, migration secret. Not committed.                                                  | Local dev and per-environment deployment                    |
| **`wrangler.jsonc`**                     | Cloudflare bindings: D1, KV, R2, Queues, Rate Limiter, Durable Objects, Analytics Engine.                                              | Deploying to Cloudflare; adding bindings                    |
| **`ottabase/config.routes.ts`**          | Custom or premium API route handlers. Extends built-in routing.                                                                        | Adding custom API routes                                    |
| **`ottabase/config.migrations.ts`**      | Package registry (tables, migrations). Built-in packages preconfigured.                                                                | Adding **custom** packages (not ottablog, shortlinks, etc.) |
| **`src/ottabase/config/i18n.config.ts`** | i18n: default language, enabled languages, fallback.                                                                                   | Changing languages                                          |
| **`ottabase/models/*.ts`**               | App-specific OttaORM models.                                                                                                           | Adding or changing app models                               |

**Do not edit:** `ottabase/config.loader.ts`: derived from ottabase.config.ts.

### Quick Setup Flow

```
1. cp .env.example → .env.local  (fill secrets)
2. Edit ottabase.config.ts (packages, features, meta)
3. Edit wrangler.jsonc if changing Cloudflare bindings
4. (Optional) Edit config.routes.ts for custom API routes
5. (Optional) Edit config.migrations.ts for custom packages
```

## Authentication

This template ships with a custom, dependency-free auth implementation + D1 integration and tighter session handling:

- **UI**: `/login`, `/register`, `/dashboard`, `/profile`
- **Backend**: `/api/auth/*`, `/api/auth/register`, `/api/users/me`
- **Session freshness**: Profile edits bump `auth:usr:{userId}:profile:version` in KV so the next `/api/auth/session`
  refresh pulls the updated name/image without polling D1 constantly.
- **Rate limiting**: Auth endpoints run through the shared rate limiter (per IP bucket for signin, register, signout).
- **Email flows**: `/api/auth/verify-email`, `/api/auth/verify-email/resend`, `/api/auth/password/reset/request`,
  `/api/auth/password/reset/confirm`.
- **In-session password change**: `/api/auth/password/change` for authenticated users with current password + new
  password.
- **Credentials storage**: PBKDF2 hashes in `users.password_hash`, email verification/roles stored alongside.
- **Session sync tip**: If you mutate `/api/users/me`, call `refreshSession()` (or `updateUser()`) so the cached local
  session picks up the KV-triggered profile version bump immediately.
- **One session bootstrap**: `AuthSessionBootstrap` owns the app-wide initial session read. `useSession()` is a
  side-effect-free state reader, and protected routes wait for that bootstrap rather than refreshing on every route
  mount. Call `refreshSession()` only after a mutation that can change the current user's session data; this avoids
  remount-driven `/api/auth/session` loops and loading-state flicker. Refreshes are causally ordered, auth-service
  outages are not mistaken for logout, and logout/401 invalidation clears auth, organization state, and tenant query
  caches together.
- **Tenant/app scope**: `X-Org-Id` is validated against authoritative active membership before it can become the RLS
  organization. App scope always comes from `ottabase.config.ts`; browser `X-App-Id` values are never trusted for RLS or
  media ownership.
- **Fail-closed membership lookup**: If D1 cannot resolve a signed-in user's organization or group memberships, the
  Worker returns `503 SECURITY_CONTEXT_UNAVAILABLE` instead of running with an unknown security scope.
- **Visible authorization demo**: OttaForms intentionally includes the protected `User` model. Its generated UI proves
  that model metadata does not grant access: generic `/api/ottaorm/users` CRUD returns one clear 403, while dedicated
  administration routes remain the only user-management path.

### Auth API Endpoints

| Endpoint                           | Method  | Notes                                                                                                                                                                                                                              |
| ---------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/auth/register`               | `POST`  | Credentials registration + required organization/owner-role setup. It rolls back the new user if tenant provisioning fails; success returns `{ user, organizationId, organizationRole, assignedRole, requiresEmailVerification }`. |
| `/api/auth/verify-email`           | `POST`  | Consume verification token from email link after registration or resend.                                                                                                                                                           |
| `/api/auth/verify-email/resend`    | `POST`  | Sends a new verification token; rate-limited by `enforceRateLimit`.                                                                                                                                                                |
| `/api/auth/password/reset/request` | `POST`  | Sends reset token email (supports Resend/Ses/KV mailers).                                                                                                                                                                          |
| `/api/auth/password/reset/confirm` | `POST`  | Applies a new password and revokes existing JWTs via `auth:usr:{userId}:revoked`.                                                                                                                                                  |
| `/api/auth/password/change`        | `POST`  | Authenticated password change (requires current password), validates strength, then revokes active JWTs.                                                                                                                           |
| `/api/users/me`                    | `GET`   | Returns the authenticated user (filters out password data).                                                                                                                                                                        |
| `/api/users/me`                    | `PATCH` | Updates profile fields (`name`, `image`), enforces validation, and bumps `auth:usr:{userId}:profile:version` in KV for session refresh.                                                                                            |

### Required Env (production)

```bash
AUTH_SECRET=your_random_secret
AUTH_URL=https://your-app.example.com
ENVIRONMENT=production
```

### Optional Env

```bash
# OAuth providers
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# Magic link
EMAIL_RESEND_API_KEY=...
EMAIL_SERVER=smtp://user:pass@smtp.example.com:587
EMAIL_FROM=noreply@yourdomain.com

# Local dev catchall inbox
DEV_EMAIL_TRAP_ENABLED=true
DEV_EMAIL_TRAP_MAX_EMAILS=50

# Auth toggles
AUTH_DISABLE_CREDENTIALS=false
AUTH_REQUIRE_EMAIL_VERIFIED=false
AUTH_SESSION_MAX_AGE=2592000

# RBAC bootstrap toggles
ALLOW_NULL_TENANT=true            # allow system-scope (single-founder) admin
MULTI_TENANT_ENABLED=true         # create personal org on first user (default true)
BOOTSTRAP_OWNER_SECRET=supersecret-token

# Analytics (for /analytics - shortlinks + referrals WAE queries)
CLOUDFLARE_ACCOUNT_ID=            # 32-char account ID (wrangler vars)
CLOUDFLARE_ANALYTICS_API_TOKEN=  # Secret: Account Analytics Read; set via: pnpm wrangler secret put CLOUDFLARE_ANALYTICS_API_TOKEN
# Bindings: OBCF_ANALYTICS_SHORTLINKS (shortlink_clicks), OBCF_ANALYTICS_REFERRALS (referral_clicks)
```

### OttaAI playground

When `packages.ottaai` is enabled, `/demo/cloudflare/ai` exercises the same server-side OttaAI routes used by product
features: chat at `POST /api/ai/complete` and embeddings at `POST /api/ai/embed`. Both derive the signed-in user's
tenant context on the Worker, resolve an eligible personal/workspace credential before the optional platform fallback,
and return only redacted provenance.

Set `AI_CREDENTIAL_SECRET` (or a rotating `AI_CREDENTIAL_KEYRING`) only when tenant credentials are enabled. Configure
`CLOUDFLARE_ACCOUNT_ID`, `CFAI_GATEWAY_NAME`, and `CFAI_GATEWAY_TOKEN` for provider-native authenticated AI Gateway
access. The platform floor uses `OTTAAI_PLATFORM_PROVIDER`, `OTTAAI_PLATFORM_MODEL`, and its matching
`CFAI_<PROVIDER>_API_KEY`; alternatively, enable Cloudflare Unified Billing and set `OTTAAI_PLATFORM_BILLING=unified`
plus `CFAI_API_TOKEN` (Workers AI Read). It also requires the `OBCF_KV` binding for the platform-spend limiter. The
shipped embeddings route is intentionally OpenAI-only and uses the task-pinned `text-embedding-3-small` model. It
returns vectors but does not persist them; connect a real retrieval feature to Vectorize deliberately rather than
treating the playground as a vector store.

Chat is split across two routes **by body size**, because the task is only known after the body is parsed:

| Route                   | Tasks                    | Body cap                              | Before the body is read                    |
| ----------------------- | ------------------------ | ------------------------------------- | ------------------------------------------ |
| `POST /api/ai/complete` | text tasks               | 512 KB, counted in bytes read         | session check                              |
| `POST /api/ai/vision`   | tasks declaring `vision` | image budget × 4/3 + 512 KB (≈ 11 MB) | session check + per-user throttle (10/min) |

The `scan` task reads an image into a JSON object (receipts, invoices, forms). `/api/ai/vision` takes
`{ task?, prompt, system?, images: [{ mimeType, data }] }`: base64 with no `data:` prefix, JPEG/PNG/GIF/WebP, and
answers with a parsed `json` object for tasks declaring `json`. What a task accepts, returns and spends (`maxTokens`) is
read from its declaration in `worker/lib/ai.ts`, never from the request. The image budget is `features.ottaai.images`
(`maxCount` 4, `maxBytes` 4 MB, `maxTotalBytes` 8 MB, `perUserPerMinute` 10), clamped to the package's provider floor.
The playground resizes photos to a 2048px edge before upload.

It needs a vision-capable model on a route that carries images: a tenant key for OpenAI, Anthropic or Google, or a
provider-key platform floor (for example `google-ai-studio` / `gemini-2.5-flash-lite`). A reply that does not parse
returns `502 INVALID_RESPONSE`.

Unified Billing supports chat and embeddings: chat uses Cloudflare's OpenAI-compatible REST endpoint and the OpenAI
embedding task uses AI Gateway's universal `/ai/run` endpoint. Cloudflare documents no image input on that endpoint, so
on a Unified Billing platform floor `scan` resolves `CAPABILITY_UNMET` (it runs on tenant keys only), and the admin AI
page says so per task. For BYOK deployments, configure the Gateway's Unified Billing fallback as `byok_only`; OttaAI
additionally sends `cf-aig-no-wholesale: true` on tenant-key requests. The browser sends only a task, a prompt and (for
`scan`) images; model/provider selection remains task- and server-owned. The route rejects a request-body `model`
override so client input cannot bypass capability, tenancy, or spend policy. See Cloudflare's
[REST API](https://developers.cloudflare.com/ai-gateway/usage/rest-api/) and
[Unified Billing](https://developers.cloudflare.com/ai-gateway/features/unified-billing/) docs when changing the
transport contract.

### Admin: AI Gateway config

When `packages.ottaai` is enabled, platform admins get a read-only snapshot at `/admin/infrastructure/ai` (API:
`GET /api/admin/ai/config`). It shows the live Cloudflare AI Gateway identity, frozen dials, task policies, provider
wire coverage, and whether secrets are **present**: never their values. Org admins still manage workspace keys at
`/admin/growth/ai-providers`. Editing config remains `ottabase.config.ts` + env; the dashboard exists so you do not have
to grep either. Open the [Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/) dashboard from that page
to inspect cache, logging, and rate limits on the gateway itself.

### Local dev email trap

- Set `DEV_EMAIL_TRAP_ENABLED=true` in local worker env to capture emails in KV instead of sending them.
- Open `/admin/infrastructure/dev-mail` to inspect magic links, verification emails, password reset emails, and
  queue-driven emails.
- The trap uses the existing `OBCF_KV` binding, so no extra service is required.

### First-user + admin guard

- The first successful sign-in atomically claims the system-scoped `platform_owner` grant (`organizationId: system`),
  the bootstrapped app owner, distinct from the org-scoped `owner` role.
- If `MULTI_TENANT_ENABLED` is true (default), session issuance also requires a personal organization, active owner
  membership, and matching org-scoped `owner` grant. Those tenant records are transactional; failed setup is surfaced
  instead of returning a partial account, and the same owner can safely retry.
- Set `ALLOW_NULL_TENANT=true` to run in single-founder mode (no org required; system scope is used by default).
- Manual recovery: `POST /api/admin/platform-owner/promote` with header `x-bootstrap-secret: $BOOTSTRAP_OWNER_SECRET`
  and body `{ "userId": "..." }` or `{ "email": "..." }` to provision the owner's workspace (in multi-tenant mode) and
  grant the `platform_owner` role.
- Admin APIs now require system-scope platform_owner/admin (org admins remain scoped to their orgs only).

## Database Setup

### Automated Migrations

**Zero-config!** Just define Models and call `/api/ottaorm/init`:

#### 1. Define Model

```typescript
// ottabase/models/Todo.ts
export const todosTable = sqliteTable('todos', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
});

export class Todo extends BaseModel {
    static entity = 'todos';
    static table = todosTable;
}
```

#### 2. Export in Schema

```typescript
// ottabase/db/schema.ts
export { todosTable } from '../models/Todo';
export { shortlinksTable } from '@ottabase/shortlinks';
```

#### 3. Initialize

```bash
curl -X POST http://localhost:3004/api/ottaorm/init
# ✅ Table created automatically!
```

Package models live in their packages (e.g. `@ottabase/shortlinks`, `@ottabase/ottablog`) and are registered directly
via `registerModels()`.

See [ottabase/migrations/README.md](./ottabase/migrations/README.md) for details.

## Brand Engine

**Per-app theme customization with preset templates and custom color overrides.**

### Features

- **Theme Presets** - 10 built-in presets (Default, Neo, Crisp, Funky, Artisan, Midnight, Rose, Verdant, Visited,
  Marquee)
- **Color Customization** - Override individual colors on top of presets
- **Light + Dark Modes** - Separate color palettes for each mode
- **Cursors** - Custom SVG or native cursors, persisted across preset changes
- **Logo Upload** - Support for logo, dark logo, icon, and OG image
- **CSS Variable Injection** - Automatic theme application via CSS custom properties
- **KV Cache** - 1-hour TTL cache for fast brand config reads
- **Preset as Template** - Presets expanded at save time (no runtime resolution)

### Admin UI

Access brand customization at `/admin/appearance/brand-kits/$kitId`:

1. **Theme Tab** - Select preset, generate palette, override colors
2. **Brand Tab** - Name, tagline, parent kit
3. **Logo Tab** - Upload logos (primary, dark, icon, OG image)
4. **Fonts Tab** - Typography for heading, body, handwriting
5. **Motion Tab** - Duration, easing (light/dark split)
6. **Cursors Tab** - Custom cursors per state (shared or light/dark split)
7. **Advanced Tab** - Spacing, radius, shadows, custom CSS

### Architecture

**Preset-as-Template Flow**:

```
User selects "Verdant" preset
  ↓
Backend expands preset to full tokens (color.light, color.dark, typography, etc.)
  ↓
Merge custom color overrides on top
  ↓
Save complete theme to DB (tokensJson column)
  ↓
Cache in KV (1-hour TTL)
  ↓
Runtime reads directly from DB/cache (no resolution needed)
  ↓
Apply to document via CSS variables
```

**Key Benefits**:

- ✅ Database is single source of truth
- ✅ No runtime theme registry lookups
- ✅ Works reliably in Cloudflare Workers (no isolate state issues)
- ✅ Custom color overrides merge cleanly on preset base
- ✅ Cursors persist when switching presets (user-configured, not in presets)
- ✅ Atomic updates (what you save = what renders)

### API Endpoints

| Endpoint                   | Method   | Description                           |
| -------------------------- | -------- | ------------------------------------- |
| `/api/brand`               | `GET`    | Resolved brand config for current app |
| `/api/brand/presets`       | `GET`    | List available theme presets (JSON)   |
| `/api/brand/kits`          | `GET`    | List brand kits for app               |
| `/api/brand/kits`          | `POST`   | Create brand kit                      |
| `/api/brand/kits/:id`      | `PUT`    | Update brand kit (re-expands preset)  |
| `/api/brand/kits/:id`      | `DELETE` | Delete brand kit                      |
| `/api/brand/kits/:id/logo` | `POST`   | Upload logo (type: logo/dark/icon/og) |

### Client Usage

```typescript
import { BrandProvider, useBrand } from '@ottabase/brand-engine-react';

function App() {
  return (
    <BrandProvider appId="my-app" apiEndpoint="/api/brand">
      <MyContent />
    </BrandProvider>
  );
}

function MyContent() {
  const { config, isLoading } = useBrand();
  // Brand theme automatically applied to document
  return <div>{config?.brandName}</div>;
}
```

See [@ottabase/brand-engine](../../packages/brand-engine/README.md) for detailed documentation.

## Scripts

| Command                 | Description                                             |
| ----------------------- | ------------------------------------------------------- |
| `pnpm dev`              | Vite dev server (fast local DX)                         |
| `pnpm dev:worker`       | Wrangler dev with local Cloudflare binding simulations  |
| `pnpm build`            | Build for production                                    |
| `pnpm preview`          | Build + run on `workerd` via Wrangler (Cloudflare-like) |
| `pnpm deploy`           | Build + deploy Worker + assets to Cloudflare            |
| `pnpm type-check`       | Type-check browser, Worker, and Node tooling separately |
| `pnpm cf-typegen`       | Generate the committed Cloudflare binding declaration   |
| `pnpm cf-typegen:check` | Verify the declaration matches `wrangler.jsonc` in CI   |

The package scripts are framework-level building blocks. From the repo root, prefer
`pnpm otta start otta-web [--env <name>]`; it reads the app's declared process topology, starts Vite and Wrangler
together for development, performs readiness checks, and supports any configured Wrangler environment locally. Local
Wrangler serves the tracked `public/` directory while Vite owns frontend HMR, so `pnpm dev` works on a clean checkout
without generating a placeholder `dist/index.html`. Preview and production environments explicitly use the built `dist/`
directory.

## Directory Structure

```
apps/otta-web/
├── cloudflare-worker.ts    # Cloudflare Worker entry (API routes)
├── ottabase/               # Server-side code
│   ├── migrations/         # Database migrations
│   ├── models/             # OttaORM models (Todo, etc.)
│   └── db/schema.ts        # Drizzle table schemas
├── src/                    # React application
│   ├── main.tsx           # App entry point
│   ├── router.tsx         # TanStack Router configuration
│   ├── ottabase/          # Client-side config
│   │   ├── config/        # App configuration
│   │   ├── hooks/         # Custom hooks
│   │   ├── providers/     # React providers
│   │   └── state/         # Jotai atoms
│   ├── pages/             # Page components
│   │   └── demo/          # Demo pages
│   └── providers/         # App providers wrapper
├── index.html             # HTML template
├── vite.config.ts         # Vite configuration
├── wrangler.jsonc         # Cloudflare Workers config (template; CI substitutes placeholders)
└── tailwind.config.cjs    # Tailwind CSS config
```

## Routes

### Pages

- `/` - Home page
- `/demo` - Demo gallery index
- `/login` - Login (OAuth / Magic Link / Credentials)
- `/register` - Registration (Credentials)
- `/dashboard` - Protected route
- `/admin/content/blog/new` - Blog post editor with hero image selection from Media Library (click-to-pick) and
  drag-and-drop image upload. Unsaved changes are detected and a confirmation dialog blocks accidental navigation away.
- `/admin/appearance/brand-kits` - Brand Kit gallery (admin only). Each card is a live specimen rendered in the kit's
  own theme: real colors, fonts, radius, and shadows.
- `/admin/appearance/brand-kits/:kitId` - Brand Kit editor (Brand, Logo, Theme, Fonts, Motion, Cursors, Advanced tabs)
  with a light/dark toggleable live preview, unsaved-change detection, and Ctrl+S to save.
- `/admin/appearance` - Site design: which kit and layout each route gets, menus in their slots
- `/demo/shadcn` - shadcn/ui components demo
- `/demo/ottaeditor` - Rich text editor demo
- `/demo/ottaorm` - OttaORM (User/Post CRUD) demo
- `/demo/spotlight` - Command palette and keyboard shortcuts demo
- `/demo/menus` - OttaMenu renderer variants demo
- `/demo/medialibrary` - Media viewer and lightbox demo
- `/demo/analytics` - Analytics track/query demo
- `/demo/auth` - Auth session and storage helper demo
- `/demo/brand-engine` - Brand runtime route resolution demo
- `/demo/layout` - OttaLayout presets and resolver demo
- `/demo/timezone` - Timezone utilities demo
- `/demo/cloudflare` - Cloudflare services index
- `/demo/cloudflare/d1` - D1 SQLite database demo
- `/demo/cloudflare/kv` - KV namespace demo
- `/demo/cloudflare/r2` - R2 object storage demo
- `/demo/cloudflare/queues` - Queues demo
- `/demo/cloudflare/rate-limiting` - Rate limiting demo
- `/demo/cloudflare/realtime` - Durable Objects realtime demo
- `/admin/infrastructure/jobs` - Background jobs: scheduled tasks and queue jobs (platform admin)
- `/shortlinks` - Shortlink management
- `/analytics` - Unified analytics (Core + Shortlinks + Referrals tabs, WAE), platform admins only

### API Endpoints

- `/api/health` - Worker health check
- `/api/brand/*` - Brand Engine API (presets, kits, logos)
- `/api/cloudflare/*` - Cloudflare service demos
- `/api/auth/*` - Custom auth routes (signin, signout, session, callbacks)
- `/api/auth/register` - Credentials registration
- `/api/auth/config` - Auth UI configuration
- `/api/ottaorm/*` - OttaORM CRUD endpoints
- `/api/analytics/core`, `/api/shortlinks/analytics`, `/api/referrals/analytics` - Core events, shortlink clicks and
  referral clicks for the /analytics tabs. System-admin only: Analytics Engine rows carry no organization, so the totals
  are platform-wide
- `/api/admin/cron` - Platform-admin task list/create API; manual runs use the same locked executor as scheduled ticks

### Scheduled Tasks

Cloudflare wakes the Worker every minute through the `* * * * *` trigger in `wrangler.jsonc`. The application-owned
registry in `ottabase/cron/index.ts` is the single source for both executable handlers and the admin handler list.
Stored task expressions are evaluated in UTC. Creation validates the registered handler, cron expression, task type, and
JSON payload in `ScheduledTask`, and initializes `nextRunAt`; manual runs and scheduled ticks share atomic locking and
persisted success/failure accounting. Long or retriable work is dispatched to the existing Queue binding.

## Using Cloudflare Bindings

### In Cloudflare Worker

```typescript
// cloudflare-worker.ts
export default {
    async fetch(request: Request, env: CloudflareEnv) {
        const db = createD1Client({ database: env.OBCF_D1 });
        const kv = createKVClient({ namespace: env.OBCF_KV });

        // Use D1
        const users = await db.query('SELECT * FROM users');

        // Use KV
        await kv.put('key', 'value', { expirationTtl: 60 });

        return Response.json({ users });
    },
};
```

### With OttaORM

```typescript
import { registerConnection } from '@ottabase/ottaorm';
import { Todo } from './ottabase/models/Todo';

// In worker
const driver = createD1Driver(env.OBCF_D1);
registerConnection('default', driver);

const todos = await Todo.all({ limit: 100 });
```

Worker collection reads are bounded by OttaORM. Set `OTTAORM_MAX_ALL_ROWS` in `wrangler.jsonc` (this template uses
`5000`); the runtime still enforces the shared 10,000-row hard ceiling. Prefer an explicit limit for a partial read or
`Model.pages({ perPage, where })` for a complete keyset scan. `pnpm cf-typegen` regenerates the committed ambient
`cloudflare-env.d.ts` from the Wrangler config and `.env.example`; `pnpm cf-typegen:check` regenerates a temporary
candidate with the same inputs, compares it byte-for-byte (apart from its temporary filename), and removes it again.
Browser and Worker sources intentionally use separate TypeScript programs so DOM globals never merge with Workerd's
`Request`, `Headers`, binding, or execution-context types.

## Cloudflare Setup

### Local Development

```bash
# No Cloudflare account needed. Remote bindings (Workers AI and rate limiting)
# are disabled locally; use a deployed environment to exercise those services.
# Local D1/KV/R2 stored in .wrangler/state/v3/
pnpm otta start otta-web

# Production-shaped local Worker (still local bindings; does not deploy)
pnpm otta start otta-web --env production

# Staging-shaped local Worker (dedicated local binding topology; does not deploy)
pnpm otta start otta-web --env staging
```

### Production Deployment

#### 1. Create Cloudflare Resources

Use the automated setup script (recommended):

```bash
pnpm cf:login   # authenticate
pnpm cf:setup   # creates D1, KV, R2, Queue, prints IDs for GitHub Secrets
pnpm cf:validate
```

Or manually:

```bash
pnpm wrangler login
pnpm wrangler d1 create ottabase-db
pnpm wrangler kv namespace create OBCF_KV
pnpm wrangler r2 bucket create ottabase-bucket
pnpm wrangler queues create ottabase-queue
```

#### 2. Set GitHub Secrets

`wrangler.jsonc` uses a **two-tier placeholder system**:

| Tier                             | Pattern               | Example               | Substituted by CI?                                                                        |
| -------------------------------- | --------------------- | --------------------- | ----------------------------------------------------------------------------------------- |
| Top-level                        | `YOUR_*`              | `YOUR_D1_DATABASE_ID` | **No**: local dev only; Wrangler ignores the value and uses local simulators              |
| `env.production` / `env.preview` | `ALL_CAPS_SNAKE_CASE` | `D1_DATABASE_ID`      | **Yes**: the value is the GitHub Secret name; CI substitutes the real UUID at deploy time |

Set these in your repository → Settings → Secrets → Actions:

- `D1_DATABASE_ID`, `KV_NAMESPACE_ID` (production)
- `D1_PREVIEW_DATABASE_ID`, `KV_PREVIEW_NAMESPACE_ID` (PR previews)
- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

To add a new secret: add an `ALL_CAPS` placeholder in `env.production`/`env.preview` → add the matching GitHub Secret.
CI auto-detects it. No other changes needed.

See [CLOUDFLARE_DEPLOY.md](../../docs/CLOUDFLARE_DEPLOY.md) for the full setup guide.

#### 3. Analytics (optional)

Shortlink and referral click tracking uses **Cloudflare Analytics Engine** (WAE). Clicks are written automatically; the
unified analytics page at `/analytics` requires:

1. **CLOUDFLARE_ACCOUNT_ID**: Set in `wrangler.jsonc` vars (32-char account ID from Cloudflare dashboard).

2. **CLOUDFLARE_ANALYTICS_API_TOKEN**: Create a token with **Account | Account Analytics | Read**:

    ```bash
    pnpm wrangler secret put CLOUDFLARE_ANALYTICS_API_TOKEN
    ```

    When prompted, paste your token. Without this, `/analytics` returns 503.

#### 4. Deploy

```bash
# Deploy to Cloudflare Workers
pnpm deploy

# Run migrations
curl -X POST https://your-app.workers.dev/api/ottaorm/init \
  -H "Authorization: Bearer ${MIGRATION_SECRET}"
```

## Demo Content

A fresh install is empty. Admin > Content > Content studio has a **Seed demo content** button (platform owner only) that
calls `POST /api/admin/demo-seed` and fills the site with a believable demo, written as real content rather than
placeholders:

- Four people on the team (Maya, Tomás, Priya and Jonas), created as users without a password, members of your
  organization with editor and author roles, with Unsplash portraits
- A media library of public Unsplash photographs, each with a title, alt text and caption
- Six months of posts: a four-part engineering series, six standalone articles, four monthly release notes, five short
  thoughts and three photo journals, with tags, categories, a series, hero images and spread publish dates, plus the
  kitchensink post that renders every block the editor supports
- Comment threads on four articles, six shortlinks, a main navigation and a footer menu assigned to their slots, and a
  few inbox notifications for you

Everything lives in `worker/fixtures/demo/` and is keyed on something stable (email, storage key, slug, short code, menu
slug), so the seed creates only what is missing. Run it again after editing and nothing you changed is touched. The
images are hotlinked from Unsplash, so the demo needs outbound network access to show them.

To delete the demo afterwards, remove the seeded posts, people, media, shortlinks and menus from their admin pages; the
seed never recreates something you deleted on purpose unless you run it again.

## Deleting Demo Pages

In production apps, you can safely delete:

- `src/pages/demo/` - All demo pages
- Demo routes in `src/router.tsx` (`/demo*`)
- Demo-only API handlers in `worker/routes/demo.ts`

## Documentation

- [OttaORM Package](../../packages/ottaorm/README.md) - Full ORM documentation
- [Migrations Guide](./ottabase/migrations/README.md) - Database migrations
- [Cloudflare Deploy](../../docs/CLOUDFLARE_DEPLOY.md) - Deployment guide
- [Cloudflare Config](../../docs/CLOUDFLARE_CONFIGURATION_GUIDE.md) - Bindings setup
