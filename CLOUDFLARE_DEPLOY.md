# Deploy Ottabase to Cloudflare Workers

Complete guide for deploying `ottabase-template-app` to Cloudflare Workers with automated CI/CD.

## Prerequisites

- Cloudflare account (free tier works)
- GitHub repository with Actions enabled
- Node.js 24+ and pnpm 10+ installed locally

---

## Step 1: Setup Cloudflare Resources

### Install Wrangler & Login

```bash
npm install -g wrangler
wrangler login
```

### Create Resources (Automated)

```bash
pnpm cloudflare:setup
pnpm cloudflare:validate
```

**What this creates:**
- D1 Database: `ottabase-db`
- KV Namespace: `OBCF_KV` (+ preview)
- R2 Buckets: `ottabase-bucket` (+ preview)
- Queue: `ottabase-queue`
- Updates `wrangler.jsonc` with resource IDs

---

## Step 2: Get Cloudflare Credentials

### Get Account ID

```bash
wrangler whoami
```

Or find it at: https://dash.cloudflare.com → Workers & Pages (right sidebar)

### Create API Token

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click **"Create Token"** → Use **"Edit Cloudflare Workers"** template
3. Ensure permissions include: Workers Scripts, KV Storage, D1, Account Settings
4. **Copy the token immediately** (shown only once)

### Get Resource IDs

```bash
wrangler d1 list              # Get D1_DATABASE_ID
wrangler kv:namespace list    # Get KV_NAMESPACE_ID
```

Or extract from `apps/ottabase-template-app/wrangler.jsonc`

---

## Step 3: Configure GitHub Secrets

Go to: GitHub repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these **4 required secrets:**

| Secret Name | Description | Where to Get |
|------------|-------------|--------------|
| `CLOUDFLARE_API_TOKEN` | API token for deployments | Step 2 above |
| `CLOUDFLARE_ACCOUNT_ID` | Your account ID | `wrangler whoami` |
| `D1_DATABASE_ID` | Production D1 database ID | `wrangler d1 list` |
| `KV_NAMESPACE_ID` | Production KV namespace ID | `wrangler kv:namespace list` |

**Optional:**
- `D1_DATABASE_NAME` (defaults to `ottabase-db`)

---

## Step 4: Setup Database (Optional)

If using a database:

```bash
cd apps/ottabase-template-app
pnpm db:generate    # Generate Prisma schema
pnpm db:migrate     # Create migrations
```

**Note:** CI/CD automatically applies migrations to production. See [CLOUDFLARE_CONFIGURATION_GUIDE.md](CLOUDFLARE_CONFIGURATION_GUIDE.md) for details.

---

## Step 5: Deploy

### Trigger Deployment

**Option A - Push to main:**
```bash
git push origin main
```

**Option B - Manual trigger:**
1. Go to GitHub → **Actions** tab
2. Select **"Deploy to Cloudflare Workers"**
3. Click **"Run workflow"**

### Monitor Deployment

Watch in GitHub Actions:
- ✓ Build packages
- ✓ Generate Prisma schema
- ✓ Build application & worker bundle
- ✓ Apply database migrations
- ✓ Deploy to Cloudflare

---

## Step 6: Verify Deployment

### Find Your Worker URL

```bash
wrangler deployments list --name ottabase-template-app
```

Or: https://dash.cloudflare.com → Workers & Pages → ottabase-template-app

### Test Your App

```bash
# Visit in browser
https://ottabase-template-app.your-subdomain.workers.dev

# Check logs
wrangler tail ottabase-template-app
```

---

## Troubleshooting

### "Resource not found" errors
```bash
pnpm cloudflare:setup
pnpm cloudflare:validate
```
Then update GitHub secrets with new IDs.

### "Unauthorized" or "Invalid API token"
Regenerate API token with correct permissions (Step 2).

### "Migration failed" errors
```bash
wrangler d1 execute ottabase-db --remote --command="SELECT name FROM sqlite_master WHERE type='table'"
```
CI pipeline gracefully handles already-applied migrations.

### Build fails
```bash
pnpm clean
rm -rf node_modules
pnpm install
```

---

## Quick Reference

### Essential Commands

```bash
# Local development
pnpm dev

# Manual deployment (bypass CI)
cd apps/ottabase-template-app
pnpm build && pnpm build:worker && pnpm wrangler deploy --env production

# View logs
wrangler tail ottabase-template-app

# Execute D1 commands
wrangler d1 execute ottabase-db --remote --command="SELECT * FROM User LIMIT 5"

# List resources
wrangler d1 list
wrangler kv:namespace list
wrangler r2 bucket list
wrangler queues list
```

### CI/CD Workflow

Defined in `.github/workflows/deploy.yml` - triggers on push to `main`:

1. Build packages & app
2. Generate Prisma schema
3. Build Cloudflare Worker bundle
4. Apply database migrations
5. Deploy to Cloudflare Workers

### Important Files

- `.github/workflows/deploy.yml` - CI/CD workflow
- `apps/ottabase-template-app/wrangler.jsonc` - Cloudflare config
- `apps/ottabase-template-app/db.config.ts` - Database config

### Cloudflare Bindings

| Binding | Type |
|---------|------|
| `OBCF_D1` | D1 Database |
| `OBCF_KV` | KV Namespace |
| `OBCF_R2` | R2 Bucket |
| `OBCF_QUEUE` | Queue |
| `OBCF_REALTIME` | Durable Object |
| `OBCF_RATE_LIMITER` | Rate Limiter |

See [CLOUDFLARE_CONFIGURATION_GUIDE.md](CLOUDFLARE_CONFIGURATION_GUIDE.md) for usage details.

---

## Setup Checklist

- [ ] Install wrangler: `npm install -g wrangler`
- [ ] Login: `wrangler login`
- [ ] Create resources: `pnpm cloudflare:setup`
- [ ] Validate: `pnpm cloudflare:validate`
- [ ] Get credentials (Account ID, API Token, Resource IDs)
- [ ] Add 4 GitHub secrets
- [ ] Generate Prisma schema (if using database)
- [ ] Push to main branch
- [ ] Verify deployment

**Done! Your app is deployed with full CI/CD.** 🚀

---

## Additional Resources

- **[CLOUDFLARE_CONFIGURATION_GUIDE.md](CLOUDFLARE_CONFIGURATION_GUIDE.md)** - Technical reference for bindings, environment variables, and code usage
- **[Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/commands/)** - Official documentation
- **[Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)** - Platform documentation
