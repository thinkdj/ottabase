# Schema Configuration Guide

Configure Prisma schemas and datasources for your Ottabase app.

## Quick Start

Edit [`prisma.config.js`](./prisma.config.js):

```javascript
module.exports = definePrismaConfig({
  coreSchemas: ["user", "post"],    // Select schemas
  datasource: "d1",                  // Default: Cloudflare D1
});
```

Run: `pnpm db:generate`

## Core Schemas

| Schema | Description |
|--------|-------------|
| `user` | User authentication |
| `post` | Blog/content management |

**Examples:**
```javascript
coreSchemas: ["user", "post"]  // Full stack app
coreSchemas: ["user"]          // Auth only
coreSchemas: []                // Custom models only
```

## Datasources

| Type | Description |
|------|-------------|
| `d1` (default) | Cloudflare D1 - serverless SQLite |
| `postgresql` | PostgreSQL |
| `mysql` | MySQL/MariaDB |
| `sqlite` | Local SQLite |
| `sqlserver` | SQL Server |
| `mongodb` | MongoDB |
| `cockroachdb` | CockroachDB |

### D1 Setup

```javascript
datasource: "d1"  // Default
```

`@prisma/adapter-d1` is included by default.

1. Generate schema: `pnpm db:generate`
2. Initialize in Worker:
```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';

export default {
  async fetch(request: Request, env: Env) {
    const adapter = new PrismaD1(env.DB);
    const prisma = new PrismaClient({ adapter });
    const users = await prisma.user.findMany();
    return new Response(JSON.stringify(users));
  }
};
```

**Notes:**
- Adapter included by default
- Automatic schema transformations (removes `@db.Text`)
- No transaction support
- [D1 Docs](https://www.prisma.io/docs/orm/overview/databases/cloudflare-d1)

## Custom Schemas

Add app-specific models in [`app.schema.prisma`](./app.schema.prisma):

```prisma
model MyCustomModel {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
}
```

## Automatic Transformations

| Datasource | Transformations |
|------------|-----------------|
| `d1`, `sqlite` | Removes `@db.Text` (incompatible with SQLite) |
| Others | No transformations |

Write PostgreSQL-optimized schemas; D1/SQLite transformations happen automatically.

## Commands

```bash
pnpm db:generate              # Generate schema + Prisma Client
pnpm prisma migrate dev       # Create + apply migration
pnpm prisma migrate deploy    # Production migration
pnpm prisma studio            # Open database GUI
```

## Adding Core Schemas

1. Create `[name].schema.prisma` in `packages/db/prisma/schemas/`
2. Update `CoreSchemaName` type in `packages/db/prisma/schemas/index.ts`
3. Use: `coreSchemas: ["user", "post", "yourschema"]`

## Troubleshooting

**Schema not found:** Check available schemas in `packages/db/prisma/schemas/`

**Client not updated:** Run `pnpm db:generate`

**Migration issues:** Check connection, review `prisma/migrations/`, or use `pnpm prisma migrate reset` (dev only)

## Resources

- [Prisma Docs](https://www.prisma.io/docs)
- [Core Schemas](../../../../../packages/db/prisma/schemas/README.md)
