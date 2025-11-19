# Cloudflare Workers CI/CD Setup Guide

This guide explains how to set up fully automated CI/CD for deploying the `ottabase-template-app` to Cloudflare Workers, with all required services (D1, R2, KV, Queues, and Durable Objects) automatically provisioned and usable.

## Overview

The CI/CD pipeline automatically:
- ✅ Builds the template app and all dependencies
- ✅ Creates Cloudflare services if they don't exist (D1, R2, KV, Queues)
- ✅ Deploys the app to Cloudflare Workers on every push to main
- ✅ Provides a testing URL with all services connected

## Prerequisites

Before setting up CI/CD, you need:

1. **Cloudflare Account** - Free tier is sufficient
2. **GitHub Repository** - Access to repository settings
3. **Cloudflare API Token** - With appropriate permissions

## Step 1: Create Cloudflare API Token

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Click on your profile (top right) → **My Profile** → **API Tokens**
3. Click **Create Token**
4. Use the **Edit Cloudflare Workers** template or create a custom token with these permissions:
   - **Account** - Workers Scripts: Edit
   - **Account** - Workers KV Storage: Edit
   - **Account** - Workers R2 Storage: Edit
   - **Account** - D1: Edit
   - **Account** - Cloudflare Queues: Edit
   - **Account** - Account Settings: Read
5. Set **Account Resources** to: Include → Your Account
6. Click **Continue to summary** → **Create Token**
7. **Copy the token** - you won't see it again!

## Step 2: Get Your Cloudflare Account ID

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select **Workers & Pages** from the left sidebar
3. Your **Account ID** is shown on the right side of the page
4. Copy the Account ID

## Step 3: Add Secrets to GitHub Repository

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add these two secrets:

   **Secret 1:**
   - Name: `CLOUDFLARE_API_TOKEN`
   - Value: Paste the API token from Step 1

   **Secret 2:**
   - Name: `CLOUDFLARE_ACCOUNT_ID`
   - Value: Paste the Account ID from Step 2

## Step 4: Trigger the First Deployment

### Option A: Push to Main Branch
```bash
git checkout main
git pull origin main
# Make a change or use an empty commit
git commit --allow-empty -m "Trigger initial Cloudflare deployment"
git push origin main
```

### Option B: Manual Workflow Dispatch
1. Go to your GitHub repository
2. Click **Actions** tab
3. Select **Deploy to Cloudflare Workers** workflow
4. Click **Run workflow** → Select **main** branch → **Run workflow**

## Step 5: Monitor Deployment

1. Go to **Actions** tab in your GitHub repository
2. Click on the running workflow
3. Expand the steps to see progress:
   - Build packages
   - Setup Cloudflare bindings (creates D1, R2, KV, Queues)
   - Deploy to Cloudflare Workers

## Step 6: Access Your Deployed App

After successful deployment, your app will be available at:

```
https://ottabase-template-app.<your-subdomain>.workers.dev
```

To find your exact URL:
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Click **Workers & Pages**
3. Find **ottabase-template-app** in the list
4. Click on it to see the URL

## What Gets Created Automatically

The CI/CD pipeline automatically creates these Cloudflare resources:

### 1. D1 Database
- **Name:** `ottabase-db`
- **Purpose:** SQLite database for Prisma ORM
- **Binding:** `DB`
- **Access in code:** `env.DB`

### 2. R2 Buckets
- **Production:** `ottabase-bucket`
- **Preview:** `ottabase-bucket-preview`
- **Purpose:** Object storage for files
- **Binding:** `MY_BUCKET`
- **Access in code:** `env.MY_BUCKET`

### 3. KV Namespaces
- **Production:** `ottabase-template-app-MY_KV`
- **Preview:** `ottabase-template-app-MY_KV_preview`
- **Purpose:** Key-value storage
- **Binding:** `MY_KV`
- **Access in code:** `env.MY_KV`

### 4. Queue
- **Name:** `ottabase-queue`
- **Purpose:** Async message processing
- **Binding:** `MY_QUEUE`
- **Access in code:** `env.MY_QUEUE`

### 5. Durable Objects
- **Class:** `RealtimeActor`
- **Purpose:** Stateful WebSocket connections
- **Binding:** `REALTIME`
- **Access in code:** `env.REALTIME`

## Testing Your Services

After deployment, visit these demo pages to test all services:

```
https://your-app.workers.dev/demo/cloudflare/d1
https://your-app.workers.dev/demo/cloudflare/kv
https://your-app.workers.dev/demo/cloudflare/r2
https://your-app.workers.dev/demo/cloudflare/queue
https://your-app.workers.dev/demo/cloudflare/rate-limit
```

## Using Services in Your Code

### In API Routes

```typescript
import { getCloudflareContext } from '@opennextjs/cloudflare';

export const runtime = 'edge';

export async function GET() {
  const { env } = await getCloudflareContext();
  
  // Use D1 database
  const result = await env.DB.prepare('SELECT * FROM users').all();
  
  // Use KV storage
  await env.MY_KV.put('key', 'value');
  const value = await env.MY_KV.get('key');
  
  // Use R2 storage
  await env.MY_BUCKET.put('file.txt', 'content');
  const file = await env.MY_BUCKET.get('file.txt');
  
  // Send to Queue
  await env.MY_QUEUE.send({ data: 'message' });
  
  return Response.json({ success: true });
}
```

### In Server Components

```typescript
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createD1Client } from '@ottabase/cf/d1';

export default async function Page() {
  const { env } = await getCloudflareContext();
  const db = createD1Client({ database: env.DB });
  
  const users = await db.query('SELECT * FROM users');
  
  return <div>{JSON.stringify(users.data)}</div>;
}
```

## Continuous Deployment

The workflow automatically deploys when:

1. **Push to main branch** with changes to:
   - `apps/ottabase-template-app/**`
   - `packages/**`
   - `.github/workflows/deploy-cloudflare.yml`

2. **Manual trigger** via GitHub Actions UI

## Database Migrations

To run database migrations on deployment:

1. Add migration files to `apps/ottabase-template-app/prisma/migrations/`
2. The workflow will automatically apply them during deployment

Or manually run:
```bash
cd apps/ottabase-template-app
pnpm wrangler d1 execute ottabase-db --remote --file=./prisma/migrations/001_init.sql
```

## Troubleshooting

### Deployment Fails with "Authentication Error"

**Solution:** Check that your `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are correctly set in GitHub Secrets.

### Service Already Exists Error

**Solution:** The workflow handles existing services gracefully. If you see errors, check the Cloudflare dashboard to verify the services exist.

### Build Fails

**Solution:** 
1. Check the GitHub Actions logs for specific errors
2. Try building locally: `pnpm build --filter=@ottabase/ottabase-template-app`
3. Ensure all dependencies are properly installed

### Can't Access Deployed URL

**Solution:**
1. Check the Cloudflare Workers dashboard for the correct URL
2. Wait 1-2 minutes for DNS propagation
3. Check if the deployment completed successfully in GitHub Actions

## Advanced Configuration

### Custom Domain

Add to `apps/ottabase-template-app/wrangler.jsonc`:

```jsonc
"routes": [
  {
    "pattern": "your-domain.com",
    "custom_domain": true
  }
]
```

### Environment-Specific Configuration

Add environment-specific settings to `wrangler.jsonc`:

```jsonc
"env": {
  "staging": {
    "vars": {
      "ENVIRONMENT": "staging"
    }
  },
  "production": {
    "vars": {
      "ENVIRONMENT": "production"
    }
  }
}
```

### Secrets Management

For sensitive values, use Wrangler secrets:

```bash
cd apps/ottabase-template-app
pnpm wrangler secret put MY_SECRET_KEY
```

Or add to GitHub Actions:
```yaml
- name: Set secrets
  run: |
    echo "${{ secrets.MY_SECRET }}" | pnpm wrangler secret put MY_SECRET_KEY
```

## Cost Considerations

All Cloudflare services used have generous free tiers:

- **Workers:** 100,000 requests/day free
- **D1:** 5 GB storage, 5 million reads/day free
- **R2:** 10 GB storage, 1 million reads/month free
- **KV:** 100,000 reads/day free
- **Queues:** 1 million operations/month free
- **Durable Objects:** First million requests free

The template app should stay within free tier limits for development and testing.

## Next Steps

1. **Customize the app** - Modify `apps/ottabase-template-app/`
2. **Add database schema** - Update `prisma/schema.prisma`
3. **Configure custom domain** - Add to `wrangler.jsonc`
4. **Monitor usage** - Check Cloudflare dashboard
5. **Scale as needed** - Upgrade to paid plans when necessary

## Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [OpenNext Cloudflare Adapter](https://opennext.js.org/cloudflare/)
- [Ottabase Template App README](../apps/ottabase-template-app/README.md)
- [Cloudflare Features Guide](./cloudflare-features.md)

## Support

For issues or questions:
1. Check GitHub Actions logs for error details
2. Review [Cloudflare Community Forums](https://community.cloudflare.com/)
3. Open an issue in the repository
