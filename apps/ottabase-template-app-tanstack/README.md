# Ottabase Template App (TanStack)

TanStack Router + Query template with automated OttaORM migrations and Cloudflare Workers deployment.

## Features

- **TanStack Router** - Type-safe routing with file-based structure
- **TanStack Query** - Powerful async state management
- **OttaORM** - Fat models with automated migrations
- **Vite** - Fast development server and optimized builds
- **Cloudflare Workers** - D1, KV, R2, Queues, Rate Limiting, Durable Objects
- **Mantine + shadcn/ui** - Flexible UI component libraries
- **Jotai** - Global state management

## Quick Start

```bash
# Install
pnpm install

# Start Vite dev server (fast)
pnpm dev

# OR start with Cloudflare Workers (full features)
pnpm dev:worker

# Initialize database (creates all tables automatically)
curl -X POST http://localhost:8790/api/ottaorm/init

# Done! Visit http://localhost:8790
```

## Database Setup

### Automated Migrations

**Zero-config!** Just define Models and call `/api/ottaorm/init`:

#### 1. Define Model
```typescript
// ottabase/models/Todo.ts
export const todosTable = sqliteTable("todos", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
});

export class Todo extends BaseModel {
  static entity = "todos";
  static table = todosTable;
}
```

#### 2. Export in Schema
```typescript
// ottabase/db/schema.ts
export { todosTable } from "../models/Todo";
```

#### 3. Initialize
```bash
curl -X POST http://localhost:8790/api/ottaorm/init
# ✅ Table created automatically!
```

See [ottabase/migrations/README.md](./ottabase/migrations/README.md) for details.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Vite dev server (fast local DX) |
| `pnpm dev:worker` | Wrangler dev with Cloudflare bindings |
| `pnpm build` | Build for production |
| `pnpm preview` | Build + run on `workerd` via Wrangler (Cloudflare-like) |
| `pnpm deploy` | Build + deploy Worker + assets to Cloudflare |
| `pnpm type-check` | TypeScript type checking |
| `pnpm cf-typegen` | Generate Cloudflare types from wrangler.jsonc |

## Directory Structure

```
apps/ottabase-template-app-tanstack/
├── cloudflare-worker.ts    # Cloudflare Worker entry (API routes)
├── ottabase/               # Server-side code
│   ├── migrations/         # Database migrations
│   ├── models/             # OttaORM models (Todo, etc.)
│   └── db/schema.ts        # Drizzle table schemas
├── src/                    # React application
│   ├── main.tsx           # App entry point
│   ├── router.tsx         # TanStack Router configuration
│   ├── ottabase/          # Client-side config
│   │   ├── config/        # App configuration
│   │   ├── hooks/         # Custom hooks
│   │   ├── providers/     # React providers
│   │   └── state/         # Jotai atoms
│   ├── pages/             # Page components
│   │   └── demo/          # Demo pages
│   └── providers/         # App providers wrapper
├── index.html             # HTML template
├── vite.config.ts         # Vite configuration
├── wrangler.jsonc         # Cloudflare Workers config
└── tailwind.config.cjs    # Tailwind CSS config
```

## Routes

### Pages
- `/` - Home page
- `/demo` - Demo gallery index
- `/demo/mantine` - Mantine UI components demo
- `/demo/shadcn` - shadcn/ui components demo
- `/demo/ottaeditor` - Rich text editor demo
- `/demo/ottaorm` - OttaORM (User/Post CRUD) demo
- `/demo/timezone` - Timezone utilities demo
- `/demo/cloudflare` - Cloudflare services index
- `/demo/cloudflare/d1` - D1 SQLite database demo
- `/demo/cloudflare/kv` - KV namespace demo
- `/demo/cloudflare/r2` - R2 object storage demo
- `/demo/cloudflare/queues` - Queues demo
- `/demo/cloudflare/rate-limiting` - Rate limiting demo
- `/demo/cloudflare/realtime` - Durable Objects realtime demo

### API Endpoints
- `/api/health` - Worker health check
- `/api/cloudflare/*` - Cloudflare service demos
- `/api/ottaorm/*` - OttaORM CRUD endpoints

## Using Cloudflare Bindings

### In Cloudflare Worker

```typescript
// cloudflare-worker.ts
export default {
  async fetch(request: Request, env: CloudflareEnv) {
    const db = createD1Client({ database: env.OBCF_D1 });
    const kv = createKVClient({ namespace: env.OBCF_KV });

    // Use D1
    const users = await db.query('SELECT * FROM users');

    // Use KV
    await kv.put('key', 'value', { expirationTtl: 60 });

    return Response.json({ users });
  }
}
```

### With OttaORM

```typescript
import { setDriver } from '@ottabase/ottaorm';
import { Todo } from './ottabase/models/Todo';

// In worker
const driver = createD1Driver(env.OBCF_D1);
setDriver(driver);

const todos = await Todo.all();
```

## Cloudflare Setup

### Local Development

```bash
# No Cloudflare account needed!
# Local D1/KV/R2 stored in .wrangler/state/v3/
pnpm dev:worker
```

### Production Deployment

#### 1. Create Cloudflare Resources

```bash
# Login
pnpm wrangler login

# Create D1 database
pnpm wrangler d1 create ottabase-db

# Create KV namespace
pnpm wrangler kv:namespace create OTTABASE_KV

# Create R2 bucket
pnpm wrangler r2 bucket create ottabase-bucket

# Create Queue
pnpm wrangler queues create ottabase-queue
```

#### 2. Update wrangler.jsonc

Update the IDs in `wrangler.jsonc` with your actual:
- D1 database ID
- KV namespace ID
- R2 bucket name
- Queue name

#### 3. Deploy

```bash
# Deploy to Cloudflare Workers
pnpm deploy

# Run migrations
curl -X POST https://your-app.workers.dev/api/ottaorm/init \
  -H "Authorization: Bearer ${MIGRATION_SECRET}"
```

## Deleting Demo Content

In production apps, you can safely delete:
- `src/pages/demo/` - All demo pages
- Related routes in `src/router.tsx`
- Demo API handlers in `cloudflare-worker.ts`

## Documentation

- [OttaORM Package](../../packages/ottaorm/README.md) - Full ORM documentation
- [Migrations Guide](./ottabase/migrations/README.md) - Database migrations
- [Cloudflare Deploy](../../CLOUDFLARE_DEPLOY.md) - Deployment guide
- [Cloudflare Config](../../CLOUDFLARE_CONFIGURATION_GUIDE.md) - Bindings setup
