# Ottabase Template App (Next.js)

Next.js 15 template with automated OttaORM migrations and Cloudflare Workers deployment.

## Features

- **Next.js 15** with App Router
- **OttaORM** - Automated migrations, no CLI needed
- **Cloudflare Workers** via OpenNext
- **TypeScript** + **Tailwind CSS**
- **@ottabase/cf** for D1, KV, R2, Queues

## Quick Start

```bash
# Install
pnpm install

# Initialize database (creates all tables automatically)
pnpm dev
curl -X POST http://localhost:3000/api/ottaorm/init

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
curl -X POST http://localhost:3000/api/ottaorm/init
# ✅ Table created automatically!
```

See [ottabase/migrations/README.md](./ottabase/migrations/README.md) for details.

## Development

```bash
pnpm dev              # Start dev server
pnpm preview          # Test with Cloudflare runtime
pnpm deploy           # Deploy to Cloudflare
```

## Project Structure

```
apps/ottabase-template-app/
├── app/
│   ├── api/ottaorm/init/route.ts   # Auto-migration endpoint
│   └── demo/cloudflare/            # Feature demos
├── ottabase/
│   ├── models/Todo.ts              # App models
│   ├── db/schema.ts                # Core + app tables
│   └── migrations/
│       ├── index.ts                # Custom migrations
│       └── custom/                 # Seeds, indexes
└── wrangler.jsonc                  # Cloudflare config
```

## Cloudflare Features

Demo pages at `/demo/cloudflare`:
- **D1 Database** - Auto-migrations + CRUD
- **KV Storage** - Key-value with TTL
- **R2 Storage** - Object storage
- **Queues** - Async processing
- **Rate Limiting** - Request throttling

## Documentation

- [OttaORM Package](../../packages/ottaorm/README.md) - Full ORM documentation
- [Migrations Guide](./ottabase/migrations/README.md) - Database migrations
- [Cloudflare Setup](../../CLOUDFLARE_DEPLOY.md) - Deployment guide
