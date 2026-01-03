# Ottabase TanStack Template App

TanStack Router + Query template with automated OttaORM migrations and Cloudflare Workers deployment.

## Features

- **TanStack Router** - Type-safe routing
- **TanStack Query** - Async state management
- **OttaORM** - Automated migrations, no CLI needed
- **Vite** - Fast dev server
- **Cloudflare Workers** - D1, KV, R2, Queues, Durable Objects
- **Mantine + shadcn/ui** - UI libraries

## Quick Start

```bash
# Install
pnpm install

# Initialize database (creates all tables automatically)
pnpm dev:worker &
curl -X POST http://localhost:8790/api/ottaorm/init

# Done! Tables created ✅
```

## Database Migrations

**Zero-config!** Just define Models and call `/api/ottaorm/init`:

### 1. Define Model
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

### 2. Export in Schema
```typescript
// ottabase/db/schema.ts
export { todosTable } from "../models/Todo";
```

### 3. Initialize
```bash
curl -X POST http://localhost:8790/api/ottaorm/init
# ✅ Table created automatically!
```

See [ottabase/migrations/README.md](./ottabase/migrations/README.md) for details.

## Development

```bash
pnpm dev              # Vite dev server (fast)
pnpm dev:worker       # Wrangler dev (with bindings)
pnpm preview          # Build + test locally
pnpm deploy           # Deploy to Cloudflare
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

## Project Structure

```
apps/ottabase-template-app-tanstack/
├── cloudflare-worker.ts       # Worker entry (API)
├── ottabase/
│   ├── models/Todo.ts         # App models
│   ├── db/schema.ts           # Core + app tables
│   └── migrations/
│       ├── index.ts           # Custom migrations
│       └── custom/            # Seeds, indexes
├── src/
│   ├── main.tsx               # React entry
│   ├── router.tsx             # Routes
│   └── pages/demo/            # Demo pages
└── wrangler.jsonc             # Cloudflare config
```

## Documentation

- [Migration Guide](../../MIGRATION_GUIDE.md) - Auto-migration details
- [Cloudflare Features](../../docs/cloudflare-features.md) - Setup guide
