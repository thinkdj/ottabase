# How to Deploy Ottabase Template App to Cloudflare Workers

**Complete guide for deploying `ottabase-template-app` to Cloudflare Workers with automated CI/CD.**

## Prerequisites

- Cloudflare account (free tier works)
- GitHub repository with Actions enabled
- Node.js 24+ and pnpm 10+ installed locally

---

## Step 1: Setup Cloudflare Resources Locally

### 1.1 Install Wrangler CLI

```bash
npm install -g wrangler
```

### 1.2 Login to Cloudflare

```bash
wrangler login
```

This opens a browser window. Authorize Wrangler to access your Cloudflare account.

### 1.3 Create Cloudflare Resources

Run the automated setup script from the repository root:

```bash
pnpm cloudflare:setup
```

**What this does:**
- Creates D1 database: `ottabase-db`
- Creates KV namespaces: `OBCF_KV` (production + preview)
- Creates R2 buckets: `ottabase-bucket` (production + preview)
- Creates Queue: `ottabase-queue`
- Updates `apps/ottabase-template-app/wrangler.jsonc` with resource IDs

### 1.4 Verify Setup

```bash
pnpm cloudflare:validate
```

✓ All resources should show as configured.

---

## Step 2: Get Cloudflare Credentials

### 2.1 Get Your Account ID

**Option A - From Dashboard:**
1. Go to https://dash.cloudflare.com
2. Select "Workers & Pages" from left sidebar
3. Your Account ID is displayed in the right sidebar

**Option B - From Terminal:**
```bash
wrangler whoami
```

Copy the `Account ID` value.

### 2.2 Create API Token

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click **"Create Token"**
3. Use the **"Edit Cloudflare Workers"** template
4. **Permissions** should include:
   - Account > Workers Scripts > Edit
   - Account > Workers KV Storage > Edit
   - Account > D1 > Edit
   - Account > Account Settings > Read
5. Click **"Continue to summary"** → **"Create Token"**
6. **Copy the token immediately** (you won't see it again)

### 2.3 Get Resource IDs

Open `apps/ottabase-template-app/wrangler.jsonc` and note the IDs:

```bash
# Get D1 Database ID
grep -A 3 '"production"' apps/ottabase-template-app/wrangler.jsonc | grep database_id

# Get KV Namespace ID
grep -A 3 '"production"' apps/ottabase-template-app/wrangler.jsonc | grep '"id"'
```

Or list them directly:

```bash
# D1 Database
wrangler d1 list

# KV Namespace
wrangler kv:namespace list

# R2 Buckets
wrangler r2 bucket list

# Queues
wrangler queues list
```

---

## Step 3: Configure GitHub Secrets

### 3.1 Add Repository Secrets

Go to your GitHub repository:

1. Click **Settings** (top menu)
2. Click **Secrets and variables** → **Actions** (left sidebar)
3. Click **New repository secret**

Add these **4 required secrets**:

| Secret Name | Description | Example | Where to Get |
|------------|-------------|---------|--------------|
| `CLOUDFLARE_API_TOKEN` | API token for deployments | `abc123...xyz` | Step 2.2 above |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID | `a1b2c3d4e5f6...` | Step 2.1 above |
| `D1_DATABASE_ID` | Production D1 database ID | `12345678-abcd-...` | From `wrangler.jsonc` or `wrangler d1 list` |
| `KV_NAMESPACE_ID` | Production KV namespace ID | `abcdef123456...` | From `wrangler.jsonc` or `wrangler kv:namespace list` |

**Optional secret** (defaults to `ottabase-db` if not set):

| Secret Name | Description | Default |
|------------|-------------|---------|
| `D1_DATABASE_NAME` | D1 database name | `ottabase-db` |

### 3.2 Verify Secrets

After adding all secrets, you should see:
- ✓ CLOUDFLARE_API_TOKEN
- ✓ CLOUDFLARE_ACCOUNT_ID
- ✓ D1_DATABASE_ID
- ✓ KV_NAMESPACE_ID

---

## Step 4: Setup Database (If Using Prisma)

### 4.1 Generate Prisma Schema

```bash
cd apps/ottabase-template-app
pnpm db:generate
```

This creates `prisma/schema.prisma` from your configuration.

### 4.2 Create Database Migration

```bash
pnpm db:migrate
```

This creates migration files in `prisma/migrations/`.

### 4.3 Apply Migration Locally (Optional - for testing)

```bash
wrangler d1 migrations apply ottabase-db --local
```

**Note:** The CI/CD pipeline will automatically apply migrations to production.

---

## Step 5: Deploy via CI/CD

### 5.1 Trigger Deployment

**Option A - Push to main branch:**
```bash
git add .
git commit -m "feat: setup cloudflare deployment"
git push origin main
```

**Option B - Manual trigger:**
1. Go to GitHub repository → **Actions** tab
2. Select **"Deploy to Cloudflare Workers"** workflow
3. Click **"Run workflow"** → **"Run workflow"** button

### 5.2 Monitor Deployment

1. Go to **Actions** tab in GitHub
2. Click on the running workflow
3. Watch the deployment steps:
   - ✓ Checkout code
   - ✓ Install dependencies
   - ✓ Build packages
   - ✓ Generate Prisma schema
   - ✓ Build application
   - ✓ Build Cloudflare Worker
   - ✓ Apply database migrations
   - ✓ Deploy to Cloudflare

### 5.3 Check Deployment Status

Once complete (green checkmark), your app is deployed!

---

## Step 6: Verify Deployment

### 6.1 Find Your Worker URL

```bash
wrangler deployments list --name ottabase-template-app
```

Or check the Cloudflare dashboard:
1. Go to https://dash.cloudflare.com
2. Click **Workers & Pages**
3. Find **ottabase-template-app**
4. Your URL is displayed (e.g., `ottabase-template-app.your-subdomain.workers.dev`)

### 6.2 Test Your App

Visit your Worker URL in a browser:

```
https://ottabase-template-app.your-subdomain.workers.dev
```

### 6.3 Test API Endpoints (If Any)

```bash
# Example: Test database connection
curl https://ottabase-template-app.your-subdomain.workers.dev/api/health

# Example: Test users endpoint
curl https://ottabase-template-app.your-subdomain.workers.dev/api/users
```

### 6.4 Check Logs

```bash
# Live tail logs
wrangler tail ottabase-template-app

# Or view in dashboard
# https://dash.cloudflare.com → Workers & Pages → ottabase-template-app → Logs
```

---

## CI/CD Workflow Explained

The deployment workflow (`.github/workflows/deploy.yml`) automatically:

1. **Builds** your application and packages
2. **Generates** Prisma schema and types
3. **Bundles** for Cloudflare Workers (via OpenNext)
4. **Applies** database migrations to production D1
5. **Deploys** to Cloudflare Workers with production environment

**Triggers:**
- Every push to `main` branch
- Manual trigger via GitHub Actions UI

---

## Troubleshooting

### ❌ "Resource not found" errors

**Solution:** Re-run cloudflare setup and update GitHub secrets:
```bash
pnpm cloudflare:setup
pnpm cloudflare:validate
```

Then update `D1_DATABASE_ID` and `KV_NAMESPACE_ID` secrets in GitHub.

### ❌ "Unauthorized" or "Invalid API token"

**Solution:** Regenerate your API token (Step 2.2) with correct permissions and update `CLOUDFLARE_API_TOKEN` secret.

### ❌ "Migration failed" errors

**Solution:** Check if migration was already applied:
```bash
wrangler d1 execute ottabase-db --remote --command="SELECT name FROM sqlite_master WHERE type='table'"
```

The CI pipeline gracefully handles already-applied migrations.

### ❌ Build fails with "Cannot find module"

**Solution:** Clear caches and reinstall:
```bash
pnpm clean
rm -rf node_modules
pnpm install
```

### ❌ Deployment succeeds but app doesn't work

**Check these:**
1. View logs: `wrangler tail ottabase-template-app`
2. Verify environment variables in Cloudflare dashboard
3. Check D1 database has tables: `wrangler d1 execute ottabase-db --remote --command=".tables"`
4. Ensure migrations were applied (check CI logs)

---

## Quick Reference

### Essential Commands

```bash
# Local development
pnpm dev

# Build locally
pnpm build

# Deploy manually (bypass CI)
cd apps/ottabase-template-app
pnpm build && pnpm build:worker && pnpm wrangler deploy --env production

# View production logs
wrangler tail ottabase-template-app

# Execute D1 commands
wrangler d1 execute ottabase-db --remote --command="SELECT * FROM User LIMIT 5"

# List resources
wrangler d1 list
wrangler kv:namespace list
wrangler r2 bucket list
wrangler queues list
```

### Important Files

- `.github/workflows/deploy.yml` - CI/CD workflow
- `apps/ottabase-template-app/wrangler.jsonc` - Cloudflare configuration
- `apps/ottabase-template-app/db.config.ts` - Database configuration
- `apps/ottabase-template-app/prisma/schema.prisma` - Generated database schema

### Cloudflare Bindings

Your app has access to these bindings:

| Binding | Type | Access in Code |
|---------|------|----------------|
| `OBCF_D1` | D1 Database | `env.OBCF_D1` |
| `OBCF_KV` | KV Namespace | `env.OBCF_KV` |
| `OBCF_R2` | R2 Bucket | `env.OBCF_R2` |
| `OBCF_QUEUE` | Queue | `env.OBCF_QUEUE` |
| `OBCF_REALTIME` | Durable Object | `env.OBCF_REALTIME` |
| `OBCF_RATE_LIMITER` | Rate Limiter | `env.OBCF_RATE_LIMITER` |

---

## Summary: Complete Setup Checklist

- [ ] Install wrangler: `npm install -g wrangler`
- [ ] Login: `wrangler login`
- [ ] Create resources: `pnpm cloudflare:setup`
- [ ] Validate: `pnpm cloudflare:validate`
- [ ] Get Account ID from dashboard or `wrangler whoami`
- [ ] Create API token at https://dash.cloudflare.com/profile/api-tokens
- [ ] Get D1 Database ID from `wrangler.jsonc` or `wrangler d1 list`
- [ ] Get KV Namespace ID from `wrangler.jsonc` or `wrangler kv:namespace list`
- [ ] Add 4 GitHub secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `D1_DATABASE_ID`, `KV_NAMESPACE_ID`
- [ ] Generate Prisma schema: `cd apps/ottabase-template-app && pnpm db:generate`
- [ ] Create migrations: `pnpm db:migrate` (if using database)
- [ ] Push to main or trigger workflow manually
- [ ] Monitor deployment in GitHub Actions
- [ ] Verify at your Worker URL

**That's it! Your app is now deployed with full CI/CD.** 🚀

---

## Additional Resources

- [Cloudflare Configuration Guide](./CLOUDFLARE_CONFIGURATION_GUIDE.md)
- [D1 Production Deployment](./packages/db/src/prisma/D1_PRODUCTION_DEPLOYMENT.md)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/commands/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
