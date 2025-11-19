# 🚀 How to Deploy Your App to Cloudflare Workers

## TL;DR - Quick Start (3 Steps)

1. **Get Cloudflare API Token**: https://dash.cloudflare.com/profile/api-tokens (Use "Edit Cloudflare Workers" template)
2. **Add GitHub Secrets**: Repository Settings → Secrets → Actions
   - `CLOUDFLARE_API_TOKEN` = Your token from step 1
   - `CLOUDFLARE_ACCOUNT_ID` = From https://dash.cloudflare.com/ (Workers & Pages section)
3. **Push to main branch**: `git push origin main`

Your app will automatically deploy to Cloudflare Workers! 🎉

## What Happens When You Deploy?

### Automatic Actions:
✅ Installs all dependencies
✅ Builds all packages
✅ Creates D1 database (if doesn't exist)
✅ Creates R2 buckets for file storage (if don't exist)
✅ Creates KV namespaces for caching (if don't exist)
✅ Creates Queue for async processing (if doesn't exist)
✅ Deploys to 300+ global edge locations
✅ App is live in ~5 minutes

### Services Created Automatically:

| Service | What It Does | Where to Use |
|---------|-------------|--------------|
| **D1 Database** | SQL database for your data | User accounts, posts, any structured data |
| **R2 Storage** | File/object storage | User uploads, images, documents |
| **KV Store** | Fast key-value cache | Session data, feature flags, temp data |
| **Queue** | Background job processor | Email sending, batch processing |
| **Durable Objects** | WebSocket state | Real-time chat, notifications |

## Step-by-Step Instructions

### 1. Create Cloudflare API Token (2 minutes)

1. Login to Cloudflare: https://dash.cloudflare.com/
2. Click your profile (top right) → **My Profile**
3. Click **API Tokens** tab
4. Click **Create Token**
5. Find **"Edit Cloudflare Workers"** template → Click **Use template**
6. Review permissions (should be pre-filled correctly)
7. Click **Continue to summary**
8. Click **Create Token**
9. **IMPORTANT**: Copy the token now! You won't see it again.

### 2. Get Your Account ID (30 seconds)

1. Go to: https://dash.cloudflare.com/
2. Click **Workers & Pages** in the left sidebar
3. See **Account ID** on the right side? Copy it!

### 3. Add Secrets to GitHub (1 minute)

1. Go to your repository on GitHub
2. Click **Settings** tab (top right)
3. In left sidebar: **Secrets and variables** → **Actions**
4. Click **New repository secret**

Add secret #1:
```
Name: CLOUDFLARE_API_TOKEN
Secret: [paste your API token from step 1]
```

Click **Add secret**

Add secret #2:
```
Name: CLOUDFLARE_ACCOUNT_ID
Secret: [paste your account ID from step 2]
```

Click **Add secret**

### 4. Deploy! (Automatic)

#### Option A: Push to main branch
```bash
git push origin main
```

#### Option B: Trigger manually
1. Go to **Actions** tab on GitHub
2. Click **Deploy to Cloudflare Workers**
3. Click **Run workflow** → Select **main** branch → **Run workflow**

### 5. Watch It Deploy (5 minutes)

1. Stay on the **Actions** tab
2. Click on the running workflow
3. Watch the steps complete:
   - ✓ Build packages
   - ✓ Setup Cloudflare bindings
   - ✓ Deploy to Cloudflare Workers

### 6. Access Your App

After deployment completes:

1. Go to: https://dash.cloudflare.com/
2. Click **Workers & Pages**
3. Find **ottabase-template-app** → Click it
4. See your URL: `https://ottabase-template-app.YOUR_SUBDOMAIN.workers.dev`
5. Click the URL to open your app!

### 7. Test All Services

Visit these URLs to test each service:

```
https://your-app.workers.dev/                         → Homepage
https://your-app.workers.dev/demo/cloudflare/d1       → Database
https://your-app.workers.dev/demo/cloudflare/kv       → Key-Value Store
https://your-app.workers.dev/demo/cloudflare/r2       → File Storage
https://your-app.workers.dev/demo/cloudflare/queue    → Message Queue
https://your-app.workers.dev/demo/cloudflare/rate-limit → Rate Limiting
```

## Troubleshooting

### "Authentication failed" error
**Fix**: Check that your GitHub secrets are set correctly
1. Go to Settings → Secrets → Actions
2. Verify `CLOUDFLARE_API_TOKEN` exists
3. Verify `CLOUDFLARE_ACCOUNT_ID` exists
4. If needed, delete and recreate them

### "Service already exists" warning
**Fix**: This is normal! The workflow reuses existing services. No action needed.

### Build fails
**Fix**: Check the GitHub Actions logs
1. Go to Actions tab → Click the failed workflow
2. Expand the failed step to see the error
3. Most common: Missing dependency or syntax error

### Can't access the deployed URL
**Fix**: Wait 1-2 minutes for DNS propagation, then:
1. Check Cloudflare Dashboard to confirm deployment
2. Try opening in incognito/private window
3. Check GitHub Actions logs for deployment URL

## What If I Want to...

### Deploy to a custom domain?
Edit `apps/ottabase-template-app/wrangler.jsonc`:
```jsonc
"routes": [
  {
    "pattern": "yourdomain.com",
    "custom_domain": true
  }
]
```

### See deployment logs?
```bash
cd apps/ottabase-template-app
pnpm wrangler tail
```

### Deploy manually?
```bash
cd apps/ottabase-template-app
pnpm deploy
```

### Test locally before deploying?
```bash
pnpm dev              # Normal Next.js dev
pnpm preview          # With Cloudflare Workers runtime
```

### Check my usage?
Go to Cloudflare Dashboard → Analytics

### Rollback a deployment?
```bash
cd apps/ottabase-template-app
pnpm wrangler rollback [deployment-id]
```

## Free Tier Limits

All services have generous free tiers:

- **Workers**: 100,000 requests/day
- **D1**: 5 GB storage + 5M reads/day
- **R2**: 10 GB storage + 1M reads/month
- **KV**: 100,000 reads/day
- **Queues**: 1M operations/month
- **Durable Objects**: 1M requests/month

Perfect for development and small production apps!

## Using Services in Your Code

### In API Routes
```typescript
// app/api/example/route.ts
import { getCloudflareContext } from '@opennextjs/cloudflare';

export const runtime = 'edge';

export async function GET() {
  const { env } = await getCloudflareContext();
  
  // Use D1 database
  const users = await env.DB.prepare('SELECT * FROM users').all();
  
  // Use KV store
  await env.MY_KV.put('key', 'value');
  const value = await env.MY_KV.get('key');
  
  // Use R2 storage
  await env.MY_BUCKET.put('file.txt', 'content');
  
  // Send to queue
  await env.MY_QUEUE.send({ message: 'hello' });
  
  return Response.json({ users: users.results });
}
```

### In Server Components
```typescript
// app/page.tsx
import { getCloudflareContext } from '@opennextjs/cloudflare';

export default async function Page() {
  const { env } = await getCloudflareContext();
  const data = await env.MY_KV.get('key');
  return <div>Data: {data}</div>;
}
```

## More Help?

📖 **Detailed Setup**: [docs/CLOUDFLARE_CICD_SETUP.md](docs/CLOUDFLARE_CICD_SETUP.md)
📋 **Quick Reference**: [docs/CLOUDFLARE_QUICK_REFERENCE.md](docs/CLOUDFLARE_QUICK_REFERENCE.md)
🏗️ **Architecture**: [docs/CLOUDFLARE_ARCHITECTURE.md](docs/CLOUDFLARE_ARCHITECTURE.md)
✅ **Testing Checklist**: [docs/CLOUDFLARE_TESTING_CHECKLIST.md](docs/CLOUDFLARE_TESTING_CHECKLIST.md)

## Questions?

Common questions are answered in the [Setup Guide](docs/CLOUDFLARE_CICD_SETUP.md#troubleshooting).

---

**Ready?** Add your GitHub secrets and push to main! 🚀
