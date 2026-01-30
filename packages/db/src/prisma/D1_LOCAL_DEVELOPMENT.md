# Cloudflare D1 Local Development Guide

This guide covers everything you need to know about working with Cloudflare D1 in local development with Ottabase.

## Overview

Ottabase's D1 integration works seamlessly in local development **without requiring a Cloudflare account**. All D1
operations use local SQLite databases managed by Wrangler.

## Table of Contents

- [Quick Start](#quick-start)
- [How Local D1 Works](#how-local-d1-works)
- [Schema Management](#schema-management)
- [Running Migrations](#running-migrations)
- [Querying Data](#querying-data)
- [Inspecting Your Database](#inspecting-your-database)
- [Common Tasks](#common-tasks)
- [Troubleshooting](#troubleshooting)

## Quick Start

### 1. Set Up Your App Schema

Edit your app-specific schema file:

```prisma
// apps/your-app/ottabase/prisma/app.schema.prisma

model Todo {
  id        Int      @id @default(autoincrement())
  title     String
  completed Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([createdAt])
}
```

### 2. Generate the Full Schema

```bash
cd apps/your-app
pnpm db:generate
```

This concatenates base schemas + feature schemas + your app schema into `prisma/schema.prisma`.

### 3. Create a Migration

```bash
pnpm db:migrate --name=init --apply=local
```

This will:

- Generate a Prisma migration
- Apply it to your local D1 database

### 4. Use Prisma in Your Code

```typescript
// app/api/todos/route.ts
import { createPrismaD1Client } from '@ottabase/cf/d1-prisma';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { PrismaClient } from '@prisma/client';

export const runtime = 'edge';

export async function GET() {
    const { env } = await getCloudflareContext();
    const prisma = createPrismaD1Client<PrismaClient>(env.OBCF_D1);

    const todos = await prisma.todo.findMany({
        orderBy: { createdAt: 'desc' },
    });

    return Response.json({ todos });
}
```

## How Local D1 Works

### Storage Location

Local D1 databases are stored in:

```
apps/your-app/.wrangler/state/v3/d1/
```

**Important**: This directory is git-ignored and auto-managed by Wrangler.

### Database Binding

Your `wrangler.jsonc` configures the D1 binding:

```jsonc
{
  "d1_databases": [
    {
      "binding: "OBCF_D1",                      // Accessible as env.OBCF_D1
      "database_name": "ottabase-db",       // Name for CLI commands
      "database_id": "YOUR_D1_DATABASE_ID"  // Not needed for local dev
    }
  ]
}
```

### Local vs Remote

| Feature                 | Local (`--local`)        | Remote (production)       |
| ----------------------- | ------------------------ | ------------------------- |
| **Storage**             | `.wrangler/state/v3/d1/` | Cloudflare's global D1    |
| **Requires CF Account** | No                       | Yes                       |
| **Replication**         | Single SQLite file       | Global read replicas      |
| **Persistence**         | File on disk             | Cloudflare infrastructure |

## Schema Management

### Workflow

```bash
# 1. Edit schemas
vim apps/your-app/ottabase/prisma/app.schema.prisma

# 2. Generate full schema (auto-runs on dev/build)
pnpm db:generate

# 3. Create migration
pnpm db:migrate --name=add_users

# 4. Apply to local D1
pnpm db:migrate --apply=local

# Or combine steps 3-4 interactively
pnpm db:migrate --name=add_users
# (Choose "Local" when prompted)
```

### Auto-Generation

Schema generation runs automatically:

```json
{
    "scripts": {
        "predev": "pnpm db:generate", // Before dev server
        "prebuild": "pnpm db:generate" // Before production build
    }
}
```

## Running Migrations

### Using Ottabase CLI (Recommended)

```bash
# Interactive mode (prompts for local/remote)
pnpm db:migrate --name=add_users

# Auto-apply to local
pnpm db:migrate --name=add_users --apply=local

# Auto-apply to remote (production)
pnpm db:migrate --name=add_users --apply=remote

# Dry run (preview SQL only)
pnpm db:migrate --name=add_users --dry-run
```

### Using Wrangler Directly

```bash
# Apply a specific migration
wrangler d1 execute DB --local --file=prisma/migrations/20241206_add_users/migration.sql

# Apply all pending migrations
wrangler d1 migrations apply DB --local

# Check migration status
wrangler d1 migrations list DB --local
```

## Querying Data

### Using Prisma (Type-Safe, Recommended)

```typescript
import { createPrismaD1Client } from '@ottabase/cf/d1-prisma';
import type { PrismaClient } from '@prisma/client';

const prisma = createPrismaD1Client<PrismaClient>(env.OBCF_D1);

// Create
const user = await prisma.user.create({
    data: { email: 'test@example.com', name: 'Test User' },
});

// Read
const users = await prisma.user.findMany({
    where: { email: { contains: '@example.com' } },
});

// Update
await prisma.user.update({
    where: { id: user.id },
    data: { name: 'Updated Name' },
});

// Delete
await prisma.user.delete({ where: { id: user.id } });
```

### Using Raw D1 Client (For Custom SQL)

```typescript
import { createD1Client } from '@ottabase/cf/d1';

const db = createD1Client({ database: env.OBCF_D1 });

// Query
const result = await db.query('SELECT * FROM users WHERE email = ?', ['test@example.com']);

// Execute
await db.execute('UPDATE users SET name = ? WHERE id = ?', ['New Name', 1]);
```

## Inspecting Your Database

### View Schema

```bash
wrangler d1 execute DB --local --command=".schema"
```

### View All Tables

```bash
wrangler d1 execute DB --local --command="SELECT name FROM sqlite_master WHERE type='table'"
```

### Query Data

```bash
# All users
wrangler d1 execute DB --local --command="SELECT * FROM users"

# Count records
wrangler d1 execute DB --local --command="SELECT COUNT(*) FROM todos"

# Check table structure
wrangler d1 execute DB --local --command="PRAGMA table_info(todos)"
```

### Export Data

```bash
# Dump entire database to SQL
cd .wrangler/state/v3/d1/
sqlite3 miniflare-D1DatabaseObject/*.sqlite .dump > backup.sql
```

## Common Tasks

### Reset Local Database

```bash
# Delete local D1 storage
rm -rf .wrangler/state/v3/d1/

# Re-run migrations
pnpm db:migrate --apply=local
```

### Seed Data

Create a seed script:

```typescript
// prisma/seed.ts
import { createPrismaD1Client } from '@ottabase/cf/d1-prisma';

async function seed() {
    // In local dev, you'll need to provide a D1 binding
    // This is easier to run via a Worker endpoint
    console.log('Use POST /api/db/seed endpoint instead');
}
```

Better approach - seed via API route:

```typescript
// app/api/db/seed/route.ts
export async function POST() {
    const { env } = await getCloudflareContext();
    const prisma = createPrismaD1Client(env.OBCF_D1);

    await prisma.user.createMany({
        data: [
            { email: 'alice@example.com', name: 'Alice' },
            { email: 'bob@example.com', name: 'Bob' },
        ],
    });

    return Response.json({ success: true });
}
```

### Copy Data Between Environments

```bash
# Export from local
wrangler d1 export DB --local --output=local-backup.sql

# Import to remote
wrangler d1 execute DB --remote --file=local-backup.sql
```

## Troubleshooting

### "No such table" Error

**Cause**: Database hasn't been migrated yet.

**Solution**:

```bash
pnpm db:migrate --name=init --apply=local
```

### "DATABASE_URL environment variable not set"

**Cause**: Prisma CLI needs `DATABASE_URL` for migration generation.

**Solution**: Create `.env` file:

```bash
# .env
DATABASE_URL="file:./prisma/dev.db"
```

### "Prisma Client not generated"

**Cause**: Prisma Client wasn't generated after schema changes.

**Solution**:

```bash
pnpm db:generate
```

### Schema Changes Not Reflected

**Cause**: Stale Prisma Client.

**Solution**:

```bash
# Regenerate schema and Prisma Client
pnpm db:generate

# Or restart dev server (runs predev hook)
pnpm dev
```

### "Binary target not found" on Windows

**Cause**: Prisma Client was generated for a different platform.

**Solution**:

```bash
cd packages/db
pnpm prisma generate
```

### Local Database Corrupted

**Cause**: SQLite file corruption or migration conflicts.

**Solution**:

```bash
# Nuclear option: reset everything
rm -rf .wrangler/state/
rm -rf prisma/migrations/
pnpm db:migrate --name=init --apply=local
```

## Best Practices

### 1. Always Use Migrations

❌ **Don't** use raw `CREATE TABLE` in code:

```typescript
await db.execute('CREATE TABLE IF NOT EXISTS users (...)');
```

✅ **Do** use Prisma migrations:

```bash
pnpm db:migrate --name=create_users
```

### 2. Index Foreign Keys

```prisma
model Post {
  id       Int    @id @default(autoincrement())
  authorId String  // Foreign key

  author User @relation(fields: [authorId], references: [id])

  @@index([authorId])  // ✅ Add this for performance
}
```

### 3. Test Migrations Locally First

```bash
# 1. Test locally
pnpm db:migrate --name=add_column --apply=local
# Test your app...

# 2. If good, apply to preview
pnpm db:migrate --apply=remote  # with wrangler preview env

# 3. Finally, production
pnpm db:migrate --apply=remote  # with wrangler production env
```

### 4. Avoid Transactions (D1 Limitation)

⚠️ **D1 does not support transactions**:

```typescript
// This won't provide ACID guarantees!
await prisma.$transaction([
    prisma.user.create({ data: { email: 'test@example.com' } }),
    prisma.post.create({ data: { title: 'Test' } }),
]);
```

Instead, design for idempotency or use application-level compensating transactions.

### 5. Use Type-Safe Queries

✅ **Prisma (type-safe)**:

```typescript
const user = await prisma.user.findUnique({ where: { id: 1 } });
// TypeScript knows user.email exists
```

❌ **Raw SQL (not type-safe)**:

```typescript
const result = await db.query('SELECT * FROM users WHERE id = ?', [1]);
// TypeScript doesn't know result structure
```

## Additional Resources

- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Prisma D1 Adapter](https://www.prisma.io/docs/orm/overview/databases/cloudflare-d1)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/commands/)
- [Ottabase DB Package](../../packages/db/README.md)
- [D1 Prisma Integration](../../packages/cf/src/d1-prisma.ts)

## Support

For issues or questions:

- GitHub Issues: [ottabase/issues](https://github.com/yourusername/ottabase/issues)
- Discord: [Ottabase Community](#)
- Docs: [docs.ottabase.dev](#)
