# Cloudflare Workers Architecture

This document explains the architecture of the ottabase-template-app on Cloudflare Workers.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         GitHub Actions                           │
│                                                                   │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────┐        │
│  │   Build     │ -> │   Provision  │ -> │   Deploy    │        │
│  │  Packages   │    │   Services   │    │  to Workers │        │
│  └─────────────┘    └──────────────┘    └─────────────┘        │
│                              │                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Cloudflare Workers                          │
│                                                                   │
│  ┌───────────────────────────────────────────────────────┐      │
│  │               Next.js App (OpenNext)                   │      │
│  │                                                        │      │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │      │
│  │  │   API    │  │  Server  │  │  Static  │           │      │
│  │  │  Routes  │  │Components│  │  Assets  │           │      │
│  │  └──────────┘  └──────────┘  └──────────┘           │      │
│  │                        │                              │      │
│  └────────────────────────┼──────────────────────────────┘      │
│                           │                                      │
│                           ▼                                      │
│  ┌────────────────────────────────────────────────────┐         │
│  │           Cloudflare Bindings                      │         │
│  │                                                    │         │
│  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌───────┐  ┌─────┐│         │
│  │  │  D1  │  │  KV  │  │  R2  │  │Queue  │  │ DO  ││         │
│  │  │  DB  │  │Store │  │Bucket│  │       │  │     ││         │
│  │  └──────┘  └──────┘  └──────┘  └───────┘  └─────┘│         │
│  └────────────────────────────────────────────────────┘         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
                        End Users (HTTPS)
```

## Components

### 1. GitHub Actions Workflow

**Location:** `.github/workflows/deploy-cloudflare.yml`

**Responsibilities:**
- Build the monorepo packages
- Generate Prisma client
- Create/verify Cloudflare services
- Deploy application to Workers

**Triggers:**
- Push to `main` branch
- Manual workflow dispatch

### 2. Next.js Application (OpenNext)

**Location:** `apps/ottabase-template-app/`

**Technology Stack:**
- Next.js 15 with App Router
- TypeScript
- Tailwind CSS + Mantine UI
- Prisma ORM

**Build Process:**
1. Next.js build (`pnpm build`)
2. OpenNext transformation (converts to Workers-compatible format)
3. Output: `.worker-next/` directory

### 3. Cloudflare Services

#### D1 Database
- **Type:** SQLite-compatible SQL database
- **Binding:** `DB`
- **Usage:** Prisma client + D1 adapter
- **Example:** User authentication, content storage

#### KV Storage
- **Type:** Key-Value store
- **Binding:** `MY_KV`
- **Usage:** Cache, sessions, temporary data
- **Example:** Session storage, feature flags

#### R2 Storage
- **Type:** Object storage (S3-compatible)
- **Binding:** `MY_BUCKET`
- **Usage:** File uploads, media storage
- **Example:** User avatars, document storage

#### Queues
- **Type:** Message queue for async processing
- **Binding:** `MY_QUEUE`
- **Usage:** Background jobs, email sending
- **Example:** Batch processing, notifications

#### Durable Objects
- **Type:** Stateful coordination primitives
- **Binding:** `REALTIME`
- **Usage:** WebSocket connections, real-time features
- **Example:** Chat rooms, collaborative editing

## Request Flow

### 1. Static Assets
```
User Request → Workers → Assets Binding → Static Files
```

### 2. Server-Side Rendered Pages
```
User Request → Workers → Next.js SSR → Bindings → Response
```

### 3. API Routes
```
User Request → Workers → API Handler → Bindings → JSON Response
```

### 4. Database Queries
```
API/Component → getCloudflareContext() → env.DB → D1 → Prisma → Results
```

## CI/CD Pipeline

### Phase 1: Build
```
1. Checkout code
2. Setup Node.js & pnpm
3. Install dependencies
4. Generate Prisma client
5. Build packages (turbo)
6. Build Next.js app (OpenNext)
```

### Phase 2: Provision Services (Idempotent)
```
For each service:
  Check if exists → Create if not → Get/Store ID
  
Services:
  - D1 database
  - R2 buckets (prod + preview)
  - KV namespaces (prod + preview)
  - Queue
```

### Phase 3: Deploy
```
1. Update wrangler.jsonc with service IDs
2. Run: wrangler deploy
3. Workers deployed to CDN edge
4. Service bindings connected
5. App accessible globally
```

## Configuration Files

### wrangler.jsonc
```jsonc
{
  "name": "ottabase-template-app",
  "main": ".worker-next/index.mjs",
  "d1_databases": [...],
  "kv_namespaces": [...],
  "r2_buckets": [...],
  "queues": {...},
  "durable_objects": {...}
}
```

### open-next.config.ts
```typescript
{
  default: {
    override: {
      wrapper: 'cloudflare-node'
    }
  }
}
```

## Security

### Secrets Management
- API tokens stored in GitHub Secrets
- Runtime secrets via `wrangler secret put`
- Environment variables in `wrangler.jsonc`

### Authentication Flow
```
GitHub Actions → CLOUDFLARE_API_TOKEN → Wrangler CLI → Cloudflare API
```

## Monitoring & Debugging

### Real-time Logs
```bash
pnpm wrangler tail
```

### Deployment History
```bash
pnpm wrangler deployments list
```

### Analytics
- Cloudflare Dashboard → Analytics
- Request count, error rates, CPU usage

## Scalability

### Edge Deployment
- Deployed to 300+ Cloudflare data centers
- Automatic load balancing
- Sub-50ms latency globally

### Resource Limits (Free Tier)
- Workers: 100,000 requests/day
- D1: 5 GB storage, 5M reads/day
- R2: 10 GB storage, 1M reads/month
- KV: 100,000 reads/day
- Queues: 1M operations/month

### Scaling Strategy
1. Start with free tier
2. Monitor usage in dashboard
3. Upgrade to paid plans as needed
4. Consider adding caching layers

## Development Workflow

### Local Development
```bash
pnpm dev                    # Next.js dev server with HMR
# Local bindings in .wrangler/state/v3/
```

### Preview with Workers Runtime
```bash
pnpm preview                # Test with actual Workers runtime
```

### Production Deployment
```bash
git push origin main        # Automatic via CI/CD
# or
pnpm deploy                 # Manual deployment
```

## Best Practices

### 1. Database
- Use D1 for relational data
- Add indexes for frequently queried fields
- Use transactions for data consistency

### 2. Caching
- Use KV for frequently accessed data
- Set appropriate TTLs
- Invalidate cache on updates

### 3. Files
- Use R2 for large files (> 25 MB)
- Use KV for small files (< 25 MB)
- Implement signed URLs for private files

### 4. Async Processing
- Use Queues for non-critical operations
- Implement retry logic
- Monitor queue depth

### 5. Real-time
- Use Durable Objects for WebSocket state
- Implement connection management
- Handle reconnection gracefully

## Cost Optimization

### Tips
1. Use caching aggressively (KV, R2)
2. Optimize database queries (indexes)
3. Implement rate limiting
4. Use CDN for static assets
5. Monitor usage patterns

### Expected Costs (Typical App)
- **Development:** $0/month (free tier)
- **Small Production:** $5-20/month (10K-100K users)
- **Medium Production:** $20-100/month (100K-1M users)

## Troubleshooting

### Common Issues

**1. Build Fails**
- Check build logs in GitHub Actions
- Test locally: `pnpm build`
- Ensure Prisma client is generated

**2. Service Creation Fails**
- Verify API token permissions
- Check Cloudflare account status
- Review workflow logs

**3. Deployment Succeeds but App Errors**
- Check wrangler tail for runtime errors
- Verify service IDs in wrangler.jsonc
- Test bindings in preview mode

**4. Performance Issues**
- Review Analytics dashboard
- Check for slow database queries
- Optimize asset sizes
- Add caching layers

## Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [D1 Database](https://developers.cloudflare.com/d1/)
- [R2 Storage](https://developers.cloudflare.com/r2/)
- [KV Storage](https://developers.cloudflare.com/kv/)
- [Queues](https://developers.cloudflare.com/queues/)
- [Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [OpenNext](https://opennext.js.org/cloudflare/)
