# Ottabase Template App (TanStack)

TanStack Router + Query template with automated OttaORM migrations and Cloudflare Workers deployment.

## Features

- **TanStack Router** - Type-safe routing with file-based structure
- **TanStack Query** - Powerful async state management
- **OttaORM** - Fat models with automated migrations
- **Auth.js** - OAuth, Magic Link, and Credentials authentication
- **Vite** - Fast development server and optimized builds
- **Cloudflare Workers** - D1, KV, R2, Queues, Rate Limiting, Durable Objects
- **Mantine + shadcn/ui** - Flexible UI component libraries
- **Jotai** - Global state management

## Quick Start

```bash
# Install
pnpm install

# Start Vite dev server (fast)
pnpm dev

# OR start with Cloudflare Workers (full features)
pnpm dev:worker

# Initialize database (creates all tables automatically)
curl -X POST http://localhost:3004/api/ottaorm/init

# Done! Visit http://localhost:3004
```

## Authentication

This template ships with Auth.js + D1 integration and tighter session handling:

- **UI**: `/login`, `/register`, `/dashboard`, `/profile`
- **Backend**: `/api/auth/*`, `/api/auth/register`, `/api/users/me`
- **Session freshness**: Profile edits bump `auth:usr:{userId}:profile:version` in KV so the next `/api/auth/session`
  refresh pulls the updated name/image without polling D1 constantly.
- **Rate limiting**: Auth endpoints run through the shared rate limiter (per IP bucket for signin, register, signout).
- **Email flows**: `/api/auth/verify-email`, `/api/auth/verify-email/resend`, `/api/auth/password/reset/request`,
  `/api/auth/password/reset/confirm`.
- **Credentials storage**: PBKDF2 hashes in `users.password_hash`, email verification/roles stored alongside.
- **Session sync tip**: If you mutate `/api/users/me`, call `refreshSession()` (or `updateUser()`) so the cached local
  session picks up the KV-triggered profile version bump immediately.
- **Tenant/app headers**: The client now sets `X-App-Id: ottabase-template-app` and, when available, `X-Org-Id` from the
  current session into all API calls; these values are also mirrored in global state atoms for UI needs.

### Auth API Endpoints

| Endpoint                           | Method  | Notes                                                                                                                                                   |
| ---------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/auth/register`               | `POST`  | Credentials registration + auto organization/role setup. Returns `{ user, organizationId, organizationRole, assignedRole, requiresEmailVerification }`. |
| `/api/auth/verify-email`           | `POST`  | Consume verification token from email link after registration or resend.                                                                                |
| `/api/auth/verify-email/resend`    | `POST`  | Sends a new verification token; rate-limited by `enforceRateLimit`.                                                                                     |
| `/api/auth/password/reset/request` | `POST`  | Sends reset token email (supports Resend/Ses/KV mailers).                                                                                               |
| `/api/auth/password/reset/confirm` | `POST`  | Applies a new password and revokes existing JWTs via `auth:usr:{userId}:revoked`.                                                                       |
| `/api/users/me`                    | `GET`   | Returns the authenticated user (filters out password data).                                                                                             |
| `/api/users/me`                    | `PATCH` | Updates profile fields (`name`, `image`), enforces validation, and bumps `auth:usr:{userId}:profile:version` in KV for session refresh.                 |

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

### First-user + admin guard

- First successful sign-in when `users.count() === 1` auto-creates a system-scoped `owner` role (organizationId:
  `system`).
- If `MULTI_TENANT_ENABLED` is true (default), a personal org is created for that first user and linked as owner.
- Set `ALLOW_NULL_TENANT=true` to run in single-founder mode (no org required; system scope is used by default).
- Manual recovery: `POST /api/admin/owner/promote` with header `x-bootstrap-secret: $BOOTSTRAP_OWNER_SECRET` and body
  `{ "userId": "..." }` or `{ "email": "..." }` to grant the system owner role.
- Admin APIs now require system-scope owner/admin (org admins remain scoped to their orgs only).

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

- **Theme Presets** - 8 built-in presets (Default, Neo, Crisp, Funky, Artisan, Midnight, Rose, Verdant)
- **Color Customization** - Override individual colors on top of presets
- **Light + Dark Modes** - Separate color palettes for each mode
- **Cursors** - Custom SVG or native cursors, persisted across preset changes
- **Logo Upload** - Support for logo, dark logo, icon, and OG image
- **CSS Variable Injection** - Automatic theme application via CSS custom properties
- **KV Cache** - 1-hour TTL cache for fast brand config reads
- **Preset as Template** - Presets expanded at save time (no runtime resolution)

### Admin UI

Access brand customization at `/admin/brand-engine/kits/[id]`:

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

| Command           | Description                                             |
| ----------------- | ------------------------------------------------------- |
| `pnpm dev`        | Vite dev server (fast local DX)                         |
| `pnpm dev:worker` | Wrangler dev with Cloudflare bindings                   |
| `pnpm build`      | Build for production                                    |
| `pnpm preview`    | Build + run on `workerd` via Wrangler (Cloudflare-like) |
| `pnpm deploy`     | Build + deploy Worker + assets to Cloudflare            |
| `pnpm type-check` | TypeScript type checking                                |
| `pnpm cf-typegen` | Generate Cloudflare types from wrangler.jsonc           |

## Directory Structure

```
apps/ottabase-template-app-tanstack/
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
- `/admin/brand-engine` - Brand kit list (admin only)
- `/admin/brand-engine/kits/:id` - Brand kit editor (Theme, Brand, Logo, Fonts, Motion, Cursors, Advanced tabs)
- `/demo/mantine` - Mantine UI components demo
- `/demo/shadcn` - shadcn/ui components demo
- `/demo/ottaeditor` - Rich text editor demo
- `/demo/ottaorm` - OttaORM (User/Post CRUD) demo
- `/demo/timezone` - Timezone utilities demo
- `/demo/cloudflare` - Cloudflare services index
- `/demo/cloudflare/d1` - D1 SQLite database demo
- `/demo/cloudflare/kv` - KV namespace demo
- `/demo/cloudflare/r2` - R2 object storage demo
- `/demo/cloudflare/queues` - Queues demo
- `/demo/cloudflare/rate-limiting` - Rate limiting demo
- `/demo/cloudflare/realtime` - Durable Objects realtime demo
- `/shortlinks` - Shortlink management
- `/analytics` - Unified analytics (Shortlinks + Referrals tabs, WAE)

### API Endpoints

- `/api/health` - Worker health check
- `/api/brand/*` - Brand Engine API (presets, kits, logos)
- `/api/cloudflare/*` - Cloudflare service demos
- `/api/auth/*` - Auth.js routes (signin, signout, session, callbacks)
- `/api/auth/register` - Credentials registration
- `/api/auth/config` - Auth UI configuration
- `/api/ottaorm/*` - OttaORM CRUD endpoints
- `/api/shortlinks/analytics` - Shortlink clicks (powers /analytics Shortlinks tab)
- `/api/referrals/analytics` - Referral clicks (powers /analytics Referrals tab)

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
import { setDriver } from '@ottabase/ottaorm';
import { Todo } from './ottabase/models/Todo';

// In worker
const driver = createD1Driver(env.OBCF_D1);
setDriver(driver);

const todos = await Todo.all();
```

## Cloudflare Setup

### Local Development

```bash
# No Cloudflare account needed!
# Local D1/KV/R2 stored in .wrangler/state/v3/
pnpm dev:worker
```

### Production Deployment

#### 1. Create Cloudflare Resources

```bash
# Login
pnpm wrangler login

# Create D1 database
pnpm wrangler d1 create ottabase-db

# Create KV namespace
pnpm wrangler kv:namespace create OTTABASE_KV

# Create R2 bucket
pnpm wrangler r2 bucket create ottabase-bucket

# Create Queue
pnpm wrangler queues create ottabase-queue
```

#### 2. Update wrangler.jsonc

Update the IDs in `wrangler.jsonc` with your actual:

- D1 database ID
- KV namespace ID
- R2 bucket name
- Queue name

#### 3. Analytics (optional)

Shortlink and referral click tracking uses **Cloudflare Analytics Engine** (WAE). Clicks are written automatically; the
unified analytics page at `/analytics` requires:

1. **CLOUDFLARE_ACCOUNT_ID** – Set in `wrangler.jsonc` vars (32-char account ID from Cloudflare dashboard).

2. **CLOUDFLARE_ANALYTICS_API_TOKEN** – Create a token with **Account | Account Analytics | Read**:

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

## Deleting Demo Content

In production apps, you can safely delete:

- `src/pages/demo/` - All demo pages
- Related routes in `src/router.tsx`
- Demo API handlers in `cloudflare-worker.ts`

## Documentation

- [OttaORM Package](../../packages/ottaorm/README.md) - Full ORM documentation
- [Migrations Guide](./ottabase/migrations/README.md) - Database migrations
- [Cloudflare Deploy](../../CLOUDFLARE_DEPLOY.md) - Deployment guide
- [Cloudflare Config](../../CLOUDFLARE_CONFIGURATION_GUIDE.md) - Bindings setup
