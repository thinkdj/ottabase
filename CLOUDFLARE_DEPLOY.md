# Deploy Ottabase to Cloudflare Workers

Complete guide for deploying `ottabase-template-app-tanstack` to Cloudflare Workers with automated CI/CD.

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
# Or use project auth: pnpm cf:login
```

### Create Resources (Automated)

```bash
pnpm cf:login   # If not authenticated (required before cf:setup)
pnpm cf:setup   # Interactive: select D1, KV, R2, Queue (use --force for all)
pnpm cf:validate
```

**What cf:setup creates:**

- D1 Database: `ottabase-db`
- KV Namespace: `OBCF_KV` (+ preview)
- R2 Buckets: `ottabase-bucket` (+ preview)
- Queue: `ottabase-queue`
- **Does NOT modify wrangler.jsonc** (it's a template). Copy the output IDs for GitHub Secrets below.

**Resource overview (prod vs preview):**

| Resource | cf:setup creates (prod) | cf:setup creates (preview) | wrangler placeholder (prod) | wrangler placeholder (preview)      | GitHub Secrets                           |
| -------- | ----------------------- | -------------------------- | --------------------------- | ----------------------------------- | ---------------------------------------- |
| D1       | ottabase-db             | ottabase-db-preview        | `D1_DATABASE_ID`            | `D1_PREVIEW_DATABASE_ID`            | D1_DATABASE_ID, D1_PREVIEW_DATABASE_ID   |
| KV       | OBCF_KV                 | OBCF_KV_preview            | `KV_NAMESPACE_ID`           | `KV_PREVIEW_NAMESPACE_ID`           | KV_NAMESPACE_ID, KV_PREVIEW_NAMESPACE_ID |
| R2       | ottabase-bucket         | ottabase-bucket-preview    | `ottabase-bucket` (literal) | `ottabase-bucket-preview` (literal) | none                                     |
| Queue    | ottabase-queue          | ottabase-queue-preview     | `ottabase-queue` (literal)  | `ottabase-queue-preview` (literal)  | none                                     |

D1 and KV placeholder values = GitHub Secret names (auto-detected and substituted by CI). R2 and Queue use literal names
(no substitution needed).

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

Copy from **cf:setup output** (printed at the end), or run:

```bash
wrangler d1 list              # Get D1_DATABASE_ID
wrangler kv namespace list    # Get KV_NAMESPACE_ID
```

Note: `wrangler.jsonc` contains `ALL_CAPS_SNAKE_CASE` placeholder values that are auto-detected and substituted from
GitHub Secrets at deploy time. No explicit key list needed.

---

## Step 3: Configure GitHub Secrets

Go to: GitHub repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

**Production (main deploy):**

| Secret Name             | Description                | Where to Get                                    |
| ----------------------- | -------------------------- | ----------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | API token for deployments  | Step 2 above                                    |
| `CLOUDFLARE_ACCOUNT_ID` | Your account ID            | `wrangler whoami`                               |
| `D1_DATABASE_ID`        | Production D1 database ID  | cf:setup output or `wrangler d1 list`           |
| `KV_NAMESPACE_ID`       | Production KV namespace ID | cf:setup output or `wrangler kv namespace list` |

**PR preview (uses isolated preview D1/KV/R2):**

| Secret Name               | Description                      | Where to Get    |
| ------------------------- | -------------------------------- | --------------- |
| `D1_PREVIEW_DATABASE_ID`  | Preview D1 (ottabase-db-preview) | cf:setup output |
| `KV_PREVIEW_NAMESPACE_ID` | Preview KV (OBCF_KV_preview)     | cf:setup output |

> **Multi-app:** Same placeholder name across apps → same GitHub Secret → shared resource. Different names → isolated.
> Prefixing (e.g. `APP_1_D1_DATABASE_ID`) is a convention for clarity, not a requirement. Only 2 steps: set the
> placeholder in `wrangler.jsonc`, add the matching GitHub Secret. CI auto-detects the rest. See
> [.github/DEPLOYMENT.md](.github/DEPLOYMENT.md#extending-the-system) for a walkthrough.

---

## Step 4: Setup Database (Optional)

If using a database, ensure you have your migrations ready.

**Note:** CI/CD automatically applies migrations to production. See
[CLOUDFLARE_CONFIGURATION_GUIDE.md](CLOUDFLARE_CONFIGURATION_GUIDE.md) for details.

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
- ✓ Build application & worker bundle
- ✓ Apply database migrations
- ✓ Deploy to Cloudflare

---

## Step 6: Verify Deployment

### Find Your Worker URL

```bash
wrangler deployments list --name ottabase-template-app-tanstack
```

Or: https://dash.cloudflare.com → Workers & Pages → ottabase-template-app-tanstack

### Test Your App

```bash
# Visit in browser
https://ottabase-template-app-tanstack.your-subdomain.workers.dev

# Check logs
wrangler tail ottabase-template-app-tanstack
```

---

## Troubleshooting

### "Resource not found" errors

```bash
pnpm cf:setup
pnpm cf:validate
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
cd apps/ottabase-template-app-tanstack
pnpm build && pnpm wrangler deploy --env production

# View logs
wrangler tail ottabase-template-app-tanstack

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
2. Build Cloudflare Worker bundle
3. Apply database migrations
4. Deploy to Cloudflare Workers

### Important Files

- `.github/workflows/deploy.yml` - CI/CD workflow (auto-detects placeholders in wrangler.jsonc and substitutes from
  GitHub Secrets via substitute-wrangler-secrets.py)
- `apps/ottabase-template-app-tanstack/wrangler.jsonc` - Cloudflare config (template with `ALL_CAPS` placeholder values;
  CI generates wrangler.production.jsonc)

### Cloudflare Bindings

| Binding             | Type           |
| ------------------- | -------------- |
| `OBCF_D1`           | D1 Database    |
| `OBCF_KV`           | KV Namespace   |
| `OBCF_R2`           | R2 Bucket      |
| `OBCF_QUEUE`        | Queue          |
| `OBCF_REALTIME`     | Durable Object |
| `OBCF_RATE_LIMITER` | Rate Limiter   |

See [CLOUDFLARE_CONFIGURATION_GUIDE.md](CLOUDFLARE_CONFIGURATION_GUIDE.md) for usage details.

---

## Setup Checklist

- [ ] Install wrangler: `npm install -g wrangler`
- [ ] Login: `wrangler login` or `pnpm cf:login`
- [ ] Create resources: `pnpm cf:setup` (copy output IDs for GitHub Secrets)
- [ ] Validate: `pnpm cf:validate`
- [ ] Add production secrets (D1_DATABASE_ID, KV_NAMESPACE_ID)
- [ ] Add PR preview secrets (D1_PREVIEW_DATABASE_ID, KV_PREVIEW_NAMESPACE_ID)
- [ ] Push to main branch
- [ ] Verify deployment

**Done! Your app is deployed with full CI/CD.** 🚀

---

## Additional Resources

- **[CLOUDFLARE_CONFIGURATION_GUIDE.md](CLOUDFLARE_CONFIGURATION_GUIDE.md)** - Technical reference for bindings,
  environment variables, and code usage
- **[Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/commands/)** - Official documentation
- **[Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)** - Platform documentation
