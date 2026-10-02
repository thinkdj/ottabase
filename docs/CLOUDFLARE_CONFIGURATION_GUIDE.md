# Cloudflare Configuration Guide for Ottabase

Complete guide for configuring your Ottabase application to work 100% with Cloudflare Workers using **OBCF\_\*** binding
names.

**OBCF = Ottabase Cloudflare** - A unique naming convention to avoid conflicts with other libraries and frameworks.

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Required Cloudflare Resources](#required-cloudflare-resources)
3. [Environment Variables](#environment-variables)
4. [Configuration Files](#configuration-files)
5. [Database Setup](#database-setup)
6. [Authentication Setup](#authentication-setup-optional)
7. [Verification Checklist](#verification-checklist)

---

## 🚀 Quick Start

> **📖 For deployment instructions, see [CLOUDFLARE_DEPLOY.md](CLOUDFLARE_DEPLOY.md)**

This guide covers Cloudflare resource configuration, bindings, environment variables, and code usage.

---

## 🔧 Required Cloudflare Resources

The following Cloudflare resources must be created and configured:

| Resource Type        | Binding Name                                                                   | Purpose                        | Created By                  |
| -------------------- | ------------------------------------------------------------------------------ | ------------------------------ | --------------------------- |
| **D1 Database**      | `OBCF_D1`                                                                      | Primary SQLite database        | `cf:setup` script           |
| **KV Namespace**     | `OBCF_KV`                                                                      | Key-value storage              | `cf:setup` script           |
| **R2 Bucket**        | `OBCF_R2`                                                                      | Object storage                 | `cf:setup` script           |
| **Queue**            | `OBCF_QUEUE`                                                                   | Async message processing       | `cf:setup` script           |
| **Durable Object**   | `OBCF_REALTIME`                                                                | WebSocket realtime connections | Auto-configured             |
| **Rate Limiter**     | `OBCF_RATE_LIMITER`                                                            | Request throttling             | Auto-configured             |
| **Analytics Engine** | `OBCF_ANALYTICS_CORE`, `OBCF_ANALYTICS_SHORTLINKS`, `OBCF_ANALYTICS_REFERRALS` | Event tracking                 | Auto-created on first write |

**Note:** Run `pnpm cf:login` before `pnpm cf:setup` if not authenticated. cf:setup outputs resource IDs for GitHub
Secrets; it does not modify wrangler.jsonc.

### Optional Resources

| Resource Type  | Binding Name      | Purpose                   | Setup Command                                                 |
| -------------- | ----------------- | ------------------------- | ------------------------------------------------------------- |
| **Hyperdrive** | `OBCF_HYPERDRIVE` | External database pooling | `wrangler hyperdrive create <name> --connection-string="..."` |

**For /analytics page:** The `/analytics` dashboard requires `CLOUDFLARE_ACCOUNT_ID` (set as a `var` in
`wrangler.jsonc`) and `CLOUDFLARE_ANALYTICS_API_TOKEN` (set as a Worker secret).

**Creating `CLOUDFLARE_ANALYTICS_API_TOKEN`:**

1. Go to **Cloudflare Dashboard → My Profile → [API Tokens](https://dash.cloudflare.com/profile/api-tokens)**
2. Click **Create Token → Create Custom Token**
3. Add permission: **Account | Account Analytics | Read**
4. (Optional) Restrict to your account under **Account Resources**
5. Copy the token value

**Registering the token:**

```bash
# Production — store as a Worker secret
pnpm wrangler secret put CLOUDFLARE_ANALYTICS_API_TOKEN

# Local dev — add to apps/<your-app>/.env.local (gitignored)
CLOUDFLARE_ANALYTICS_API_TOKEN=your-token-here
# PS: Analytics will NOT work locally.
```

Without this token, the `/analytics` page returns `503`. Analytics datasets are auto-created on first write.

---

## 🔐 Environment Variables

### Local Development (`.env.local`)

Create `apps/otta-web/.env.local` with the following (if using .env for local auth/R2):

```bash


# ============================================================
# AUTHENTICATION (Optional)
# ============================================================
# Generate with: openssl rand -base64 32
AUTH_SECRET=your-32-character-secret-here
AUTH_URL=http://localhost:3003

# OAuth providers auto-enable when both the client id and secret are present.
# GitHub OAuth
GITHUB_CLIENT_ID=your-github-oauth-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-client-secret

# Google OAuth
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret

# ============================================================
# CLOUDFLARE ACCOUNT (runtime features that call the Cloudflare API)
# ============================================================
# Read by the worker for /analytics, Workers AI and Cloudflare Images.
# R2, KV, D1 and Queues are reached through Worker bindings and need no credentials.
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
```

The Wrangler CLI (`wrangler deploy`, `pnpm cf:setup`) reads `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from your
shell or `wrangler login`; CI reads the GitHub secrets of the same names.

### Production Secrets (Cloudflare Dashboard)

Set these via Cloudflare Dashboard or `wrangler secret put`:

```bash
# Authentication
wrangler secret put AUTH_SECRET

# OAuth Providers (if enabled)
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET

# Schema migrations outside development (POST /api/ottaorm/init)
wrangler secret put MIGRATION_SECRET

# /analytics dashboard (optional, see above)
wrangler secret put CLOUDFLARE_ANALYTICS_API_TOKEN
```

`CLOUDFLARE_ACCOUNT_ID` is not a secret: in `env.production` / `env.preview` it is a `vars` placeholder that CI fills
from the GitHub secret of the same name.

---

## 📁 Configuration Files

### 1. `apps/otta-web/wrangler.jsonc`

**Status:** ✅ Template (do not modify programmatically)

`wrangler.jsonc` is a shared template. cf:setup does **not** modify it. `ALL_CAPS_SNAKE_CASE` placeholder values in
`env.production` and `env.preview` are **auto-detected** by `.github/scripts/substitute-wrangler-secrets.py` at deploy
time and substituted from GitHub Secrets, generating `wrangler.production.jsonc` or `wrangler.preview.jsonc`. The source
file is never modified. For local dev, `YOUR_*` top-level values are ignored (miniflare uses local simulators). For
multi-app: same placeholder name = shared resource; different names = isolated (prefixing is a convention).

**Key Bindings:**

```jsonc
{
    "d1_databases": [
        {
            "binding": "OBCF_D1",
            "database_name": "ottabase-db",
            "database_id": "YOUR_D1_DATABASE_ID", // Top-level: local dev only (simulators ignore this)
        },
    ],
    "kv_namespaces": [
        {
            "binding": "OBCF_KV",
            "id": "YOUR_KV_NAMESPACE_ID", // Top-level: local dev only (simulators ignore this)
        },
    ],
    "r2_buckets": [
        {
            "binding": "OBCF_R2",
            "bucket_name": "ottabase-bucket",
        },
    ],
    "queues": {
        "producers": [
            {
                "binding": "OBCF_QUEUE",
                "queue": "ottabase-queue",
            },
        ],
    },
    "durable_objects": {
        "bindings": [
            {
                "name": "OBCF_REALTIME",
                "class_name": "RealtimeActor",
            },
            {
                "name": "OBCF_WEBHOOK_ENDPOINT_QUOTA",
                "class_name": "WebhookEndpointQuota",
            },
        ],
    },
    "unsafe": {
        "bindings": [
            {
                "name": "OBCF_RATE_LIMITER",
                "type": "ratelimit",
                "namespace_id": "1001", // any integer locally; use a distinct one per app/env
            },
        ],
    },
}
```

### 2. `apps/otta-web/cloudflare-env.d.ts`

**Status:** ✅ Generated — regenerate with `pnpm --filter @ottabase/otta-web cf-typegen` after changing a binding

`wrangler types` writes the `CloudflareEnv` interface from `wrangler.jsonc`, so the two cannot drift (`cf-typegen:check`
verifies it). Excerpt:

```typescript
interface CloudflareEnv {
    OBCF_KV: KVNamespace;
    OBCF_R2: R2Bucket;
    OBCF_D1: D1Database;
    OBCF_QUEUE: Queue;
    OBCF_REALTIME: DurableObjectNamespace<import('./cloudflare-worker').RealtimeActor>;
    OBCF_WEBHOOK_ENDPOINT_QUOTA: DurableObjectNamespace<import('./cloudflare-worker').WebhookEndpointQuota>;
    OBCF_RATE_LIMITER: RateLimit;
    // ...analytics datasets, OBCF_ASSETS, optional OBCF_AI / OBCF_BROWSER, and vars
}
```

### 3. `apps/otta-web/cloudflare-worker.ts`

**Status:** ✅ Already configured

**Exports Durable Objects** (every class named in `durable_objects` must be exported from the Wrangler `main` entry):

```typescript
import { RealtimeActor } from '@ottabase/cf-realtime/server';
export { WebhookEndpointQuota } from './worker/durable-objects/WebhookEndpointQuota';

export { RealtimeActor };
```

---

## 🗄️ Database Setup

### Using Drizzle with D1

The app uses `@ottabase/db` package with Drizzle adapter for D1. OttaORM models read the connection registered as
`'default'`; otta-web registers it once per isolate in `ensureDbConnection(env)` (`worker/lib/db-utils.ts`), which the
worker entry calls before routing. The underlying calls are:

```typescript
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { User, registerConnection } from '@ottabase/ottaorm';

export default {
    async fetch(request: Request, env: CloudflareEnv) {
        // Register the D1 driver every model uses by default
        registerConnection('default', createD1Driver(env.OBCF_D1));

        // Prefer models over raw Drizzle (see AGENTS.MD "OttaORM First")
        const user = await User.findByEmail('admin@example.com');

        return Response.json(user?.toJson() ?? null);
    },
};
```

---

## 🔐 Authentication Setup (Optional)

The `@ottabase/auth` package provides a lightweight, dependency-free auth implementation with D1.

### 1. Enable Auth Feature

Ensure `@ottabase/auth` is installed and configured in your application.

### 2. Configure Auth

```typescript
// worker/routes/auth.ts
import { handleAuthRequest } from '@ottabase/auth/backend';

// Route every /api/auth/* request through the auth handler. Providers are auto-configured
// from environment variables (see below) — no config-object builder is required.
export function handleAuth(request: Request, env: CloudflareEnv) {
    return handleAuthRequest(request, env);
}
```

### 3. Set Environment Variables

Add to `.env.local` (Google OAuth is enabled automatically when both vars are present):

```bash
AUTH_SECRET=your-secret-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

---

## ✅ Verification Checklist

### Pre-Deployment Checklist

- [ ] **Cloudflare Resources Created**
    - [ ] D1 Database exists: `wrangler d1 list`
    - [ ] KV Namespace exists: `wrangler kv namespace list`
    - [ ] R2 Bucket exists: `wrangler r2 bucket list`
    - [ ] Queue exists: `wrangler queues list`

- [ ] **Configuration Files Updated**
    - [ ] GitHub Secrets set for production: `D1_DATABASE_ID`, `KV_NAMESPACE_ID`
    - [ ] GitHub Secrets set for PR preview: `D1_PREVIEW_DATABASE_ID`, `KV_PREVIEW_NAMESPACE_ID`
    - [ ] `cloudflare-env.d.ts` includes all OBCF\_\* bindings

- [ ] **Environment Variables Set**
    - [ ] `.env.local` created for local development
    - [ ] Production secrets set via `wrangler secret put`

- [ ] **Database Schema Generated**
    - [ ] Migrations applied via OttaORM: `curl -X POST http://localhost:3004/api/ottaorm/init`

- [ ] **Build & Deploy**
    - [ ] Local build works: `pnpm build`
    - [ ] Worker build works: `pnpm build` (TanStack) or `pnpm build:worker` (Next.js)
    - [ ] Preview works: `pnpm preview`
    - [ ] Deploy successful: `pnpm deploy`

### Post-Deployment Verification

Test each binding in production:

```bash
# Test the worker + D1 (a JSON response — even an auth error — proves the worker is serving the API)
curl https://your-app.workers.dev/api/ottaorm/users
```

The `/api/cloudflare/*` demo routes (KV, R2, D1 todos, queues) are exercised from the demo pages under
`src/pages/demo/cloudflare/`; sign in and use those pages rather than raw `curl`.

---

## 🔍 Accessing Cloudflare Bindings in Code

### Cloudflare Worker (Fetch Handler)

```typescript
// cloudflare-worker.ts
export default {
    async fetch(request: Request, env: CloudflareEnv) {
        // Access bindings with OBCF_* names
        const db = env.OBCF_D1; // D1 Database
        const kv = env.OBCF_KV; // KV Namespace
        const r2 = env.OBCF_R2; // R2 Bucket
        const queue = env.OBCF_QUEUE; // Queue
        const realtime = env.OBCF_REALTIME; // Durable Object

        // D1 via OttaORM (preferred) — see "Database Setup" above:
        // registerConnection('default', createD1Driver(db));
        const kvClient = createKVClient({ namespace: kv });
        const r2Client = createR2Client({ bucket: r2 });
    },
};
```

### Package Usage

All bindings are accessed via `@ottabase/cf` package:

```typescript
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { createKVClient } from '@ottabase/cf/kv';
import { createR2Client } from '@ottabase/cf/r2';
import { createQueuesClient } from '@ottabase/cf/queues';
import { createRateLimitingClient } from '@ottabase/cf/rate-limiting';
```

---

## 🛠 Manual Configuration (Advanced)

If you prefer manual setup instead of `cf:setup`:

### 1. Login First

```bash
pnpm cf:login   # or wrangler login
```

### 2. Create D1 Database

```bash
wrangler d1 create ottabase-db
# Copy database_id → GitHub Secret D1_DATABASE_ID (for CI) or replace YOUR_D1_DATABASE_ID in wrangler.jsonc (local)
```

### 3. Create KV Namespace

```bash
wrangler kv namespace create OBCF_KV
wrangler kv namespace create OBCF_KV --preview
# Copy IDs → GitHub Secret KV_NAMESPACE_ID (for CI) or replace in wrangler.jsonc (local)
```

### 4. Create R2 Bucket

```bash
wrangler r2 bucket create ottabase-bucket
wrangler r2 bucket create ottabase-bucket-preview
```

### 5. Create Queue

```bash
wrangler queues create ottabase-queue
wrangler queues create ottabase-queue-preview
```

### 6. Create Preview Resources (for PR deploys)

```bash
wrangler d1 create ottabase-db-preview
wrangler r2 bucket create ottabase-bucket-preview
```

### 7. Configure GitHub Secrets

**Production** (main deploy — placeholder values in env.production are auto-detected):

- `D1_DATABASE_ID`, `KV_NAMESPACE_ID`

**Preview** (PR deploy — placeholder values in env.preview are auto-detected):

- `D1_PREVIEW_DATABASE_ID`, `KV_PREVIEW_NAMESPACE_ID`

Local dev does not need these — `wrangler dev` uses local simulators regardless of placeholder values. To add a new
secret: set the placeholder in `wrangler.jsonc`, add the secret to GitHub. CI auto-detects the rest.

---

## 📚 Additional Resources

- **Packages Documentation:**
    - `@ottabase/db` - [packages/db/README.md](../packages/db/README.md)
    - `@ottabase/cf` - [packages/cf/README.md](../packages/cf/README.md)
    - `@ottabase/auth` - [packages/auth/README.md](../packages/auth/README.md)

- **Cloudflare Documentation:**
    - [D1 Database](https://developers.cloudflare.com/d1/)
    - [KV Storage](https://developers.cloudflare.com/kv/)
    - [R2 Storage](https://developers.cloudflare.com/r2/)
    - [Queues](https://developers.cloudflare.com/queues/)
    - [Durable Objects](https://developers.cloudflare.com/durable-objects/)

- **Project Documentation:**
    - [CLOUDFLARE_DEPLOY.md](CLOUDFLARE_DEPLOY.md) - Complete deployment guide with CI/CD setup
    - [AGENTS.MD](../AGENTS.MD) - Monorepo architecture

---

## 🐛 Troubleshooting

### "OBCF_D1 binding not found"

**Cause:** D1 binding not configured or incorrect binding name.

**Solution:**

1. Check `wrangler.jsonc` has `d1_databases` with binding `"OBCF_D1"`
2. Verify `database_id` is not a placeholder
3. Run `wrangler d1 list` to verify database exists

### "Migration not applied"

**Cause:** D1 database doesn't have schema.

**Solution:** Ottabase uses OttaORM auto-init, not wrangler migrations:

```bash
# Local (with dev server running on port 3004)
curl -X POST http://localhost:3004/api/ottaorm/init

# Production (requires MIGRATION_SECRET)
curl -X POST https://your-app.workers.dev/api/ottaorm/init \
  -H "Authorization: Bearer ${MIGRATION_SECRET}"
```

### "Type errors with CloudflareEnv"

**Cause:** TypeScript definitions not up to date.

**Solution:**

```bash
pnpm --filter @ottabase/otta-web cf-typegen
```

### "Wrong binding name in code"

**Cause:** Code reads a binding name that `wrangler.jsonc` does not define (e.g. `env.DB`).

**Solution:** Every binding uses the `OBCF_*` prefix — `env.OBCF_D1`, `env.OBCF_KV`, `env.OBCF_R2`, `env.OBCF_QUEUE`,
`env.OBCF_REALTIME`. Regenerate `cloudflare-env.d.ts` and let the type-checker find the stragglers.

---

## 📝 Summary

### Required Configuration Files

- ✅ `wrangler.jsonc` - Cloudflare bindings (OBCF\_\* names); `ALL_CAPS` placeholder values are auto-detected and
  substituted from GitHub Secrets via `substitute-wrangler-secrets.py`
- ✅ `cloudflare-env.d.ts` - TypeScript definitions, generated from `wrangler.jsonc` by `cf-typegen`
- ✅ `cloudflare-worker.ts` - Durable Object exports
- ✅ `.env.local` - Local environment variables (optional)

### Key Binding Names (OBCF\_\*)

| Binding             | Type           | Access                  |
| ------------------- | -------------- | ----------------------- |
| `OBCF_D1`           | D1 Database    | `env.OBCF_D1`           |
| `OBCF_KV`           | KV Namespace   | `env.OBCF_KV`           |
| `OBCF_R2`           | R2 Bucket      | `env.OBCF_R2`           |
| `OBCF_QUEUE`        | Queue          | `env.OBCF_QUEUE`        |
| `OBCF_REALTIME`     | Durable Object | `env.OBCF_REALTIME`     |
| `OBCF_RATE_LIMITER` | Rate Limiter   | `env.OBCF_RATE_LIMITER` |
| `OBCF_HYPERDRIVE`   | Hyperdrive     | `env.OBCF_HYPERDRIVE`   |

### Key Environment Variables

| Variable                         | Required      | Purpose                                          |
| -------------------------------- | ------------- | ------------------------------------------------ |
| `D1_DATABASE_ID`                 | Yes (deploy)  | D1 database UUID (wrangler placeholder)          |
| `CLOUDFLARE_API_TOKEN`           | Yes (deploy)  | Wrangler CLI / CI deploys (GitHub secret)        |
| `CLOUDFLARE_ACCOUNT_ID`          | Yes (deploy)  | Wrangler CLI / CI; worker var for analytics & AI |
| `AUTH_SECRET`                    | If using auth | Session signing secret                           |
| `MIGRATION_SECRET`               | Recommended   | Authorizes `/api/ottaorm/init` outside dev       |
| `CLOUDFLARE_ANALYTICS_API_TOKEN` | Optional      | `/analytics` dashboard                           |

---

**Need help?** Check the troubleshooting section or review package READMEs for detailed API documentation.

**OBCF\_\* Naming Convention** ensures your Ottabase Cloudflare bindings are unique and conflict-free! 🚀
