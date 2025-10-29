# Cloudflare Integration for @ottabase/db

Complete guide for using `@ottabase/db` with Cloudflare Workers, D1, and KV storage powered by `@ottabase/cf-data`.

## Table of Contents

- [Overview](#overview)
- [Package Architecture](#package-architecture)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [Basic Usage](#basic-usage)
- [Advanced Patterns](#advanced-patterns)
- [Complete Examples](#complete-examples)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## Overview

The `@ottabase/db` package now includes full Cloudflare Workers support through integration with `@ottabase/cf-data`. This enables you to:

- Use Prisma ORM with Cloudflare D1 databases
- Leverage the D1 adapter for type-safe database operations
- Combine D1 with KV storage for optimal performance
- Implement multi-level caching strategies
- Run production-ready database applications on the edge

### Package Integration

```
@ottabase/db (Prisma Client + Schemas)
    ↓
@ottabase/db/cloudflare (Cloudflare Integration Layer)
    ↓
@ottabase/cf-data (KV, D1, Cache Implementations)
    ↓
Cloudflare Workers Runtime (D1, KV Bindings)
```

## Package Architecture

### @ottabase/db

Traditional Prisma package with:
- Global Prisma client for Node.js applications
- Modular schema system
- Type-safe database operations

### @ottabase/db/cloudflare

Cloudflare-specific integration:
- D1 adapter initialization
- Prisma client factory for Workers
- Singleton pattern support
- Type definitions for Cloudflare runtime

### @ottabase/cf-data

Core Cloudflare functionality:
- KV store adapter
- D1 database adapter
- Multi-level caching
- Prisma adapter implementation

## Prerequisites

### 1. Wrangler CLI

```bash
npm install -g wrangler
wrangler login
```

### 2. D1 Database

Create a D1 database:

```bash
# Create D1 database
wrangler d1 create my-database

# Output will show database ID
# ✅ Successfully created DB 'my-database' (xxxxx-xxxx-xxxx-xxxx-xxxx)
```

### 3. Wrangler Configuration

Update `wrangler.toml`:

```toml
name = "my-worker"
main = "src/index.ts"
compatibility_date = "2024-01-01"

# D1 Database Binding
[[d1_databases]]
binding = "DB"
database_name = "my-database"
database_id = "xxxxx-xxxx-xxxx-xxxx-xxxx"

# Optional: KV Namespace for caching
[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-namespace-id"
```

### 4. Package Dependencies

Add to your worker's `package.json`:

```json
{
  "dependencies": {
    "@ottabase/db": "workspace:*",
    "@ottabase/cf-data": "workspace:*",
    "@prisma/client": "^5.22.0",
    "@cloudflare/workers-types": "^4.20241127.0"
  }
}
```

## Installation & Setup

### Step 1: Configure Prisma Schema

Create or update `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider = "sqlite"  // D1 uses SQLite
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?
  published Boolean  @default(false)
  authorId  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Important:** Enable `driverAdapters` preview feature for D1 support.

### Step 2: Generate Prisma Client

```bash
# Set a dummy DATABASE_URL for generation
export DATABASE_URL="file:./dev.db"

# Generate Prisma client
pnpm prisma generate
```

### Step 3: Initialize D1 Schema

```bash
# Create SQL schema from Prisma
pnpm prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > schema.sql

# Apply to D1 database (local)
wrangler d1 execute my-database --local --file=schema.sql

# Apply to D1 database (production)
wrangler d1 execute my-database --remote --file=schema.sql
```

### Step 4: Install Dependencies

```bash
pnpm install
```

## Basic Usage

### Simple Worker Example

```typescript
// src/index.ts
import { createCloudflarePrisma } from '@ottabase/db/cloudflare';

export interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Create Prisma client with D1 adapter
    const { prisma } = createCloudflarePrisma({
      d1Database: env.DB,
      debug: true,
    });

    try {
      // Use Prisma as normal
      const users = await prisma.user.findMany({
        take: 10,
      });

      return new Response(JSON.stringify(users), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: String(error) }),
        { status: 500 }
      );
    }
  },
};
```

### CRUD Operations

```typescript
import { createCloudflarePrisma } from '@ottabase/db/cloudflare';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { prisma } = createCloudflarePrisma({
      d1Database: env.DB,
    });

    const url = new URL(request.url);
    const path = url.pathname;

    // CREATE
    if (path === '/users' && request.method === 'POST') {
      const data = await request.json();
      const user = await prisma.user.create({
        data: {
          email: data.email,
          name: data.name,
        },
      });
      return Response.json(user);
    }

    // READ
    if (path === '/users' && request.method === 'GET') {
      const users = await prisma.user.findMany();
      return Response.json(users);
    }

    // READ ONE
    if (path.startsWith('/users/') && request.method === 'GET') {
      const id = path.split('/')[2];
      const user = await prisma.user.findUnique({
        where: { id },
      });
      return Response.json(user);
    }

    // UPDATE
    if (path.startsWith('/users/') && request.method === 'PUT') {
      const id = path.split('/')[2];
      const data = await request.json();
      const user = await prisma.user.update({
        where: { id },
        data: {
          name: data.name,
          email: data.email,
        },
      });
      return Response.json(user);
    }

    // DELETE
    if (path.startsWith('/users/') && request.method === 'DELETE') {
      const id = path.split('/')[2];
      await prisma.user.delete({
        where: { id },
      });
      return Response.json({ success: true });
    }

    return new Response('Not Found', { status: 404 });
  },
};
```

## Advanced Patterns

### Pattern 1: Singleton Pattern

Use a singleton for better performance across requests:

```typescript
import { createCloudflarePrismaSingleton } from '@ottabase/db/cloudflare';

declare global {
  var __cloudflare_prisma__: ReturnType<typeof createCloudflarePrisma> | undefined;
}

export interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Reuses the same Prisma instance across requests in dev
    const { prisma } = createCloudflarePrismaSingleton(() => ({
      d1Database: env.DB,
    }));

    const users = await prisma.user.findMany();
    return Response.json(users);
  },
};
```

### Pattern 2: Database + Cache Layer

Combine D1 with KV caching for optimal performance:

```typescript
import { createCloudflarePrisma } from '@ottabase/db/cloudflare';
import { createDataLayer } from '@ottabase/cf-data';

export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Initialize Prisma
    const { prisma } = createCloudflarePrisma({
      d1Database: env.DB,
    });

    // Initialize cache layer
    const dataLayer = createDataLayer({
      kv: env.CACHE,
      d1: env.DB,
      defaultCacheTtl: 3600, // 1 hour
    });

    const userId = new URL(request.url).searchParams.get('id');

    if (!userId) {
      return new Response('Missing user ID', { status: 400 });
    }

    // Try cache first, then database
    const cachedUser = await dataLayer.cache?.get(`user:${userId}`);
    if (cachedUser) {
      return Response.json({ user: cachedUser, cached: true });
    }

    // Fetch from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    // Store in cache
    if (user) {
      await dataLayer.cache?.put(`user:${userId}`, user, {
        ttl: 3600,
      });
    }

    return Response.json({ user, cached: false });
  },
};
```

### Pattern 3: Stale-While-Revalidate

Use SWR pattern for frequently accessed data:

```typescript
import { createCloudflarePrisma } from '@ottabase/db/cloudflare';
import { createDataLayer } from '@ottabase/cf-data';

export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { prisma } = createCloudflarePrisma({
      d1Database: env.DB,
    });

    const dataLayer = createDataLayer({
      kv: env.CACHE,
      d1: env.DB,
    });

    // Use SWR to serve stale data while revalidating in background
    const users = await dataLayer.cache?.getWithSWR(
      'users:recent',
      async () => {
        // This runs in background if data is stale
        return await prisma.user.findMany({
          take: 100,
          orderBy: { createdAt: 'desc' },
        });
      },
      { ttl: 300 } // 5 minutes
    );

    return Response.json(users);
  },
};
```

### Pattern 4: Direct D1 Operations

Access D1 directly when you need raw SQL:

```typescript
import { createCloudflarePrisma, createD1Database } from '@ottabase/db/cloudflare';

export interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { prisma, adapter } = createCloudflarePrisma({
      d1Database: env.DB,
    });

    // Use Prisma for complex queries
    const users = await prisma.user.findMany();

    // Use D1 adapter for raw SQL when needed
    const d1 = createD1Database(env.DB);
    const stats = await d1.query(
      `SELECT COUNT(*) as total,
              COUNT(CASE WHEN createdAt > datetime('now', '-7 days') THEN 1 END) as recent
       FROM User`
    );

    return Response.json({
      users,
      stats: stats.results[0],
    });
  },
};
```

### Pattern 5: Transaction Support

```typescript
import { createCloudflarePrisma } from '@ottabase/db/cloudflare';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { prisma } = createCloudflarePrisma({
      d1Database: env.DB,
    });

    try {
      // Use Prisma transactions
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: 'user@example.com',
            name: 'John Doe',
          },
        });

        const post = await tx.post.create({
          data: {
            title: 'First Post',
            content: 'Hello World',
            authorId: user.id,
          },
        });

        return { user, post };
      });

      return Response.json(result);
    } catch (error) {
      return Response.json(
        { error: 'Transaction failed' },
        { status: 500 }
      );
    }
  },
};
```

## Complete Examples

### Example 1: Blog API Worker

```typescript
// src/index.ts
import { createCloudflarePrisma } from '@ottabase/db/cloudflare';
import { createDataLayer } from '@ottabase/cf-data';

export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
}

interface BlogPost {
  id: string;
  title: string;
  content: string;
  published: boolean;
  authorId: string;
  createdAt: Date;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { prisma } = createCloudflarePrisma({
      d1Database: env.DB,
      debug: false,
    });

    const dataLayer = createDataLayer({
      kv: env.CACHE,
      d1: env.DB,
      defaultCacheTtl: 600, // 10 minutes
    });

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // GET /posts - List all published posts
      if (path === '/posts' && request.method === 'GET') {
        const posts = await dataLayer.cache?.getWithSWR(
          'posts:published',
          async () => {
            return await prisma.post.findMany({
              where: { published: true },
              orderBy: { createdAt: 'desc' },
              take: 50,
            });
          },
          { ttl: 300 } // 5 minutes
        );

        return Response.json(posts);
      }

      // GET /posts/:id - Get single post
      if (path.startsWith('/posts/') && request.method === 'GET') {
        const id = path.split('/')[2];

        const post = await dataLayer.cache?.getOrSet(
          `post:${id}`,
          async () => {
            return await prisma.post.findUnique({
              where: { id },
            });
          },
          { ttl: 600 } // 10 minutes
        );

        if (!post) {
          return Response.json({ error: 'Post not found' }, { status: 404 });
        }

        return Response.json(post);
      }

      // POST /posts - Create new post
      if (path === '/posts' && request.method === 'POST') {
        const data = await request.json<{
          title: string;
          content: string;
          authorId: string;
        }>();

        const post = await prisma.post.create({
          data: {
            title: data.title,
            content: data.content,
            authorId: data.authorId,
            published: false,
          },
        });

        // Invalidate cache
        await dataLayer.cache?.delete('posts:published');

        return Response.json(post, { status: 201 });
      }

      // PUT /posts/:id - Update post
      if (path.startsWith('/posts/') && request.method === 'PUT') {
        const id = path.split('/')[2];
        const data = await request.json<Partial<BlogPost>>();

        const post = await prisma.post.update({
          where: { id },
          data,
        });

        // Update cache
        await dataLayer.cache?.put(`post:${id}`, post, { ttl: 600 });
        await dataLayer.cache?.delete('posts:published');

        return Response.json(post);
      }

      // DELETE /posts/:id - Delete post
      if (path.startsWith('/posts/') && request.method === 'DELETE') {
        const id = path.split('/')[2];

        await prisma.post.delete({
          where: { id },
        });

        // Invalidate cache
        await dataLayer.cache?.delete(`post:${id}`);
        await dataLayer.cache?.delete('posts:published');

        return Response.json({ success: true });
      }

      return Response.json({ error: 'Not Found' }, { status: 404 });
    } catch (error) {
      console.error('Error:', error);
      return Response.json(
        { error: 'Internal Server Error', message: String(error) },
        { status: 500 }
      );
    }
  },
};
```

### Example 2: Authentication Worker

```typescript
// src/index.ts
import { createCloudflarePrisma } from '@ottabase/db/cloudflare';
import { createDataLayer } from '@ottabase/cf-data';

export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  JWT_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { prisma } = createCloudflarePrisma({
      d1Database: env.DB,
    });

    const dataLayer = createDataLayer({
      kv: env.CACHE,
      d1: env.DB,
    });

    const url = new URL(request.url);
    const path = url.pathname;

    // POST /auth/register
    if (path === '/auth/register' && request.method === 'POST') {
      const { email, name } = await request.json<{
        email: string;
        name: string;
      }>();

      // Check if user exists (using cache)
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return Response.json(
          { error: 'User already exists' },
          { status: 400 }
        );
      }

      // Create user
      const user = await prisma.user.create({
        data: { email, name },
      });

      // Cache user
      await dataLayer.cache?.put(`user:${user.id}`, user, {
        ttl: 3600,
      });

      return Response.json(user, { status: 201 });
    }

    // GET /auth/me
    if (path === '/auth/me' && request.method === 'GET') {
      const userId = request.headers.get('X-User-ID');

      if (!userId) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Try cache first
      const user = await dataLayer.cache?.getOrSet(
        `user:${userId}`,
        async () => {
          return await prisma.user.findUnique({
            where: { id: userId },
          });
        },
        { ttl: 3600 }
      );

      if (!user) {
        return Response.json({ error: 'User not found' }, { status: 404 });
      }

      return Response.json(user);
    }

    return Response.json({ error: 'Not Found' }, { status: 404 });
  },
};
```

## API Reference

### createCloudflarePrisma()

Create a Prisma client with D1 adapter.

```typescript
function createCloudflarePrisma(
  config: CloudflarePrismaConfig
): CloudflarePrismaClient;

interface CloudflarePrismaConfig {
  d1Database: D1Database;
  debug?: boolean;
  prismaOptions?: ConstructorParameters<typeof PrismaClient>[0];
}

interface CloudflarePrismaClient {
  prisma: PrismaClient;
  adapter: PrismaD1Adapter;
}
```

### createCloudflarePrismaSingleton()

Create a singleton Prisma client.

```typescript
function createCloudflarePrismaSingleton(
  configFactory: () => CloudflarePrismaConfig
): CloudflarePrismaClient;
```

### disconnectCloudflarePrisma()

Safely disconnect Prisma client.

```typescript
function disconnectCloudflarePrisma(prisma: PrismaClient): Promise<void>;
```

### createD1Database()

Create a D1 database adapter for direct SQL access.

```typescript
import { createD1Database } from '@ottabase/db/cloudflare';

const db = createD1Database(env.DB);
const result = await db.query('SELECT * FROM User');
```

## Troubleshooting

### Issue: "driverAdapters" preview feature not enabled

**Error:**
```
Error: Prisma Client was generated without the `driverAdapters` preview feature
```

**Solution:**
Add to your `schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}
```

Then regenerate:
```bash
pnpm prisma generate
```

### Issue: D1 binding not found

**Error:**
```
Error: D1 database binding is required
```

**Solution:**
Ensure `wrangler.toml` has D1 binding:
```toml
[[d1_databases]]
binding = "DB"
database_name = "my-database"
database_id = "your-database-id"
```

### Issue: Module not found "@ottabase/cf-data"

**Solution:**
Install dependencies:
```bash
pnpm install
pnpm --filter @ottabase/db build
pnpm --filter @ottabase/cf-data build
```

### Issue: Type errors with D1Database

**Solution:**
Install Cloudflare types:
```bash
pnpm add -D @cloudflare/workers-types
```

Update `tsconfig.json`:
```json
{
  "compilerOptions": {
    "types": ["@cloudflare/workers-types"]
  }
}
```

## Best Practices

### 1. Use Caching Strategically

```typescript
// ✅ Good: Cache frequently accessed, rarely changing data
const config = await cache.getOrSet('app:config', fetchConfig, { ttl: 3600 });

// ❌ Bad: Caching highly dynamic data
const realtimeData = await cache.getOrSet('realtime', fetchData, { ttl: 1 });
```

### 2. Handle Errors Gracefully

```typescript
try {
  const users = await prisma.user.findMany();
  return Response.json(users);
} catch (error) {
  console.error('Database error:', error);
  return Response.json(
    { error: 'Failed to fetch users' },
    { status: 500 }
  );
}
```

### 3. Invalidate Cache on Writes

```typescript
// After creating/updating/deleting
await prisma.post.create({ data });
await cache.delete('posts:list');
await cache.delete(`post:${id}`);
```

### 4. Use Transactions for Related Operations

```typescript
await prisma.$transaction([
  prisma.user.create({ data: userData }),
  prisma.profile.create({ data: profileData }),
]);
```

### 5. Monitor Performance

```typescript
const { prisma } = createCloudflarePrisma({
  d1Database: env.DB,
  debug: true, // Enable in development
  prismaOptions: {
    log: ['query', 'info', 'warn', 'error'],
  },
});
```

### 6. Use Singleton in Production

```typescript
// Reuse Prisma instance across requests
const { prisma } = createCloudflarePrismaSingleton(() => ({
  d1Database: env.DB,
}));
```

### 7. Optimize Database Queries

```typescript
// ✅ Good: Select only needed fields
const users = await prisma.user.findMany({
  select: {
    id: true,
    email: true,
    name: true,
  },
});

// ❌ Bad: Fetching all fields
const users = await prisma.user.findMany();
```

### 8. Set Appropriate Cache TTLs

```typescript
// Static data: Long TTL
await cache.put('countries', data, { ttl: 86400 }); // 24 hours

// Dynamic data: Short TTL
await cache.put('trending', data, { ttl: 300 }); // 5 minutes

// User-specific: Medium TTL
await cache.put(`user:${id}`, data, { ttl: 3600 }); // 1 hour
```

---

## Summary

The integration of `@ottabase/db` with `@ottabase/cf-data` provides a powerful, production-ready solution for running Prisma on Cloudflare Workers. Key benefits:

✅ **Type-safe** - Full TypeScript support
✅ **Edge-optimized** - Low latency database operations
✅ **Caching built-in** - Multi-level caching strategies
✅ **Production-ready** - Error handling and monitoring
✅ **Flexible** - Use Prisma, raw SQL, or both

For more information:
- [@ottabase/db README](./packages/db/README.md)
- [@ottabase/cf-data README](./packages/cf-data/README.md)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Prisma Documentation](https://www.prisma.io/docs/)
