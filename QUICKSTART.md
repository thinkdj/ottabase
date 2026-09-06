# Getting Started in 5 Minutes

Welcome to **Ottabase**: an edge-native SaaS framework for Cloudflare Workers. This guide gets you from zero to running
in under 5 minutes.

## What You're Getting

- **Edge-first runtime** on Cloudflare Workers (D1, KV, R2, Queues)
- **Multi-tenant SaaS** (organizations, RBAC, RLS built-in)
- **Fat models** (business logic lives in OttaORM models, not controllers)
- **47 integrated packages** (auth, blog, realtime, queues, UI, and more)
- **Type-safe** — TypeScript everywhere, no JavaScript escapes
- **Two-part dev setup** — Vite frontend (port 3003) + Wrangler backend (port 3004)

> **▲ Important:** You own this code. Ottabase is a monorepo you clone and customize, not an npm package. See
> [README.md](./README.md) for full ownership details.

---

## Prerequisites (Do This First)

| Tool                   | Version   | Install                                                             |
| ---------------------- | --------- | ------------------------------------------------------------------- |
| **Node.js**            | ≥ 24.0.0  | `nvm install 24 && nvm use 24`                                      |
| **pnpm**               | ≥ 10.27.0 | `corepack enable pnpm` (uses Node's bundled)                        |
| **Git**                | latest    | (included on most systems)                                          |
| **Cloudflare account** | free tier | Sign up at https://dash.cloudflare.com (not required for local dev) |

**Verify your setup:**

```bash
node --version    # Should be >= v24.0.0
pnpm --version    # Should be >= 10.27.0
```

---

## Step 1: Clone & Install (1 minute)

```bash
# Clone the repo
git clone https://github.com/thinkdj/ottabase.git
cd ottabase

# Install dependencies (one-time, ~2–3 minutes)
pnpm install

# Build shared packages (required before first dev run)
pnpm build:pkg
```

👉 If you want one command that installs dependencies, builds packages, runs tests, and then starts local development,
you can use:

```bash
pnpm dev:full
```

Use `pnpm dev:full` for a fresh-machine sanity run. Use `pnpm dev` for normal day-to-day development after the repo is
already installed and built.

`pnpm dev` waits for both Vite and the Wrangler worker health endpoint before it reports readiness or opens the browser,
which avoids the common first-load race where the frontend boots before the backend is reachable.

---

## Step 2: Configure Environment (30 seconds)

```bash
# Creates apps/otta-web/.env.local from .env.example and fills in every local secret
pnpm env:secrets
```

That generates `AUTH_SECRET`, `MIGRATION_SECRET`, `BOOTSTRAP_OWNER_SECRET`, `CRON_SECRET` and friends. It never
overwrites a value you already set, so it is safe to re-run, and it deliberately leaves third-party credentials (OAuth
client secrets, provider API keys) empty for you to fill in.

<details>
<summary>Prefer to do it by hand?</summary>

```bash
cp apps/otta-web/.env.example apps/otta-web/.env.local

# macOS/Linux:
openssl rand -base64 32

# Windows (PowerShell):
[Convert]::ToBase64String([byte[]][Security.Cryptography.RNGCryptoServiceProvider]::new().GetBytes(32))
```

Then fill in `AUTH_SECRET`, `MIGRATION_SECRET`, and `BOOTSTRAP_OWNER_SECRET`. For local dev the same value works for all
three.

</details>

In production, set these as Wrangler secrets before first bootstrap:

```bash
wrangler secret put AUTH_SECRET
wrangler secret put MIGRATION_SECRET
wrangler secret put BOOTSTRAP_OWNER_SECRET
```

👉 Or use the **Cloudflare dashboard** to add them as the Worker's secrets.

- `BOOTSTRAP_OWNER_SECRET` protects the bootstrap wizard and bootstrap API endpoints.
- `MIGRATION_SECRET` is required for migration endpoints such as Admin → Migrate (`/api/ottaorm/init`).

### Cloudflare API Token: when you need a real one

For local development with Wrangler in `--local` mode, a real Cloudflare token is usually not required. A dummy value is
enough in headless environments:

```bash
CLOUDFLARE_API_TOKEN=dummy-local-dev
```

You need a real `CLOUDFLARE_API_TOKEN` when you:

- deploy to Cloudflare
- run Cloudflare account/resource setup commands
- validate real Cloudflare resources from this repo

Get a real token from Cloudflare:

1. Open `https://dash.cloudflare.com/profile/api-tokens`
2. Click **Create Token**
3. Start with **Edit Cloudflare Workers**
4. Make sure it includes the resources you plan to manage, typically Workers Scripts, D1, KV, and Account settings
5. Copy the token immediately because Cloudflare only shows it once

You can then set it in your shell before running Cloudflare setup or deploy commands:

```bash
# macOS/Linux
export CLOUDFLARE_API_TOKEN=your_real_token_here

# Windows cmd
set CLOUDFLARE_API_TOKEN=your_real_token_here

# Windows PowerShell
$env:CLOUDFLARE_API_TOKEN='your_real_token_here'
```

(You can add them to `.env.local` which is gitignored)

If you also need your account ID, get it from `wrangler whoami` or the Cloudflare dashboard.

---

## Step 3: Start Dev Servers (1 minute)

Start **both** the frontend and backend in parallel:

```bash
# Option A: Everything at once (recommended)
pnpm dev

# Option A2: Full fresh-machine workflow
# Installs, builds, tests, then starts dev
pnpm dev:full

# Option B: Manually in two terminals if Option A doesn't work

# Terminal 1 — Vite frontend (port 3003)
cd apps/otta-web
npx vite --port 3003

# Terminal 2 — Wrangler backend (port 3004)
cd apps/otta-web
export CLOUDFLARE_API_TOKEN=dummy-local-dev  # Windows: set CLOUDFLARE_API_TOKEN=dummy-local-dev
npx wrangler dev --port 3004 --local
```

First time build might take a few minutes as it compiles all packages and starts both servers. Subsequent runs should be
much faster, thanks to Turborepo's caching and incremental builds.

Wait 10–15 seconds for both servers to start. You'll see:

- Frontend: `Local: http://localhost:3003`
- Backend: `Worker ready on http://localhost:3004`

Command summary:

- `pnpm dev` — normal local development
- `pnpm dev:full` — install + build + test + dev in one command

---

## Step 4: Bootstrap the Platform and create Platform Owner account (~2 minutes)

For a fresh install, you do not need to manually navigate special routes.

When the platform is not initialized, opening the app automatically redirects you to the bootstrap wizard:

```text
http://localhost:3003  ->  /__bootstrap__
```

In the wizard, complete these steps:

- Create tables and run migrations
- Seed RBAC roles/permissions
- Create platform owner account
- Finalize launch

After finalize, the platform is marked ready and normal app routes open.

If you prefer API/terminal bootstrap (or need automation), use this sequence:

```bash
# Get your BOOTSTRAP_OWNER_SECRET from .env.local
BOOTSTRAP_SECRET=$(grep BOOTSTRAP_OWNER_SECRET apps/otta-web/.env.local | cut -d= -f2)

# Run bootstrap sequence (4 API calls)
curl -s -X POST http://localhost:3004/__bootstrap__/api/init \
  -H "X-Bootstrap-Secret: $BOOTSTRAP_SECRET"

curl -s -X POST http://localhost:3004/__bootstrap__/api/seed \
  -H "X-Bootstrap-Secret: $BOOTSTRAP_SECRET"

curl -s -X POST http://localhost:3004/__bootstrap__/api/create-owner \
  -H "X-Bootstrap-Secret: $BOOTSTRAP_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"<your-secure-password>","name":"Admin"}'

curl -s -X POST http://localhost:3004/__bootstrap__/api/finalize \
  -H "X-Bootstrap-Secret: $BOOTSTRAP_SECRET"
```

**Windows (Command Prompt)**: Use `findstr` instead of `grep`:

```cmd
for /f "tokens=2 delims==" %i in ('findstr BOOTSTRAP_OWNER_SECRET apps\otta-web\.env.local') do set BOOTSTRAP_SECRET=%i
```

Or copy the secret manually from `.env.local` and use it directly in the curl commands.

Production note:

- The bootstrap wizard/API requires a valid `BOOTSTRAP_OWNER_SECRET`.
- Admin → Migrate requires a valid `MIGRATION_SECRET`.

After bootstrap is complete and you can log in, you can also run migrations from inside the app:

- Login
- Open Admin
- Click Migrate

That is useful for later schema changes or when you want to re-run migrations from the UI instead of calling the API
manually. It does not replace the initial bootstrap sequence for a brand new setup.

---

## Step 5: Load the App (30 seconds)

Open your browser:

```
http://localhost:3003
```

Login with the _owner_ account you created during bootstrap. _This account has full admin privileges_. You can create
additional users and organizations from the Admin panel.

You're now inside a fully functional multi-tenant SaaS app with:

- User authentication (custom, signed sessions)
- Organizations (multi-tenancy)
- Role-based access control (RBAC)
- Audit logging
- Database connected (Cloudflare D1)

From here, you can also use the admin UI to manage migrations through Admin → Migrate for any future schema changes.

---

## Key Nuances & Tips

### 1. **Architecture: Fat Models, Not Controllers**

Business logic lives in OttaORM models (`BaseModel` subclasses), not in routes or controllers.

```typescript
// ✅ GOOD: Logic in the model
export class Todo extends BaseModel {
    static entity = 'todos';
    async markDone() {
        this.set('completed', true);
        return this.save();
    }
}

// ❌ AVOID: Logic in a route
app.patch('/todos/:id/done', async (req, res) => {
    // Don't put business logic here
});
```

### 2. **Edge-First Runtime**

Avoid Node.js APIs like `fs`, `child_process`, `os`. Use Cloudflare bindings instead:

- `env.OBCF_D1` for database
- `env.OBCF_KV` for caching
- `env.OBCF_R2` for file storage
- `env.OBCF_QUEUE` for jobs

### 3. **`wrangler.jsonc` Two-Tier Placeholder System**

When you open `wrangler.jsonc` you'll see two kinds of placeholder values — they mean different things:

| Pattern                                                         | Example                            | What it means                                                                                        |
| --------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `YOUR_*` (top-level)                                            | `YOUR_D1_DATABASE_ID`              | Local dev only — Wrangler ignores it and uses local simulators. **Never substituted by CI.**         |
| `ALL_CAPS_SNAKE_CASE` (inside `env.production` / `env.preview`) | `D1_DATABASE_ID`,`KV_NAMESPACE_ID` | **This is the GitHub Secret name.** CI auto-detects it and substitutes the real UUID at deploy time. |

For local dev, leave the `YOUR_*` values as-is. For deployment, the `ALL_CAPS` values must have matching GitHub Secrets
set.

### 4. **Monorepo Structure**

- **`apps/`** — Full-stack applications
    - `otta-web/` — Main TanStack Router + Vite + Wrangler app
    - `otta-landing/` — Marketing site (Next.js)
- **`packages/`** — 47 shared packages
    - `@ottabase/ottaorm` — Fat model ORM (core)
    - `@ottabase/auth` — Lightweight custom auth
    - `@ottabase/rbac` — Role-based access control
    - `@ottabase/ui-shadcn` — UI component library
    - (and 43 more...)

### 5. **Workspace Protocol**

Internal dependencies use `workspace:*`, external use `catalog:`:

```json
{
    "@ottabase/ottaorm": "workspace:*",
    "react": "catalog:"
}
```

### 6. **Bootstrap Is One-Time**

The `__bootstrap__/api/*` routes are only active on first setup. Once the platform is `READY`, they're blocked. To
reset:

```bash
# Local state only — D1 + KV + R2 (keeps build output)
pnpm clean:state

# Everything: local state + build caches + packages/*/dist
pnpm clean:all

# Then re-run bootstrap (Step 4)
```

Use `pnpm clean:state` when you want to wipe local Cloudflare-emulated persistence without doing a broader repo reset.
Both commands are local only — your Cloudflare account is never touched — and both prompt for a typed `YES` (add
`-- --yes` to skip).

Use bootstrap for the first-time platform bring-up. Use Admin → Migrate later when the app is already running and you
need to apply schema updates from the UI.

### 7. **Two Ports, Same App**

- **Port 3003** (Vite) — Frontend (SPA)
- **Port 3004** (Wrangler) — Backend API + static files

On production, Cloudflare Workers serves both. Locally, both must be running.

### 8. **Multi-Tenancy Is Built-In**

Every request automatically includes tenant context (`organizationId`, `userId`, `appId`). Row-Level Security (RLS)
enforces data isolation. Never bypass RLS—always provide adequate context.

### 9. **TypeScript Everything**

No JavaScript in source. All packages must have `tsconfig.json` and export `.d.ts` type definitions.

---

## Next Steps

- **Read [AGENTS.MD](./AGENTS.MD)** — Deep architecture reference and AI guidelines
- **Read [ARCHITECTURE.md](./ARCHITECTURE.md)** — Monorepo topology, package layers, OttaORM model system
- **Read [CONTRIBUTING.md](./.github/CONTRIBUTING.md)** — Code standards, PR process, dependency management
- **Try the [Solo Founder's SaaS Guide](./docs/SOLO_FOUNDER_SAAS_GUIDE.md)** — Multi-tenancy, RBAC, audit logging
  patterns
- **Explore [API_PAGINATION.md](./docs/API_PAGINATION.md)** — Server-side pagination on CRUD endpoints
- **Check [TESTING.md](./docs/TESTING.md)** — Testing patterns (Vitest, integration tests)

---

## Troubleshooting

| Issue                               | Solution                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Port 3003/3004 already in use**   | `pnpm dev:kill` (all apps) or `pnpm dev:kill --app=<name>`; works on macOS/Linux/Windows          |
| **`pnpm` not found**                | Run `corepack enable pnpm` and restart terminal                                                   |
| **Build fails with native modules** | Delete `node_modules/` and `.pnpm-store/`, then `pnpm install` again                              |
| **Bootstrap API returns 401**       | Check `BOOTSTRAP_OWNER_SECRET` in `.env.local` matches the curl header value                      |
| **Database not initialized**        | Re-run `curl -X POST http://localhost:3004/__bootstrap__/api/init` with correct secret            |
| **"Platform is not READY"** error   | Bootstrap hasn't completed. Check browser console for bootstrap status at `/__bootstrap__/status` |
| **Changes not reflecting**          | Clear browser cache and restart both dev servers                                                  |

---

## Quality Checks Before Shipping

```bash
# Lint all packages
pnpm lint

# Type-check all packages
pnpm type-check

# Test a specific package
pnpm test --filter=@ottabase/<package>

# Format code
pnpm format
```

---

## Common Commands

Forgot what's available? `pnpm commands` prints every script in a grouped table, generated from `package.json` so it
never drifts. `pnpm commands <text>` filters it (`pnpm commands clean`), and `pnpm commands --all` includes the internal
lifecycle scripts.

```bash
# Discovery
pnpm commands                # Every script, grouped and annotated
pnpm commands cf             # Filter by name, description or group

# Development
pnpm dev                     # Start Vite + Wrangler
pnpm dev:full                # Install + build + test + start dev
pnpm dev:be                 # Wrangler only (3004)
pnpm dev:kill               # Free every dev port declared by apps/*
pnpm dev:kill --app=otta-web   # One app only (pnpm dev:kill:web is the shortcut)
pnpm dev:kill --ports=3103,3104 # Explicit ports

# Building
pnpm build:pkg              # Build shared packages (required first)
pnpm build                  # Build apps + packages

# Quality
pnpm lint                   # ESLint all packages
pnpm type-check             # TypeScript check all packages
pnpm test --filter=pkg      # Vitest filter

# Database (all local only — never touches your Cloudflare account)
curl -X POST http://localhost:3004/api/ottaorm/init  # Create/update tables
pnpm clean:d1               # Clear local D1
pnpm clean:kv               # Clear local KV
pnpm clean:state            # Clear all local state (D1 + KV + R2)

# Full reset
pnpm clean:all              # Local state + build caches + packages/*/dist
```

---

## Need Help?

- **Issues**: [GitHub Issues](https://github.com/thinkdj/ottabase/issues)
- **Discussions**: [GitHub Discussions](https://github.com/thinkdj/ottabase/discussions)
- **Security**: [SECURITY.md](./.github/SECURITY.md)
- **Maintainers**: [MAINTAINERS.md](./.github/MAINTAINERS.md)

---

**Happy building! 🚀**
