# Production Deployment Guide for D1 + Prisma

Complete guide for deploying your Ottabase app with Cloudflare D1 and Prisma to production.

## Overview

Your setup correctly handles both development and production environments. This guide covers the production-specific
steps.

## Prerequisites

- ✅ Cloudflare account with Workers plan
- ✅ Wrangler CLI installed (`npm install -g wrangler`)
- ✅ Authenticated with Cloudflare (`wrangler login`)

## Table of Contents

- [Environment Setup](#environment-setup)
- [Database Setup](#database-setup)
- [Migration Workflow](#migration-workflow)
- [Deployment Process](#deployment-process)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)

## Environment Setup

### Local vs Production Configuration

Your app uses [wrangler.jsonc](../apps/ottabase-template-app/wrangler.jsonc) with environment-specific overrides:

```jsonc
{
  // Default (local dev)
  "d1_databases": [{
    "binding: "OBCF_D1",
    "database_name": "ottabase-db",
    "database_id": "YOUR_D1_DATABASE_ID"  // Not used locally
  }],

  // Production override
  "env": {
    "production": {
      "d1_databases": [{
        "binding: "OBCF_D1",
        "database_name": "ottabase-db",
        "database_id": "PRODUCTION_D1_DATABASE_ID"  // Must set this!
      }]
    }
  }
}
```

### Schema Generation

**Automatic** (runs before every build):

```json
{
    "scripts": {
        "prebuild": "pnpm db:generate"
    }
}
```

Schema concatenation happens automatically in CI/CD pipelines.

## Database Setup

### 1. Create Production D1 Database

```bash
# Create the database
wrangler d1 create ottabase-db

# Output:
# ✅ Successfully created DB 'ottabase-db'
# 📋 database_id: a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### 2. Update wrangler.jsonc

Replace `PRODUCTION_D1_DATABASE_ID` with the actual ID:

```jsonc
{
  "env": {
    "production": {
      "d1_databases": [{
        "binding: "OBCF_D1",
        "database_name": "ottabase-db",
        "database_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"  // ✅ Real ID
      }]
    }
  }
}
```

**Security Note**: For sensitive projects, use environment variables:

```bash
# Set via GitHub Secrets or Cloudflare environment
echo $PROD_D1_DATABASE_ID | wrangler secret put D1_DATABASE_ID --env production
```

### 3. Verify Database Connection

```bash
# Test connection
wrangler d1 execute ottabase-db --remote --command="SELECT 1"
```

## Migration Workflow

### Development to Production Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Develop Locally                                          │
├─────────────────────────────────────────────────────────────┤
│ $ vim apps/your-app/ottabase/prisma/app.schema.prisma      │
│ $ pnpm db:generate                                          │
│ $ pnpm db:migrate --name=add_users --apply=local           │
│ $ pnpm dev  # Test locally                                  │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Generate Production Migration                            │
├─────────────────────────────────────────────────────────────┤
│ # Migration already generated in step 1                     │
│ # File: prisma/migrations/20241206_add_users/migration.sql │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Apply to Production                                      │
├─────────────────────────────────────────────────────────────┤
│ $ wrangler d1 execute ottabase-db \                         │
│     --remote \                                              │
│     --file=prisma/migrations/20241206_add_users/migration.sql│
│                                                             │
│ # Or use the ottabase CLI (coming soon):                   │
│ $ pnpm db:migrate --apply=remote --env=production          │
└─────────────────────────────────────────────────────────────┘
```

### Migration Commands

**Local Testing**:

```bash
cd apps/your-app

# Generate + apply locally
pnpm db:migrate --name=add_users --apply=local

# Verify
wrangler d1 execute DB --local --command="SELECT * FROM User LIMIT 1"
```

**Production Apply**:

```bash
# Find the latest migration
ls -la prisma/migrations/

# Apply to production
wrangler d1 execute ottabase-db \
  --remote \
  --file=prisma/migrations/20241206123456_add_users/migration.sql

# Verify
wrangler d1 execute ottabase-db --remote --command="SELECT * FROM User LIMIT 1"
```

### Migration Status Tracking

**Check what's been applied**:

```bash
# Local
wrangler d1 migrations list DB --local

# Production
wrangler d1 migrations list ottabase-db --remote
```

**Create migration tracking table** (optional but recommended):

```sql
CREATE TABLE IF NOT EXISTS _prisma_migrations (
  id TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  finished_at INTEGER,
  migration_name TEXT NOT NULL,
  logs TEXT,
  rolled_back_at INTEGER,
  started_at INTEGER DEFAULT (unixepoch() * 1000),
  applied_steps_count INTEGER DEFAULT 0
);
```

## Deployment Process

### Manual Deployment

```bash
cd apps/your-app

# 1. Build (schema auto-generates via prebuild hook)
pnpm build

# 2. Build Cloudflare Worker
pnpm build:worker

# 3. Deploy
wrangler deploy --env production

# Or combined:
pnpm deploy  # Runs all steps
```

### Deployment Checklist

Before deploying:

- [ ] ✅ Run migrations locally and test
- [ ] ✅ Verify schema generated: `ls prisma/schema.prisma`
- [ ] ✅ Test build: `pnpm build`
- [ ] ✅ Apply migrations to production D1
- [ ] ✅ Verify production D1 has tables
- [ ] ✅ Deploy Worker
- [ ] ✅ Test production endpoint

### Zero-Downtime Deployment

For backwards-compatible schema changes:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Add new column (nullable or with default)                │
│    ALTER TABLE users ADD COLUMN phone TEXT;                 │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Deploy new code (uses new column)                        │
│    wrangler deploy --env production                         │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Backfill data (optional)                                 │
│    UPDATE users SET phone = '' WHERE phone IS NULL;         │
└─────────────────────────────────────────────────────────────┘
```

For breaking changes (requires downtime):

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Put app in maintenance mode (optional)                   │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Run migration (e.g., rename column)                      │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Deploy new code immediately                              │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Exit maintenance mode                                    │
└─────────────────────────────────────────────────────────────┘
```

## CI/CD Integration

### GitHub Actions Example

```yaml
# .github/workflows/deploy-production.yml
name: Deploy to Production

on:
    push:
        branches: [main]

jobs:
    deploy:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4

            - uses: pnpm/action-setup@v2
              with:
                  version: 8

            - uses: actions/setup-node@v4
              with:
                  node-version: '20'
                  cache: 'pnpm'

            - name: Install dependencies
              run: pnpm install

            - name: Build app
              run: |
                  cd apps/ottabase-template-app
                  pnpm build
                  pnpm build:worker

            - name: Deploy to Cloudflare
              run: |
                  cd apps/ottabase-template-app
                  pnpm wrangler deploy --env production
              env:
                  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

            - name: Apply migrations
              run: |
                  cd apps/ottabase-template-app
                  # Find latest migration
                  MIGRATION=$(ls -t prisma/migrations/ | head -1)
                  pnpm wrangler d1 execute ottabase-db \
                    --remote \
                    --file=prisma/migrations/$MIGRATION/migration.sql
              env:
                  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

### Environment Variables for CI/CD

**GitHub Secrets** (Settings → Secrets and variables → Actions):

```
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
PROD_D1_DATABASE_ID=a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**Get API Token**: https://dash.cloudflare.com/profile/api-tokens

- Template: "Edit Cloudflare Workers"
- Permissions: Workers, D1, Pages

## Troubleshooting

### Schema Not Updated After Deployment

**Symptom**: Production still uses old schema after deployment.

**Cause**: Prisma Client not regenerated.

**Solution**:

```bash
# Verify prebuild hook exists
grep "prebuild" apps/your-app/package.json

# Manual regeneration
cd apps/your-app
pnpm db:generate
pnpm build
pnpm deploy
```

### Migration Applied But App Fails

**Symptom**: Migration succeeded, but app throws "column not found" errors.

**Cause**: Code deployed before migration, or migration not applied.

**Solution**:

```bash
# Check migration status
wrangler d1 migrations list ottabase-db --remote

# Check actual schema
wrangler d1 execute ottabase-db --remote --command=".schema"

# Re-apply migration if needed
wrangler d1 execute ottabase-db --remote --file=prisma/migrations/.../migration.sql
```

### D1 Database Not Found

**Symptom**: `Error: Database 'ottabase-db' not found`

**Cause**: Database not created or wrong name/ID in wrangler.jsonc.

**Solution**:

```bash
# List databases
wrangler d1 list

# Verify wrangler.jsonc has correct database_id
grep -A 5 "d1_databases" apps/your-app/wrangler.jsonc
```

### Prisma Client Import Fails in Worker

**Symptom**: `Cannot find module '@prisma/client'`

**Cause**: Prisma Client not bundled or wrong binary target.

**Solution**:

```bash
# Regenerate with correct binary targets
cd apps/your-app
pnpm db:generate

# Verify generator in schema
grep -A 5 "generator client" prisma/schema.prisma
# Should have: binaryTargets = ["native", "rhel-openssl-3.0.x"]
```

### Transaction Not Working

**Symptom**: `$transaction` runs but doesn't provide ACID guarantees.

**Cause**: D1 doesn't support transactions (by design).

**Solution**: This is expected behavior. Design your app to:

- Use idempotent operations
- Implement application-level compensating transactions
- Accept eventual consistency

See: [D1 Transaction Warning](./D1_LOCAL_DEVELOPMENT.md#best-practices)

## Production Best Practices

### 1. Test Migrations on Staging First

```bash
# Create staging database
wrangler d1 create ottabase-db-staging

# Apply migrations to staging
wrangler d1 execute ottabase-db-staging \
  --remote \
  --file=prisma/migrations/.../migration.sql

# Deploy to staging worker
wrangler deploy --env staging

# Test thoroughly, then promote to production
```

### 2. Backup Before Major Migrations

```bash
# Export production data
wrangler d1 export ottabase-db --remote --output=backup-$(date +%Y%m%d).sql

# Store backup securely
aws s3 cp backup-$(date +%Y%m%d).sql s3://your-backup-bucket/
```

### 3. Monitor D1 Performance

```bash
# Check D1 analytics in dashboard
open https://dash.cloudflare.com/YOUR_ACCOUNT_ID/workers/d1

# Or via API
curl -X GET "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/d1/database/$DATABASE_ID/query" \
  -H "Authorization: Bearer $API_TOKEN"
```

### 4. Use Preview Environments

```jsonc
// wrangler.jsonc
{
  "env": {
    "preview": {
      "d1_databases": [{
        "binding: "OBCF_D1",
        "database_name": "ottabase-db-preview",
        "database_id": "PREVIEW_DATABASE_ID"
      }]
    },
    "production": {
      "d1_databases": [{
        "binding: "OBCF_D1",
        "database_name": "ottabase-db",
        "database_id": "PRODUCTION_DATABASE_ID"
      }]
    }
  }
}
```

Deploy to preview:

```bash
wrangler deploy --env preview
```

## Schema Update Workflow (Complete Example)

### Scenario: Add `emailVerified` column to User model

**1. Update Schema**:

```prisma
// apps/your-app/ottabase/prisma/app.schema.prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified Boolean   @default(false)  // ✅ New field
  createdAt     BigInt    // Set in app with Date.now()
}
```

**2. Generate & Test Locally**:

```bash
pnpm db:generate
pnpm db:migrate --name=add_email_verified --apply=local
pnpm dev
# Test the feature...
```

**3. Commit & Push**:

```bash
git add prisma/migrations/
git commit -m "feat: add emailVerified field to User"
git push origin main
```

**4. Apply to Production**:

```bash
# CI/CD auto-deploys, or manually:
wrangler d1 execute ottabase-db \
  --remote \
  --file=prisma/migrations/20241206_add_email_verified/migration.sql

wrangler deploy --env production
```

**5. Verify**:

```bash
# Check schema
wrangler d1 execute ottabase-db --remote --command="PRAGMA table_info(User)"

# Test endpoint
curl https://your-app.pages.dev/api/users
```

## Additional Resources

- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/commands/)
- [Local Development Guide](./D1_LOCAL_DEVELOPMENT.md)
- [Prisma D1 Adapter](https://www.prisma.io/docs/orm/overview/databases/cloudflare-d1)

## Support

For production deployment issues:

- GitHub Issues: [ottabase/issues](https://github.com/yourusername/ottabase/issues)
- Cloudflare Community: https://community.cloudflare.com/
- Cloudflare Support: https://support.cloudflare.com/
