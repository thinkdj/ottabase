# Cloudflare Workers Deployment - Quick Reference

> **📖 COMPLETE DEPLOYMENT GUIDE: [HOWTO_DEPLOY.MD](HOWTO_DEPLOY.MD)**  
> This document is a quick reference. For step-by-step instructions, use HOWTO_DEPLOY.MD.

## Quick Start

```bash
# 1. Setup Cloudflare resources
pnpm cloudflare:setup

# 2. Verify configuration
pnpm cloudflare:validate

# 3. Add GitHub secrets (see HOWTO_DEPLOY.MD)
# 4. Push to main branch → automatic deployment
```

## Required GitHub Secrets

Add these 4 secrets to your GitHub repository (Settings → Secrets → Actions):

| Secret Name | Get From |
|------------|----------|
| `CLOUDFLARE_API_TOKEN` | https://dash.cloudflare.com/profile/api-tokens |
| `CLOUDFLARE_ACCOUNT_ID` | `wrangler whoami` |
| `D1_DATABASE_ID` | `wrangler d1 list` |
| `KV_NAMESPACE_ID` | `wrangler kv:namespace list` |

## CI/CD Pipeline

Defined in `.github/workflows/deploy.yml` - triggers on push to `main`:

1. Build packages & app
2. Generate Prisma schema
3. Build Cloudflare Worker bundle
4. Apply database migrations
5. Deploy to Cloudflare Workers

## Resources Created

The `pnpm cloudflare:setup` command creates:
- D1 Database: `ottabase-db`
- KV Namespace: `OBCF_KV` (+ preview)
- R2 Buckets: `ottabase-bucket` (+ preview)
- Queue: `ottabase-queue`

## Documentation

- **[HOWTO_DEPLOY.MD](HOWTO_DEPLOY.MD)** - Complete deployment guide with CI/CD setup
- **[CLOUDFLARE_CONFIGURATION_GUIDE.md](CLOUDFLARE_CONFIGURATION_GUIDE.md)** - Technical reference for bindings, environment variables, and code usage
