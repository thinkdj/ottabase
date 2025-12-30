# Database Schema (Codebase First Approach)

This application uses Drizzle's **Option 2: Codebase First** approach for database migrations.

## How It Works

1. **Schema is defined in TypeScript** (`ottabase/db/schema.ts`)
2. **drizzle-kit push** pushes schema changes directly to D1
3. **No SQL migration files** to manage
4. **TypeScript schema is the single source of truth**

## Schema Location

```
ottabase/
├── db/
│   └── schema.ts      # Combined schema (CORE + APP tables)
├── models/
│   └── Todo.ts        # App-specific model with Drizzle table
└── migrations/
    └── README.md      # This file
```

## Schema Structure

The schema file (`ottabase/db/schema.ts`) combines:

### Core Tables (from `@ottabase/ottaorm`)
- `usersTable` - User accounts
- `accountsTable` - OAuth accounts
- `sessionsTable` - User sessions
- `verificationTokensTable` - Email verification
- `authenticatorsTable` - WebAuthn/Passkey
- `postsTable` - Blog posts
- `tagsTable` - Tags
- `postTagsTable` - Post-tag relationships

### App Tables
- `todosTable` - Todo items (defined in `ottabase/models/Todo.ts`)

## Commands

```bash
# Push schema changes to remote D1 database
pnpm db:push

# Open Drizzle Studio for database browsing
pnpm db:studio
```

## Adding New Tables

1. Create a new model file in `ottabase/models/`:

```typescript
// ottabase/models/Project.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const projectsTable = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
```

2. Export it in the schema file (`ottabase/db/schema.ts`):

```typescript
// Add to APP-SPECIFIC TABLES section
export { projectsTable } from "../models/Project";
```

3. Push the changes:

```bash
pnpm db:push
```

## Environment Variables

For remote D1, set these environment variables:

```bash
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_D1_DATABASE_ID=your-database-id  
CLOUDFLARE_API_TOKEN=your-api-token
```

## Benefits

- ✅ **No migration files** - Schema TypeScript is the source of truth
- ✅ **Type-safe** - Full TypeScript support with Drizzle ORM
- ✅ **Automatic diff** - drizzle-kit detects schema changes
- ✅ **Rapid prototyping** - Just edit TypeScript and push
- ✅ **Production ready** - Used by many teams in production
