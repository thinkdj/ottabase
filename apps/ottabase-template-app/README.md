# Ottabase Template App

Next.js 15 template application with Cloudflare Workers integration using OpenNext.

## Features

- **Next.js 15** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Cloudflare Workers** deployment via OpenNext
- **@ottabase/cf** for Cloudflare bindings (D1, KV, R2, etc.)
- **Prisma** for database ORM (with D1 adapter)
- **Demo Pages** for all Cloudflare features

## Quick Start

### Install Dependencies

```bash
pnpm install
```

### Setup Cloudflare Bindings

See [Cloudflare Features Documentation](../../docs/cloudflare-features.md) for complete setup.

Quick commands:

```bash
# Create D1 database
pnpm wrangler d1 create ottabase-db

# Create KV namespace
pnpm wrangler kv:namespace create MY_KV
pnpm wrangler kv:namespace create MY_KV --preview

# Create R2 bucket
pnpm wrangler r2 bucket create ottabase-bucket
pnpm wrangler r2 bucket create ottabase-bucket-preview

# Create Queue
pnpm wrangler queues create ottabase-queue
```

Update the IDs in `wrangler.jsonc`.

### Development

```bash
# Local development with HMR
pnpm dev

# Preview with Cloudflare Workers runtime
pnpm preview

# Deploy to production
pnpm deploy
```

## Project Structure

```
apps/ottabase-template-app/
├── app/                      # Next.js app directory
│   ├── api/                  # API routes
│   │   └── cloudflare/       # Cloudflare feature demos
│   ├── demo/                 # Demo pages
│   │   └── cloudflare/       # Cloudflare demos
│   ├── layout.tsx
│   └── page.tsx
├── types/
│   └── cloudflare.d.ts       # Cloudflare env types
├── wrangler.jsonc            # Cloudflare Workers config
├── open-next.config.ts       # OpenNext configuration
└── next.config.js            # Next.js configuration
```

## Cloudflare Features

This template includes working demos for:

- **D1 Database** - SQLite with full CRUD operations
- **KV Storage** - Key-value storage with TTL
- **R2 Storage** - Object storage for files
- **Images** - Image upload and transformation
- **Queues** - Async message processing
- **Rate Limiting** - Request throttling

Visit `/demo/cloudflare` after starting the dev server.

## Using Cloudflare Bindings

### In Route Handlers

```typescript
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createD1Client } from '@ottabase/cf/d1';

export const runtime = 'edge';

export async function GET() {
  const { env } = await getCloudflareContext();
  const db = createD1Client({ database: env.DB });

  const result = await db.query('SELECT * FROM users');

  return Response.json(result.data);
}
```

### In Server Components

```typescript
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createKVClient } from '@ottabase/cf/kv';

export default async function Page() {
  const { env } = await getCloudflareContext();
  const kv = createKVClient({ namespace: env.MY_KV });

  const data = await kv.getJSON('key');

  return <div>{JSON.stringify(data)}</div>;
}
```

## Documentation

- [Cloudflare Features Guide](../../docs/cloudflare-features.md) - Complete setup and usage
- [Package Creation Guide](../../PACKAGE_CREATION_GUIDE.md) - Creating new packages

## Scripts

```bash
# Development
pnpm dev              # Start Next.js dev server (HMR)
pnpm preview          # Preview with Cloudflare runtime

# Build & Deploy
pnpm build            # Build Next.js app
pnpm deploy           # Deploy to Cloudflare Workers

# Utilities
pnpm lint             # Lint code
pnpm type-check       # Type check
pnpm wrangler         # Run wrangler commands
```

## Environment Variables

Set via `wrangler.jsonc`:

```jsonc
"vars": {
  "ENVIRONMENT": "development",
  "NODE_ENV": "production"
}
```

For secrets:

```bash
pnpm wrangler secret put SECRET_NAME
```

## Local Development Notes

- Cloudflare bindings work locally without an account
- Data stored in `.wrangler/state/v3/`
- HMR (Hot Module Replacement) works normally
- Use `pnpm preview` to test with actual Workers runtime

## Deployment

### First-time Setup

1. Login to Cloudflare:
   ```bash
   pnpm wrangler login
   ```

2. Create bindings (D1, KV, R2, etc.)

3. Update `wrangler.jsonc` with IDs

### Deploy

```bash
pnpm deploy
```

Your app will be available at `https://ottabase-template-app.<your-subdomain>.workers.dev`

### Custom Domain

Add to `wrangler.jsonc`:

```jsonc
"routes": [{
  "pattern": "your-domain.com",
  "custom_domain": true
}]
```

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [OpenNext](https://opennext.js.org/cloudflare/)
- [@ottabase/cf Package](../../packages/cf/README.md)
