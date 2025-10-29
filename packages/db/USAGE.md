# @ottabase/db Usage Guide

The `@ottabase/db` package supports **two distinct use cases**:

1. **Standalone Mode** - For Node.js applications (Next.js, Express, etc.)
2. **Cloudflare Mode** - For Cloudflare Workers with D1 database

## Standalone Mode (Node.js Apps)

### Setup

1. **Install dependencies** in your app:
   ```bash
   pnpm add @ottabase/db @prisma/client
   ```

2. **Configure your Prisma schema** (`prisma/schema.prisma`):
   ```prisma
   generator client {
     provider = "prisma-client-js"
   }

   datasource db {
     provider = "postgresql"  // or mysql, sqlite, etc.
     url      = env("DATABASE_URL")
   }

   model User {
     id    String @id @default(cuid())
     email String @unique
     name  String?
   }
   ```

3. **Generate Prisma client**:
   ```bash
   pnpm prisma generate
   ```

4. **Set environment variable** (`.env`):
   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/mydb"
   ```

### Usage

```typescript
import { prisma } from '@ottabase/db';

// The global singleton Prisma client is ready to use
export async function getUsers() {
  return await prisma.user.findMany();
}

export async function createUser(email: string, name: string) {
  return await prisma.user.create({
    data: { email, name }
  });
}
```

### Benefits of Standalone Mode

- ✅ **Global singleton** prevents multiple Prisma instances in development
- ✅ **Hot reload safe** - persists across Next.js hot reloads
- ✅ **Type-safe** - full TypeScript support with generated types
- ✅ **Monorepo ready** - share database client across packages

### Complete Example (Next.js API Route)

```typescript
// app/api/users/route.ts
import { prisma } from '@ottabase/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { email, name } = await request.json();

    const user = await prisma.user.create({
      data: { email, name },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
```

## Cloudflare Mode (Workers with D1)

### Setup

1. **Install dependencies** in your Worker project:
   ```bash
   pnpm add @ottabase/db @ottabase/cf-data @prisma/client @cloudflare/workers-types
   ```

2. **Configure your Prisma schema** (`prisma/schema.prisma`):
   ```prisma
   generator client {
     provider = "prisma-client-js"
     previewFeatures = ["driverAdapters"]  // Required for D1!
   }

   datasource db {
     provider = "sqlite"  // D1 uses SQLite
     url      = env("DATABASE_URL")
   }

   model User {
     id    String @id @default(cuid())
     email String @unique
     name  String?
   }
   ```

3. **Generate Prisma client**:
   ```bash
   DATABASE_URL="file:./dev.db" pnpm prisma generate
   ```

4. **Configure Wrangler** (`wrangler.toml`):
   ```toml
   name = "my-worker"
   main = "src/index.ts"
   compatibility_date = "2024-01-01"

   [[d1_databases]]
   binding = "DB"
   database_name = "my-database"
   database_id = "your-database-id"
   ```

5. **Initialize D1 schema**:
   ```bash
   # Generate SQL from Prisma schema
   pnpm prisma migrate diff \
     --from-empty \
     --to-schema-datamodel prisma/schema.prisma \
     --script > schema.sql

   # Apply to D1 (local)
   wrangler d1 execute my-database --local --file=schema.sql

   # Apply to D1 (production)
   wrangler d1 execute my-database --remote --file=schema.sql
   ```

### Usage

```typescript
import { PrismaClient } from '@prisma/client';
import { createCloudflarePrisma } from '@ottabase/db/cloudflare';

export interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Create Prisma client with D1 adapter
    const { prisma } = createCloudflarePrisma(PrismaClient, {
      d1Database: env.DB,
      debug: false,
    });

    // Use Prisma as normal!
    const users = await prisma.user.findMany();

    return new Response(JSON.stringify(users), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
```

### Singleton Pattern (Recommended)

For better performance, use the singleton pattern:

```typescript
import { PrismaClient } from '@prisma/client';
import { createCloudflarePrismaSingleton } from '@ottabase/db/cloudflare';

export interface Env {
  DB: D1Database;
}

declare global {
  var __cloudflare_prisma__: ReturnType<typeof createCloudflarePrisma> | undefined;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Reuses same instance across requests in development
    const { prisma } = createCloudflarePrismaSingleton(
      PrismaClient,
      () => ({
        d1Database: env.DB,
      })
    );

    const users = await prisma.user.findMany();
    return Response.json(users);
  },
};
```

### Complete Example (CRUD API)

```typescript
import { PrismaClient } from '@prisma/client';
import { createCloudflarePrisma } from '@ottabase/db/cloudflare';
import { createDataLayer } from '@ottabase/cf-data';

export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { prisma } = createCloudflarePrisma(PrismaClient, {
      d1Database: env.DB,
    });

    // Optional: Add caching layer
    const dataLayer = createDataLayer({
      kv: env.CACHE,
      d1: env.DB,
      defaultCacheTtl: 3600,
    });

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // GET /users
      if (path === '/users' && request.method === 'GET') {
        const users = await dataLayer.cache?.getOrSet(
          'users:all',
          async () => await prisma.user.findMany(),
          { ttl: 300 }
        );
        return Response.json(users);
      }

      // GET /users/:id
      if (path.startsWith('/users/') && request.method === 'GET') {
        const id = path.split('/')[2];
        const user = await prisma.user.findUnique({
          where: { id },
        });
        return user
          ? Response.json(user)
          : Response.json({ error: 'Not found' }, { status: 404 });
      }

      // POST /users
      if (path === '/users' && request.method === 'POST') {
        const data = await request.json();
        const user = await prisma.user.create({
          data: {
            email: data.email,
            name: data.name,
          },
        });

        // Invalidate cache
        await dataLayer.cache?.delete('users:all');

        return Response.json(user, { status: 201 });
      }

      // PUT /users/:id
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

        // Invalidate cache
        await dataLayer.cache?.delete('users:all');

        return Response.json(user);
      }

      // DELETE /users/:id
      if (path.startsWith('/users/') && request.method === 'DELETE') {
        const id = path.split('/')[2];
        await prisma.user.delete({
          where: { id },
        });

        // Invalidate cache
        await dataLayer.cache?.delete('users:all');

        return Response.json({ success: true });
      }

      return Response.json({ error: 'Not found' }, { status: 404 });
    } catch (error) {
      console.error('Error:', error);
      return Response.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  },
};
```

## Comparison Table

| Feature | Standalone Mode | Cloudflare Mode |
|---------|----------------|-----------------|
| **Runtime** | Node.js | Cloudflare Workers |
| **Database** | PostgreSQL, MySQL, SQLite, etc. | D1 (SQLite) |
| **Import** | `from '@ottabase/db'` | `from '@ottabase/db/cloudflare'` |
| **Setup** | Direct Prisma | Prisma + D1 Adapter |
| **Caching** | External (Redis, etc.) | Built-in (KV + Memory) |
| **Singleton** | Automatic | Manual with helper |
| **Preview Features** | None required | `driverAdapters` required |

## Switching Between Modes

You can use the same Prisma schema for both modes with slight adjustments:

### Shared Schema Approach

Use environment variables to switch providers:

```prisma
generator client {
  provider = "prisma-client-js"
  previewFeatures = ["driverAdapters"]  // Safe to include always
}

datasource db {
  provider = env("DB_PROVIDER")  // "postgresql" or "sqlite"
  url      = env("DATABASE_URL")
}
```

Then set different environment variables per environment:

**.env (Local Node.js)**
```
DB_PROVIDER="postgresql"
DATABASE_URL="postgresql://user:password@localhost:5432/mydb"
```

**.env (Cloudflare)**
```
DB_PROVIDER="sqlite"
DATABASE_URL="file:./dev.db"  // Only for Prisma generation
```

## Additional Resources

- **Cloudflare Integration Guide**: See `PACKAGES_CF_DB.MD` for detailed Cloudflare examples
- **Prisma Documentation**: https://www.prisma.io/docs/
- **Cloudflare D1 Docs**: https://developers.cloudflare.com/d1/
- **@ottabase/cf-data README**: `packages/cf-data/README.md`

## Troubleshooting

### Standalone Mode Issues

**Problem**: Multiple Prisma instances in development
- **Solution**: Use `prisma` from `@ottabase/db` instead of creating new instances

**Problem**: Type errors with PrismaClient
- **Solution**: Run `pnpm prisma generate` to generate types

### Cloudflare Mode Issues

**Problem**: "driverAdapters" preview feature not enabled
- **Solution**: Add `previewFeatures = ["driverAdapters"]` to `generator client`

**Problem**: D1 binding not found
- **Solution**: Check `wrangler.toml` has correct D1 binding configuration

**Problem**: Module resolution errors
- **Solution**: Ensure @cloudflare/workers-types is installed

## Summary

The `@ottabase/db` package is designed to work seamlessly in both environments:

✅ **Standalone**: Traditional Node.js apps with any SQL database
✅ **Cloudflare**: Edge Workers with D1 + caching capabilities
✅ **Type-safe**: Full TypeScript support in both modes
✅ **Production-ready**: Battle-tested patterns and error handling

Choose the mode that fits your deployment target and enjoy type-safe database operations!
