# Cloudflare Workers - Quick Reference

## 🚀 Setup (One-time)

### 1. Get Cloudflare Credentials
```bash
# Login to Cloudflare
cd apps/ottabase-template-app
pnpm wrangler login

# Get Account ID from dashboard
# https://dash.cloudflare.com/
# Workers & Pages → Account ID (right side)
```

### 2. Create API Token
- Go to: https://dash.cloudflare.com/profile/api-tokens
- Use **Edit Cloudflare Workers** template
- Copy the token

### 3. Add to GitHub Secrets
Repository → Settings → Secrets and variables → Actions → New secret

- `CLOUDFLARE_API_TOKEN` = Your API token
- `CLOUDFLARE_ACCOUNT_ID` = Your account ID

### 4. Deploy
```bash
git push origin main
```

## 📦 Services Auto-Created

| Service | Name | Binding | Code Access |
|---------|------|---------|-------------|
| D1 Database | `ottabase-db` | `DB` | `env.DB` |
| R2 Bucket | `ottabase-bucket` | `MY_BUCKET` | `env.MY_BUCKET` |
| KV Store | `MY_KV` | `MY_KV` | `env.MY_KV` |
| Queue | `ottabase-queue` | `MY_QUEUE` | `env.MY_QUEUE` |
| Durable Object | `RealtimeActor` | `REALTIME` | `env.REALTIME` |

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

# Preview with Workers runtime
cd apps/ottabase-template-app
pnpm preview
```

## 🌐 Code Examples

### API Route with D1
```typescript
// app/api/users/route.ts
import { getCloudflareContext } from '@opennextjs/cloudflare';

export const runtime = 'edge';

export async function GET() {
  const { env } = await getCloudflareContext();
  const result = await env.DB.prepare('SELECT * FROM users').all();
  return Response.json(result.results);
}
```

### Server Component with KV
```typescript
// app/page.tsx
import { getCloudflareContext } from '@opennextjs/cloudflare';

export default async function Page() {
  const { env } = await getCloudflareContext();
  const value = await env.MY_KV.get('key');
  return <div>Value: {value}</div>;
}
```

### R2 Upload
```typescript
const { env } = await getCloudflareContext();
await env.MY_BUCKET.put('file.txt', 'content');
const file = await env.MY_BUCKET.get('file.txt');
```

### Queue Message
```typescript
const { env } = await getCloudflareContext();
await env.MY_QUEUE.send({ message: 'Hello Queue!' });
```

## 📊 Useful Commands

```bash
# Deploy manually
cd apps/ottabase-template-app
pnpm deploy

# List deployments
pnpm wrangler deployments list

# View logs
pnpm wrangler tail

# D1 commands
pnpm wrangler d1 list
pnpm wrangler d1 execute ottabase-db --remote --command="SELECT * FROM users"

# KV commands
pnpm wrangler kv:namespace list
pnpm wrangler kv:key list --namespace-id=<ID>

# R2 commands
pnpm wrangler r2 bucket list
pnpm wrangler r2 object list ottabase-bucket

# Queue commands
pnpm wrangler queues list
```

## 🔍 Monitoring

### Check Deployment Status
- GitHub: Actions tab
- Cloudflare: Workers & Pages → ottabase-template-app

### View Logs
```bash
pnpm wrangler tail
```

### Check Usage
- Cloudflare Dashboard → Analytics

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Auth error | Check GitHub secrets are set correctly |
| Build fails | Run `pnpm build` locally first |
| Service exists | Workflow handles this automatically |
| Can't access URL | Wait 1-2 mins for DNS propagation |

## 📝 Next Steps

1. ✅ Set up GitHub secrets
2. ✅ Push to main branch
3. ✅ Monitor deployment in Actions
4. ✅ Access your app at `.workers.dev` URL
5. ✅ Test services at `/demo/cloudflare/*`
6. ✅ Customize and build!

## 🔗 Resources

- [Full Setup Guide](CLOUDFLARE_CICD_SETUP.md)
- [Cloudflare Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [Template App README](../apps/ottabase-template-app/README.md)
