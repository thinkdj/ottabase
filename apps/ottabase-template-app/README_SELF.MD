# Production Deployment Guide

## Prerequisites

Before deploying to production, you need:

1. **Cloudflare Account** with Workers enabled
2. **GitHub Repository** with Actions enabled
3. **Wrangler CLI** installed locally (`pnpm add -g wrangler`)

## Step 1: Create Cloudflare Resources

### 🤖 Intelligent Auto-Setup (Recommended)

The easiest way - let the script do everything automatically:

```bash
# 1. Authenticate with Cloudflare
npx wrangler login

# 2. Run intelligent auto-setup (creates resources, writes IDs to .env.local)
# From this app's directory:
pnpm cloudflare:setup

# Or from root targeting this app:
pnpm --filter @ottabase/ottabase-template-app cloudflare:setup

# Or from anywhere with explicit app directory:
pnpm exec cloudflare-setup apps/ottabase-template-app
```

That's it! The script will:

- ✅ Read `wrangler.jsonc` to discover required resources
- ✅ Check if each resource exists in Cloudflare
- ✅ Create missing resources automatically
- ✅ Write resource IDs to `.env.local` (never modifies wrangler.jsonc!)
- ✅ wrangler.jsonc uses `${CF_*}` substitution automatically

**Clean Approach:** Configuration stays in git, secrets stay in `.env.local` (gitignored). Zero file conflicts!

**Multi-App Support:** The script automatically detects which app you're working with, so you can use the same commands for any app in the monorepo!

**Save the IDs shown in output** - you'll need them for GitHub Secrets in Step 2.

### 📝 Manual Setup (Alternative)

If you prefer manual control, run these commands:

```bash
# Authenticate with Cloudflare
pnpm wrangler login

# Create D1 database
pnpm wrangler d1 create ottabase-db

# Create KV namespace (production)
pnpm wrangler kv namespace create OBCF_KV

# Create KV namespace (preview) - Optional
pnpm wrangler kv namespace create OBCF_KV --preview

# Create R2 bucket
pnpm wrangler r2 bucket create ottabase-bucket

# Create Queue
pnpm wrangler queues create ottabase-queue
```

**Save the IDs returned** - you'll need them for Step 2.

## Step 2: Configure GitHub Secrets

Add these secrets to your GitHub repository (`Settings` > `Secrets and variables` > `Actions`).

**📌 Note:** The `wrangler.jsonc` file uses `MY_*` placeholders (like `MY_D1_DATABASE_ID`) to indicate values you need to provide. These are automatically replaced during CI/CD deployment with your GitHub Secrets.

### Required Secrets

| Secret Name                            | Env Var in wrangler.jsonc         | Description                                   | How to Get                                                                                             |
| -------------------------------------- | --------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `CLOUDFLARE_API_TOKEN`                 | -                                 | Cloudflare API token with Workers permissions | [Create token](https://dash.cloudflare.com/profile/api-tokens) with "Edit Cloudflare Workers" template |
| `CLOUDFLARE_ACCOUNT_ID`                | -                                 | Your Cloudflare account ID                    | Found in Workers & Pages overview or any Worker URL                                                    |
| `CLOUDFLARE_D1_DATABASE_ID`            | `${CF_D1_DATABASE_ID}`            | D1 database ID                                | Auto-populated in `.env.local` by setup script                                                         |
| `CLOUDFLARE_KV_NAMESPACE_ID`           | `${CF_KV_NAMESPACE_ID}`           | KV namespace ID                               | Auto-populated in `.env.local` by setup script                                                         |
| `CLOUDFLARE_RATE_LIMITER_NAMESPACE_ID` | `${CF_RATE_LIMITER_NAMESPACE_ID}` | Rate limiter namespace ID                     | From Cloudflare Dashboard > Rate Limiting                                                              |

### Optional Secrets

| Secret Name                | Env Var in wrangler.jsonc | Description             | When to Use                                      |
| -------------------------- | ------------------------- | ----------------------- | ------------------------------------------------ |
| `CLOUDFLARE_KV_PREVIEW_ID` | `${CF_KV_PREVIEW_ID}`     | KV preview namespace ID | If you want preview deployments with separate KV |

## Step 3: Deploy

Push to `main` branch or manually trigger the workflow:

```bash
git push origin main
```

Or trigger manually:

- Go to `Actions` tab in GitHub
- Select "Deploy to Cloudflare Workers"
- Click "Run workflow"

## Local Development

For local development, no secrets needed - Wrangler simulates all resources:

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Access at http://localhost:3000
```

## Understanding Environment Variable Substitution

The `wrangler.jsonc` file uses **environment variable substitution** with `${CF_*}` syntax. This is the cleanest approach:

**How it works:**

- **Local Dev:** IDs stored in `.env.local` (gitignored) → wrangler reads automatically
- **CI/CD Production:** IDs from GitHub Secrets → passed as environment variables
- **No file modification:** `wrangler.jsonc` stays clean, tracked in git without secrets

**Environment Variables:**

- `CF_D1_DATABASE_ID` - D1 database UUID
- `CF_KV_NAMESPACE_ID` - KV namespace ID
- `CF_KV_PREVIEW_ID` - KV preview namespace ID (optional)
- `CF_RATE_LIMITER_NAMESPACE_ID` - Rate limiter namespace ID

**Why CF\_\* prefix?**

- **Consistent:** All Cloudflare resource IDs use same prefix
- **Discoverable:** Easy to find all CF-related env vars
- **SSOT:** Single Source of Truth - values only in `.env.local` or CI secrets

**Available Commands:**

```bash
# Intelligent Auto-Setup: Creates resources, writes IDs to .env.local

# From app directory (auto-detects context):
cd apps/ottabase-template-app
pnpm cloudflare:setup

# From root targeting specific app:
pnpm --filter @ottabase/ottabase-template-app cloudflare:setup

# From anywhere with explicit app directory:
pnpm exec cloudflare-setup apps/ottabase-template-app

# Works for any app in monorepo:
pnpm --filter my-other-app cloudflare:setup
```

**What it does:**

- ✅ Checks authentication (`wrangler whoami`)
- ✅ Creates missing resources (D1, KV, R2, Queues)
- ✅ Writes resource IDs to `.env.local`
- ✅ Never modifies `wrangler.jsonc`

## Troubleshooting

### Deployment fails with "missing secrets"

- Verify all required GitHub Secrets are set correctly
- Check secret names match exactly (case-sensitive)

### Wrangler authentication errors

- Run `pnpm wrangler login` locally
- Verify API token has correct permissions

### Resource ID mismatches

- Double-check IDs copied from Wrangler CLI output
- Ensure no extra spaces or characters in GitHub Secrets

## Resource Bindings

All Cloudflare resources are bound with `OBCF_*` prefix in code:

- `OBCF_D1` - D1 Database
- `OBCF_KV` - KV Namespace
- `OBCF_R2` - R2 Bucket
- `OBCF_QUEUE` - Queue
- `OBCF_RATE_LIMITER` - Rate Limiting
- `OBCF_REALTIME` - Durable Objects (for WebSocket/Realtime features)
