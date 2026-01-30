# Ottabase Template App (Next.js)

Next.js 15 template with automated OttaORM migrations and Cloudflare Workers deployment.

## Features

- **Next.js 15** with App Router
- **OttaORM** - Fat models with automated migrations
- **Cloudflare Workers** via OpenNext
- **TypeScript** + **Tailwind CSS**
- **@ottabase/cf** for D1, KV, R2, Queues, Rate Limiting
- **Demo Pages** for all Cloudflare features

## Quick Start

```bash
# Install
pnpm install

# Start dev server
pnpm dev

# Initialize database (creates all tables automatically)
curl -X POST http://localhost:3000/api/ottaorm/init

# Done! Visit http://localhost:3000
```

## Database Setup

### Automated Migrations

**Zero-config!** Just define Models and call `/api/ottaorm/init`:

#### 1. Define Model

```typescript
// ottabase/models/Todo.ts
export const todosTable = sqliteTable('todos', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
});

export class Todo extends BaseModel {
    static entity = 'todos';
    static table = todosTable;
}
```

#### 2. Export in Schema

```typescript
// ottabase/db/schema.ts
export { todosTable } from '../models/Todo';
```

#### 3. Initialize

```bash
curl -X POST http://localhost:3000/api/ottaorm/init
# ✅ Table created automatically!
```

See [ottabase/migrations/README.md](./ottabase/migrations/README.md) for details.

## Scripts

| Command           | Description                                    |
| ----------------- | ---------------------------------------------- |
| `pnpm dev`        | Start Next.js dev server (HMR)                 |
| `pnpm build`      | Build Next.js app for production               |
| `pnpm preview`    | Build + test with Cloudflare `workerd` runtime |
| `pnpm deploy`     | Build + deploy to Cloudflare Workers           |
| `pnpm type-check` | TypeScript type checking                       |
| `pnpm cf-typegen` | Generate Cloudflare types from wrangler.jsonc  |

## Project Structure

```
apps/ottabase-template-app/
├── app/
│   ├── api/
│   │   ├── ottaorm/init/       # Auto-migration endpoint
│   │   └── cloudflare/         # Cloudflare demos
│   └── demo/cloudflare/        # Feature demos
├── ottabase/
│   ├── models/Todo.ts          # App models
│   ├── db/schema.ts            # Core + app tables
│   └── migrations/
│       ├── index.ts            # Custom migrations
│       └── custom/             # Seeds, indexes
├── types/
│   └── cloudflare.d.ts         # Cloudflare env types
├── wrangler.jsonc              # Cloudflare config
└── open-next.config.ts         # OpenNext configuration
```

## Cloudflare Features

Demo pages at `/demo/cloudflare`:

- **D1 Database** - Auto-migrations + CRUD operations
- **KV Storage** - Key-value with TTL
- **R2 Storage** - Object storage for files
- **Images** - Image upload and transformation
- **Queues** - Async message processing
- **Rate Limiting** - Request throttling

## Using Cloudflare Bindings

### In Route Handlers

```typescript
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createD1Client } from '@ottabase/cf/d1';

export const runtime = 'edge';

export async function GET() {
    const { env } = await getCloudflareContext();
    const db = createD1Client({ database: env.OBCF_D1 });

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
  const kv = createKVClient({ namespace: env.OBCF_KV });

  const data = await kv.getJSON('key');
  return <div>{JSON.stringify(data)}</div>;
}
```

### With OttaORM

```typescript
import { setDriver } from '@ottabase/ottaorm';
import { Todo } from './ottabase/models/Todo';

export async function GET() {
    const { env } = await getCloudflareContext();
    setDriver(createD1Driver(env.OBCF_D1));

    const todos = await Todo.all();
    return Response.json({ todos });
}
```

## Cloudflare Setup

### Local Development

```bash
# No Cloudflare account needed!
# Local D1/KV/R2 stored in .wrangler/state/v3/
pnpm dev
```

### Production Deployment

#### 1. Create Cloudflare Resources

```bash
# Login to Cloudflare
pnpm wrangler login

# Create D1 database
pnpm wrangler d1 create ottabase-db

# Create KV namespace
pnpm wrangler kv:namespace create OTTABASE_KV
pnpm wrangler kv:namespace create OTTABASE_KV --preview

# Create R2 bucket
pnpm wrangler r2 bucket create ottabase-bucket

# Create Queue
pnpm wrangler queues create ottabase-queue
```

#### 2. Update wrangler.jsonc

```jsonc
{
    "d1_databases": [
        {
            "binding": "OBCF_D1",
            "database_id": "YOUR_DATABASE_ID", // From wrangler d1 create
        },
    ],
    "kv_namespaces": [
        {
            "binding": "OBCF_KV",
            "id": "YOUR_KV_ID", // From wrangler kv:namespace create
        },
    ],
    // ... etc
}
```

#### 3. Deploy

```bash
# Deploy to Cloudflare Workers
pnpm deploy

# Run migrations
curl -X POST https://your-app.workers.dev/api/ottaorm/init \
  -H "Authorization: Bearer ${MIGRATION_SECRET}"
```

## Environment Variables

Set in `wrangler.jsonc`:

```jsonc
"vars": {
  "ENVIRONMENT": "production",
  "MIGRATION_SECRET": "your-secret-here"
}
```

For secrets (tokens, API keys):

```bash
pnpm wrangler secret put SECRET_NAME
```

## Documentation

- [OttaORM Package](../../packages/ottaorm/README.md) - Full ORM documentation
- [Migrations Guide](./ottabase/migrations/README.md) - Database migrations
- [Cloudflare Deploy](../../CLOUDFLARE_DEPLOY.md) - Deployment guide
- [Cloudflare Config](../../CLOUDFLARE_CONFIGURATION_GUIDE.md) - Bindings setup
