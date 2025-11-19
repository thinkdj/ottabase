# 🚀 Cloudflare Workers Deployment - Quick Start

## What Was Added

Your repository now has **fully automated CI/CD** for deploying the `ottabase-template-app` to Cloudflare Workers!

### New Files

1. **`.github/workflows/deploy-cloudflare.yml`** - GitHub Actions workflow
2. **`.github/workflows/setup-cloudflare-resources.sh`** - Local setup helper script
3. **`docs/CLOUDFLARE_CICD_SETUP.md`** - Complete setup guide (READ THIS FIRST!)
4. **`docs/CLOUDFLARE_QUICK_REFERENCE.md`** - One-page reference
5. **`docs/CLOUDFLARE_ARCHITECTURE.md`** - Architecture documentation
6. **`docs/CLOUDFLARE_TESTING_CHECKLIST.md`** - Testing checklist

## How It Works

When you push code to the `main` branch, GitHub Actions automatically:

1. ✅ Builds your app and all packages
2. ✅ Creates Cloudflare services (if they don't exist):
   - D1 database for SQL data
   - R2 buckets for file storage
   - KV namespaces for key-value data
   - Queue for async processing
   - Durable Objects for real-time features
3. ✅ Deploys to Cloudflare Workers edge network
4. ✅ Makes your app available at: `https://ottabase-template-app.<your-subdomain>.workers.dev`

## 🎯 What You Need to Do (3 Simple Steps)

### Step 1: Create a Cloudflare API Token (2 minutes)

1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Click **"Create Token"**
3. Use the **"Edit Cloudflare Workers"** template
4. Click **"Continue to summary"** → **"Create Token"**
5. **Copy the token** (you won't see it again!)

### Step 2: Get Your Cloudflare Account ID (30 seconds)

1. Go to: https://dash.cloudflare.com/
2. Click **"Workers & Pages"** in the sidebar
3. Copy your **Account ID** (shown on the right side)

### Step 3: Add Secrets to GitHub (1 minute)

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Add these two secrets:

   ```
   Name: CLOUDFLARE_API_TOKEN
   Value: [paste your token from Step 1]
   ```

   ```
   Name: CLOUDFLARE_ACCOUNT_ID
   Value: [paste your account ID from Step 2]
   ```

## 🎉 That's It!

Now when you make code changes:

```bash
git add .
git commit -m "My changes"
git push origin main
```

Your app will automatically deploy to Cloudflare Workers!

## ✅ Validate Your Setup (Optional)

Before deploying, you can validate your local environment:

```bash
./.github/workflows/validate-setup.sh
```

This checks:
- Node.js and pnpm are installed
- Dependencies are installed
- Prisma client is generated
- Repository structure is correct
- Wrangler is installed (optional)
- GitHub secrets are set (if gh CLI is available)

## 📍 Where to Find Your App

After the first deployment:

1. Go to: https://dash.cloudflare.com/
2. Click **Workers & Pages**
3. Find **ottabase-template-app**
4. Click it to see your URL: `https://ottabase-template-app.<your-subdomain>.workers.dev`

## 🧪 Test All Services

Visit these URLs to test all Cloudflare services:

- `https://your-app.workers.dev/demo/cloudflare/d1` - Database (D1)
- `https://your-app.workers.dev/demo/cloudflare/kv` - Key-Value store
- `https://your-app.workers.dev/demo/cloudflare/r2` - File storage
- `https://your-app.workers.dev/demo/cloudflare/queue` - Message queue
- `https://your-app.workers.dev/demo/cloudflare/rate-limit` - Rate limiting

## 📚 Documentation

- **[Setup Guide](docs/CLOUDFLARE_CICD_SETUP.md)** - Complete walkthrough
- **[Quick Reference](docs/CLOUDFLARE_QUICK_REFERENCE.md)** - Common commands
- **[Architecture](docs/CLOUDFLARE_ARCHITECTURE.md)** - How it works
- **[Testing Checklist](docs/CLOUDFLARE_TESTING_CHECKLIST.md)** - Verify deployment

## 💡 Code Examples

### Use D1 Database in API Route

```typescript
// app/api/users/route.ts
import { getCloudflareContext } from '@opennextjs/cloudflare';

export const runtime = 'edge';

export async function GET() {
  const { env } = await getCloudflareContext();
  const users = await env.DB.prepare('SELECT * FROM users').all();
  return Response.json(users.results);
}
```

### Use KV Storage

```typescript
const { env } = await getCloudflareContext();
await env.MY_KV.put('key', 'value');
const value = await env.MY_KV.get('key');
```

### Upload to R2

```typescript
const { env } = await getCloudflareContext();
await env.MY_BUCKET.put('file.txt', fileContent);
const file = await env.MY_BUCKET.get('file.txt');
```

## 💰 Cost

All services have generous free tiers:

- **Workers:** 100,000 requests/day free
- **D1:** 5 GB storage, 5M reads/day free
- **R2:** 10 GB storage, 1M reads/month free
- **KV:** 100,000 reads/day free
- **Queues:** 1M operations/month free

**Perfect for development and small production apps!**

## 🔧 Local Development

```bash
# Install dependencies
pnpm install

# Generate Prisma client
cd packages/db && npx prisma generate

# Build packages
pnpm build:packages

# Run dev server
pnpm dev

# Or preview with Workers runtime
cd apps/ottabase-template-app
pnpm preview
```

## 🆘 Need Help?

1. Check the [Setup Guide](docs/CLOUDFLARE_CICD_SETUP.md) for detailed instructions
2. Review the [Quick Reference](docs/CLOUDFLARE_QUICK_REFERENCE.md) for common commands
3. Use the [Testing Checklist](docs/CLOUDFLARE_TESTING_CHECKLIST.md) to verify everything works
4. Check GitHub Actions logs if deployment fails

## 🎊 What's Next?

After your first successful deployment:

1. ✅ Customize the app in `apps/ottabase-template-app/`
2. ✅ Add your database schema to `prisma/schema.prisma`
3. ✅ Build your features using Cloudflare services
4. ✅ Push to main and watch it auto-deploy!
5. ✅ Add a custom domain (optional)

---

**Ready to deploy?** Add your GitHub secrets and push to main! 🚀
