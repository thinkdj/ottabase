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

| Resource Type        | Binding Name        | Purpose                        | Created By                  |
| -------------------- | ------------------- | ------------------------------ | --------------------------- |
| **D1 Database**      | `OBCF_D1`           | Primary SQLite database        | `cf:setup` script           |
| **KV Namespace**     | `OBCF_KV`           | Key-value storage              | `cf:setup` script           |
| **R2 Bucket**        | `OBCF_R2`           | Object storage                 | `cf:setup` script           |
| **Queue**            | `OBCF_QUEUE`        | Async message processing       | `cf:setup` script           |
| **Durable Object**   | `OBCF_REALTIME`     | WebSocket realtime connections | Auto-configured             |
| **Rate Limiter**     | `OBCF_RATE_LIMITER` | Request throttling             | Auto-configured             |
| **Analytics Engine** | `OBCF_ANALYTICS_*`  | Event tracking                 | Auto-created on first write |

**Note:** Run `pnpm cf:login` before `pnpm cf:setup` if not authenticated. cf:setup outputs resource IDs for GitHub
Secrets; it does not modify wrangler.jsonc.

### Optional Resources

| Resource Type  | Binding Name      | Purpose                   | Setup Command                                                 |
| -------------- | ----------------- | ------------------------- | ------------------------------------------------------------- |
| **Hyperdrive** | `OBCF_HYPERDRIVE` | External database pooling | `wrangler hyperdrive create <name> --connection-string="..."` |

**For /analytics page:** Set `CLOUDFLARE_ACCOUNT_ID` (vars) and `CLOUDFLARE_ANALYTICS_API_TOKEN` (secret) with
`Account Analytics` Read permission. Analytics datasets are auto-created on first write.

---

## 🔐 Environment Variables

### Local Development (`.env.local`)

Create `apps/ottabase-template-app-tanstack/.env.local` with the following (if using .env for local auth/R2):

```bash


# ============================================================
# AUTHENTICATION (Optional - Auth.js v5)
# ============================================================
# Generate with: openssl rand -base64 32
AUTH_SECRET=your-32-character-secret-here
NEXTAUTH_SECRET=your-32-character-secret-here
NEXTAUTH_URL=http://localhost:3000

# Enable auth providers (true/false)
AUTH_LOGIN_CREDENTIALS=true
AUTH_LOGIN_GITHUB=false
AUTH_LOGIN_GOOGLE=false

# GitHub OAuth (if AUTH_LOGIN_GITHUB=true)
AUTH_GITHUB_ID=your-github-oauth-client-id
AUTH_GITHUB_SECRET=your-github-oauth-client-secret

# Google OAuth (if AUTH_LOGIN_GOOGLE=true)
AUTH_GOOGLE_ID=your-google-oauth-client-id
AUTH_GOOGLE_SECRET=your-google-oauth-client-secret

# ============================================================
# CLOUDFLARE R2 (Server-side API Access)
# ============================================================
# Only needed if accessing R2 via REST API (not Worker binding)
# Get from: https://dash.cloudflare.com/ > R2 > Manage R2 API Tokens
CF_ACCOUNT_ID=your-cloudflare-account-id
CF_R2_ACCESS_KEY_ID=your-32-character-r2-access-key
CF_R2_SECRET_ACCESS_KEY=your-43-character-r2-secret-key
CF_R2_BUCKET_NAME=ottabase-bucket
CF_R2_PUBLIC_URL=https://your-bucket.r2.cloudflarestorage.com

# ============================================================
# CLOUDFLARE API (For scripts/automation)
# ============================================================
# Only needed for wrangler CLI operations
CF_API_TOKEN=your-cloudflare-api-token

# ============================================================
# NEXT.JS TELEMETRY
# ============================================================
NEXT_TELEMETRY_DISABLED=1
```

### Production Secrets (Cloudflare Dashboard)

Set these via Cloudflare Dashboard or `wrangler secret put`:

```bash
# Authentication
wrangler secret put AUTH_SECRET
wrangler secret put NEXTAUTH_SECRET

# OAuth Providers (if enabled)
wrangler secret put AUTH_GITHUB_ID
wrangler secret put AUTH_GITHUB_SECRET
wrangler secret put AUTH_GOOGLE_ID
wrangler secret put AUTH_GOOGLE_SECRET

# Cloudflare API (if needed for runtime operations)
wrangler secret put CF_ACCOUNT_ID
wrangler secret put CF_API_TOKEN
wrangler secret put CF_R2_ACCESS_KEY_ID
wrangler secret put CF_R2_SECRET_ACCESS_KEY
```

---

## 📁 Configuration Files

### 1. `apps/ottabase-template-app-tanstack/wrangler.jsonc`

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
        ],
    },
    "unsafe": {
        "bindings": [
            {
                "name": "OBCF_RATE_LIMITER",
                "type": "ratelimit",
            },
        ],
    },
}
```

### 3. `apps/ottabase-template-app-tanstack/types/cloudflare.d.ts`

**Status:** ✅ Already configured

**Type Definitions:**

```typescript
export interface CloudflareEnv {
    // D1 Database (OBCF = Ottabase Cloudflare)
    OBCF_D1?: D1Database;

    // KV Namespace
    OBCF_KV?: KVNamespace;

    // R2 Bucket
    OBCF_R2?: R2Bucket;

    // Queue
    OBCF_QUEUE?: Queue;

    // Hyperdrive (uncomment when configured)
    // OBCF_HYPERDRIVE?: Hyperdrive;

    // Rate Limiter
    OBCF_RATE_LIMITER?: RateLimiter;

    // Durable Objects
    OBCF_REALTIME?: DurableObjectNamespace;

    // Add more bindings as needed
}
```

### 4. `apps/ottabase-template-app-tanstack/cloudflare-worker.ts`

**Status:** ✅ Already configured

**Exports Durable Objects:**

```typescript
// Re-export RealtimeActor for Cloudflare bindings
export { RealtimeActor } from '@ottabase/cf-realtime/server';
```

---

## 🗄️ Database Setup

### Using Drizzle with D1

The app uses `@ottabase/db` package with Drizzle adapter for D1.

```typescript
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createD1Driver } from '@ottabase/db/drizzle-d1';

export async function GET() {
    const { env } = await getCloudflareContext();

    const driver = createD1Driver(env.OBCF_D1);
    const db = driver.getDb();

    const users = await db.select().from(usersTable);

    return Response.json(users);
}
```

---

## 🔐 Authentication Setup (Optional)

The `@ottabase/auth` package provides Auth.js v5 integration with D1.

### 1. Enable Auth Feature

Ensure `@ottabase/auth` is installed and configured in your application.

### 2. Configure Auth

```typescript
// app/auth.ts
import { createOttabaseAuthConfig, createGoogleProvider } from '@ottabase/auth';

export const authConfig = createOttabaseAuthConfig({
    d1: env.OBCF_D1,
    providers: [
        createGoogleProvider(env),
        // Add more providers
    ],
});
```

### 4. Configure Auth

```typescript
// app/auth.ts
import { createOttabaseAuthConfig, createGoogleProvider } from '@ottabase/auth';

export const authConfig = createOttabaseAuthConfig({
    d1: env.OBCF_D1,
    providers: [
        createGoogleProvider(env),
        // Add more providers
    ],
});
```

### 5. Set Environment Variables

Add to `.env.local`:

```bash
AUTH_SECRET=your-secret-here
AUTH_GOOGLE_ID=your-google-client-id
AUTH_GOOGLE_SECRET=your-google-client-secret
```

---

## ✅ Verification Checklist

### Pre-Deployment Checklist

- [ ] **Cloudflare Resources Created**
    - [ ] D1 Database exists: `wrangler d1 list`
    - [ ] KV Namespace exists: `wrangler kv:namespace list`
    - [ ] R2 Bucket exists: `wrangler r2 bucket list`
    - [ ] Queue exists: `wrangler queues list`

- [ ] **Configuration Files Updated**
    - [ ] GitHub Secrets set for production: `D1_DATABASE_ID`, `KV_NAMESPACE_ID`
    - [ ] GitHub Secrets set for PR preview: `D1_PREVIEW_DATABASE_ID`, `KV_PREVIEW_NAMESPACE_ID`
    - [ ] `types/cloudflare.d.ts` includes all OBCF\_\* bindings

- [ ] **Environment Variables Set**
    - [ ] `.env.local` created for local development
    - [ ] Production secrets set via `wrangler secret put`

- [ ] **Database Schema Generated**
    - [ ] Migrations applied to D1: `wrangler d1 migrations apply`

- [ ] **Build & Deploy**
    - [ ] Local build works: `pnpm build`
    - [ ] Worker build works: `pnpm build:worker`
    - [ ] Preview works: `pnpm preview`
    - [ ] Deploy successful: `pnpm deploy`

### Post-Deployment Verification

Test each binding in production:

```bash
# Test D1
curl https://your-app.workers.dev/api/ottaorm/users

# Test KV (if you have an endpoint)
curl https://your-app.workers.dev/api/cloudflare/kv/test

# Test R2 (if you have an endpoint)
curl https://your-app.workers.dev/api/cloudflare/r2/list
```

---

## 🔍 Accessing Cloudflare Bindings in Code

### App Router (Server Components & Route Handlers)

```typescript
import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function GET() {
    const { env } = await getCloudflareContext();

    // Access bindings with OBCF_* names
    const db = env.OBCF_D1; // D1 Database
    const kv = env.OBCF_KV; // KV Namespace
    const r2 = env.OBCF_R2; // R2 Bucket
    const queue = env.OBCF_QUEUE; // Queue
    const realtime = env.OBCF_REALTIME; // Durable Object

    // Use with @ottabase packages
    // D1 via OttaORM (preferred):
    // import { createD1Driver } from '@ottabase/db/drizzle-d1';
    // const driver = createD1Driver(db); setDriver(driver);
    const kvClient = createKVClient({ namespace: kv });
    const r2Client = createR2Client({ bucket: r2 });
}
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
    - `@ottabase/db` - [packages/db/README.md](packages/db/README.md)
    - `@ottabase/cf` - [packages/cf/README.md](packages/cf/README.md)
    - `@ottabase/auth` - [packages/auth/README.md](packages/auth/README.md)

- **Cloudflare Documentation:**
    - [D1 Database](https://developers.cloudflare.com/d1/)
    - [KV Storage](https://developers.cloudflare.com/kv/)
    - [R2 Storage](https://developers.cloudflare.com/r2/)
    - [Queues](https://developers.cloudflare.com/queues/)
    - [Durable Objects](https://developers.cloudflare.com/durable-objects/)

- **Project Documentation:**
    - [CLOUDFLARE_DEPLOY.md](CLOUDFLARE_DEPLOY.md) - Complete deployment guide with CI/CD setup
    - [AGENTS.MD](AGENTS.MD) - Monorepo architecture

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

**Solution:**

```bash
# Local
wrangler d1 migrations apply ottabase-db --local

# Production
wrangler d1 migrations apply ottabase-db --remote
```

### "Type errors with CloudflareEnv"

**Cause:** TypeScript definitions not up to date.

**Solution:**

```bash
pnpm cf-typegen
```

### "Wrong binding name in code"

**Cause:** Old binding names (`DB`, `OTTABASE_KV`) still in use.

**Solution:** All bindings now use `OBCF_*` prefix:

- `env.OBCF_D1` (was `env.DB`)
- `env.OBCF_KV` (was `env.OTTABASE_KV`)
- `env.OBCF_R2` (was `env.OTTABASE_BUCKET`)
- `env.OBCF_QUEUE` (was `env.MY_QUEUE`)
- `env.OBCF_REALTIME` (was `env.REALTIME`)

---

## 📝 Summary

### Required Configuration Files

- ✅ `wrangler.jsonc` - Cloudflare bindings (OBCF\_\* names); `ALL_CAPS` placeholder values are auto-detected and
  substituted from GitHub Secrets via `substitute-wrangler-secrets.py`
- ✅ `types/cloudflare.d.ts` - TypeScript definitions (OBCF\_\* interfaces)
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

| Variable         | Required      | Purpose                                 |
| ---------------- | ------------- | --------------------------------------- |
| `D1_DATABASE_ID` | Yes (deploy)  | D1 database UUID (wrangler placeholder) |
| `AUTH_SECRET`    | If using auth | Auth.js secret                          |
| `CF_ACCOUNT_ID`  | Optional      | Cloudflare API access                   |
| `CF_API_TOKEN`   | Optional      | Cloudflare API access                   |

---

**Need help?** Check the troubleshooting section or review package READMEs for detailed API documentation.

**OBCF\_\* Naming Convention** ensures your Ottabase Cloudflare bindings are unique and conflict-free! 🚀
