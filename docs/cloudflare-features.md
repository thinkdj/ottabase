# Cloudflare Features Guide

Complete guide for using Cloudflare bindings with `@ottabase/cf` and Next.js.

## Overview

This guide covers setup and usage of all Cloudflare Worker bindings:

- **D1**: SQLite database
- **KV**: Key-value storage
- **R2**: Object storage
- **Images**: Image transformation
- **Hyperdrive**: Database connection pooling
- **Queues**: Message queues
- **Secrets**: Environment variables
- **Rate Limiting**: Request throttling

## Setup

### 1. Install Dependencies

The `@ottabase/cf` package and required dependencies are already configured in
`apps/ottabase-template-app-tanstack/package.json`.

```bash
pnpm install
```

### 2. Configure Bindings

**Recommended:** Run `pnpm cf:login` then `pnpm cf:setup` to create all resources. cf:setup outputs IDs for GitHub
Secrets; it does not modify wrangler.jsonc (which stays as a template).

**Manual setup:** Edit `apps/ottabase-template-app-tanstack/wrangler.jsonc` and create resources below.

#### Create D1 Database

```bash
cd apps/ottabase-template-app-tanstack
pnpm wrangler d1 create ottabase-db
```

Copy the returned `database_id` and update `wrangler.jsonc`:

```jsonc
"d1_databases": [{
  "binding: "OBCF_D1",
  "database_name": "ottabase-db",
  "database_id": "YOUR_D1_DATABASE_ID"
}]
```

#### Create KV Namespace

```bash
pnpm wrangler kv namespace create OBCF_KV
pnpm wrangler kv namespace create OBCF_KV --preview
```

Update `wrangler.jsonc` with the returned IDs:

```jsonc
"kv_namespaces": [{
  "binding": "OBCF_KV",
  "id": "YOUR_KV_NAMESPACE_ID",
  "preview_id": "YOUR_KV_PREVIEW_ID"
}]
```

#### Create R2 Bucket

```bash
pnpm wrangler r2 bucket create ottabase-bucket
pnpm wrangler r2 bucket create ottabase-bucket-preview
```

Update `wrangler.jsonc`:

```jsonc
"r2_buckets": [{
  "binding": "OBCF_R2",
  "bucket_name": "ottabase-bucket",
  "preview_bucket_name": "ottabase-bucket-preview"
}]
```

#### Create Queue

```bash
pnpm wrangler queues create ottabase-queue
```

Update `wrangler.jsonc`:

```jsonc
"queues": {
  "producers": [{
    "binding": "OBCF_QUEUE",
    "queue": "ottabase-queue"
  }]
}
```

#### Create Hyperdrive Configuration

Hyperdrive is not available for local development. Skip this for local testing or use `--remote` flag.

```bash
# PostgreSQL example
pnpm wrangler hyperdrive create my-postgres \
  --connection-string="postgres://user:password@host.example.com:5432/database"

# MySQL example
pnpm wrangler hyperdrive create my-mysql \
  --connection-string="mysql://user:password@host.example.com:3306/database"
```

Update `wrangler.jsonc` with the returned Hyperdrive ID:

```jsonc
"hyperdrive": [{
  "binding": "HYPERDRIVE",
  "id": "YOUR_HYPERDRIVE_ID"
}]
```

**Note**: Works with any PostgreSQL or MySQL database including AWS RDS, Google Cloud SQL, Neon, Supabase, PlanetScale,
and others.

### 3. Set Secrets (Optional)

For features requiring API access (like Images):

```bash
pnpm wrangler secret put CF_ACCOUNT_ID
pnpm wrangler secret put CF_API_TOKEN
```

## Development Workflow

### Local Development (with HMR)

```bash
cd apps/ottabase-template-app
pnpm dev
```

- Uses Next.js dev server with HMR
- Bindings use local state (`.wrangler/state/v3/`)
- No Cloudflare account required
- Database, KV, R2 stored locally

### Preview (with workerd)

```bash
pnpm preview
```

- Uses Cloudflare Workers runtime (workerd)
- Can use local or remote bindings
- Test before production deployment

### Production Deploy

```bash
pnpm deploy
```

- Deploys to Cloudflare Workers
- Uses real Cloudflare resources
- Configured bindings from `wrangler.jsonc`

## Usage

### D1 Database

```typescript
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createD1Client } from '@ottabase/cf/d1';

export const runtime = 'edge';

export async function GET() {
    const { env } = await getCloudflareContext();
    const db = createD1Client({ database: env.OBCF_D1 });

    // Query
    const result = await db.query<User>('SELECT * FROM users WHERE id = ?', [userId]);

    // Execute
    await db.execute('INSERT INTO users (name, email) VALUES (?, ?)', ['John', 'john@example.com']);

    // Batch
    await db.batch([
        { sql: 'INSERT INTO users (name) VALUES (?)', params: ['Alice'] },
        { sql: 'INSERT INTO users (name) VALUES (?)', params: ['Bob'] },
    ]);

    return Response.json(result.data);
}
```

### KV Storage

```typescript
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createKVClient } from '@ottabase/cf/kv';

export const runtime = 'edge';

export async function GET() {
    const { env } = await getCloudflareContext();
    const kv = createKVClient({ namespace: env.OBCF_KV });

    // Set with TTL
    await kv.putJSON('session:abc', sessionData, {
        expirationTtl: 3600, // 1 hour
    });

    // Get
    const result = await kv.getJSON<Session>('session:abc');

    // Delete
    await kv.delete('session:abc');

    return Response.json(result.data);
}
```

### R2 Storage

```typescript
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createR2Client } from '@ottabase/cf/r2';

export const runtime = 'edge';

export async function POST(request: Request) {
    const { env } = await getCloudflareContext();
    const r2 = createR2Client({ bucket: env.OBCF_R2 });

    const formData = await request.formData();
    const file = formData.get('file') as File;

    // Upload
    await r2.put(`uploads/${file.name}`, await file.arrayBuffer(), {
        httpMetadata: {
            contentType: file.type,
        },
    });

    // Download
    const result = await r2.get(`uploads/${file.name}`);
    if (result.success && result.data) {
        const content = await result.data.arrayBuffer();
    }

    return Response.json({ success: true });
}
```

### Images

```typescript
import { createImagesClient } from '@ottabase/cf/images';

const images = createImagesClient({
    accountId: env.CF_ACCOUNT_ID,
    apiToken: env.CF_API_TOKEN,
});

// Upload
const result = await images.upload(imageFile, {
    metadata: { alt: 'Product photo' },
});

// Get delivery URL
const url = images.getDeliveryUrl(result.data.id, 'public');
```

### Hyperdrive

Hyperdrive accelerates access to your existing PostgreSQL and MySQL databases by maintaining connection pools and
caching queries at the edge.

#### Setup

```bash
# Create Hyperdrive configuration
pnpm wrangler hyperdrive create my-postgres \
  --connection-string="postgres://user:password@host:5432/database"
```

Update `wrangler.jsonc`:

```jsonc
"hyperdrive": [{
  "binding": "HYPERDRIVE",
  "id": "YOUR_HYPERDRIVE_ID"  // Returned from create command
}]
```

#### Usage with Prisma

```typescript
import { PrismaClient } from '@prisma/client';
import { createHyperdriveClient } from '@ottabase/cf/hyperdrive';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export const runtime = 'edge';

export async function GET() {
    const { env } = await getCloudflareContext();

    const hyperdrive = createHyperdriveClient({
        hyperdrive: env.HYPERDRIVE,
    });

    const prisma = new PrismaClient({
        datasourceUrl: hyperdrive.getConnectionString(),
    });

    const users = await prisma.user.findMany();

    return Response.json({ users });
}
```

#### Usage with pg Driver

```typescript
import { Client } from 'pg';
import { createHyperdriveClient } from '@ottabase/cf/hyperdrive';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export const runtime = 'edge';

export async function GET() {
    const { env } = await getCloudflareContext();

    const hyperdrive = createHyperdriveClient({
        hyperdrive: env.HYPERDRIVE,
    });

    const client = new Client({
        connectionString: hyperdrive.getConnectionString(),
    });

    await client.connect();
    const result = await client.query('SELECT * FROM users LIMIT 10');
    await client.end();

    return Response.json({ users: result.rows });
}
```

#### Usage with Drizzle ORM

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { createHyperdriveClient } from '@ottabase/cf/hyperdrive';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export const runtime = 'edge';

export async function GET() {
    const { env } = await getCloudflareContext();

    const hyperdrive = createHyperdriveClient({
        hyperdrive: env.HYPERDRIVE,
    });

    const client = postgres(hyperdrive.getConnectionString());
    const db = drizzle(client);

    const users = await db.select().from(usersTable);

    return Response.json({ users });
}
```

#### Benefits

- **Connection Pooling**: Reuses connections across requests, eliminating setup overhead
- **Query Caching**: Caches frequently-read queries at the edge for sub-millisecond response times
- **Geographic Optimization**: Smart routing through Cloudflare locations closest to your database
- **Reduced Database Load**: Lower connection count and query load on your database

#### Important Notes

- Hyperdrive is **not available in local development** (`wrangler dev`)
- Use `wrangler dev --remote` to test with real Hyperdrive configuration
- Best for read-heavy workloads with frequently-accessed data
- Compatible with PostgreSQL and MySQL databases (including managed services like AWS RDS, Google Cloud SQL, Neon,
  Supabase, PlanetScale)

### Queues

```typescript
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createQueuesClient } from '@ottabase/cf/queues';

export const runtime = 'edge';

export async function POST(request: Request) {
    const { env } = await getCloudflareContext();
    const queue = createQueuesClient({ queue: env.OBCF_QUEUE });

    // Send message
    await queue.send({
        userId: 123,
        action: 'send-email',
        data: { to: 'user@example.com' },
    });

    return Response.json({ success: true });
}
```

### Rate Limiting

```typescript
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createRateLimitingClient } from '@ottabase/cf/rate-limiting';

export const runtime = 'edge';

export async function GET(request: Request) {
    const { env } = await getCloudflareContext();
    const limiter = createRateLimitingClient({
        rateLimiter: env.RATE_LIMITER,
    });

    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const result = await limiter.limit({ key: `ip:${ip}` });

    if (!result.data.success) {
        return new Response('Too many requests', {
            status: 429,
            headers: {
                'X-RateLimit-Limit': result.data.limit.toString(),
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': result.data.resetAfter.toString(),
            },
        });
    }

    return Response.json({ success: true });
}
```

## Next.js-Specific Notes

### Server Components

Access bindings in Server Components:

```typescript
import { getCloudflareContext } from '@opennextjs/cloudflare';

export default async function Page() {
    const { env } = await getCloudflareContext();
    // Use env.OBCF_D1, env.OBCF_KV, env.OBCF_R2, etc.
}
```

### Route Handlers

All route handlers must use edge runtime:

```typescript
export const runtime = 'edge';
```

### Middleware

Access bindings in middleware:

```typescript
import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function middleware(request: NextRequest) {
    const { env } = await getCloudflareContext();
    // Use bindings for rate limiting, authentication, etc.
}
```

## Best Practices

### Error Handling

All wrapper methods return `Result<T, Error>` type:

```typescript
const result = await db.query('SELECT * FROM users');

if (result.success) {
    console.log(result.data); // T
} else {
    console.error(result.error); // Error
}
```

### Type Safety

Define your environment types:

```typescript
// types/cloudflare.d.ts
export interface CloudflareEnv {
    OBCF_D1: D1Database;
    OBCF_KV: KVNamespace;
    OBCF_R2: R2Bucket;
    OBCF_QUEUE: Queue;
    OBCF_RATE_LIMITER: RateLimiter;
    // ... other bindings
}
```

### Local Development

- All bindings work locally with wrangler
- Data stored in `.wrangler/state/v3/`
- No Cloudflare account needed for development
- Commit `.wrangler` to `.gitignore`

### Performance

- Use KV for frequently accessed data
- Use D1 for relational data queries
- Use R2 for large files/media
- Cache aggressively with TTL

## Troubleshooting

### Binding not found

Check `wrangler.jsonc` configuration and ensure bindings are created:

```bash
pnpm wrangler d1 list
pnpm wrangler kv:namespace list
pnpm wrangler r2 bucket list
```

### Type errors

Run type generation:

```bash
pnpm wrangler types
```

### Local development not working

Delete `.wrangler` directory and restart:

```bash
rm -rf .wrangler
pnpm dev
```

## Demo Pages

Working examples available at:

- `/demo/cloudflare/d1` - D1 Database with CRUD
- `/demo/cloudflare/kv` - KV Storage
- `/demo/cloudflare/r2` - R2 Object Storage
- `/demo/cloudflare/images` - Image Upload
- `/demo/cloudflare/queues` - Message Queues
- `/demo/cloudflare/rate-limiting` - Rate Limiting

## Resources

- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [Cloudflare KV Docs](https://developers.cloudflare.com/kv/)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [OpenNext Cloudflare](https://opennext.js.org/cloudflare/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
