# @ottabase/ottaorm

Laravel Eloquent-inspired ORM for Cloudflare D1 with **automated migrations**. Fat model pattern with all logic in one place.

## Features

- **Zero-Config Migrations** - Auto-creates tables from Models, no CLI needed
- **Fat Models** - All metadata, validation, relationships in model class
- **Eloquent-like API** - `Model.find()`, `Model.where()`, `Model.create()`
- **Type-Safe** - Full TypeScript support with Drizzle ORM
- **Relationships** - belongsTo, hasMany, hasOne, belongsToMany
- **Per-App Migrations** - Core models + app-specific models

## Installation

```bash
pnpm add @ottabase/ottaorm @ottabase/db drizzle-orm
```

## Quick Start

### 1. Define Your Model

```typescript
import { BaseModel } from "@ottabase/ottaorm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const todosTable = sqliteTable("todos", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  completed: integer("completed", { mode: "boolean" }).default(false).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export class Todo extends BaseModel {
  static entity = "todos";
  static table = todosTable;
  static primaryKey = "id";

  static casts = {
    completed: 'boolean' as const,
    createdAt: 'date' as const,
  };

  async toggle() {
    this.set('completed', !this.get('completed'));
    return this.save();
  }
}
```

### 2. Export in Schema

```typescript
// ottabase/db/schema.ts
export { usersTable, postsTable } from "@ottabase/ottaorm";  // Core tables
export { todosTable } from "../models/Todo";                  // Your tables
```

### 3. Initialize Database

```typescript
// app/api/ottaorm/init/route.ts
import { autoInit, collectTableSchemas } from "@ottabase/ottaorm";
import { createD1Driver } from "@ottabase/db/drizzle-d1";
import * as schema from "../../../../ottabase/db/schema";

const driver = createD1Driver(env.OBCF_D1);
const result = await autoInit({
  driver,
  schema: collectTableSchemas(schema),
});

// ✅ All tables created automatically!
```

### 4. Use Models

```typescript
import { Todo } from "./models/Todo";

const todo = await Todo.create({ title: "Buy groceries" });
await todo.toggle();
const all = await Todo.all();
```

## Automated Migrations

**No CLI commands needed!** Just call `/api/ottaorm/init`:

```bash
# Development (no auth)
curl -X POST http://localhost:3000/api/ottaorm/init

# Production (requires MIGRATION_SECRET)
curl -X POST https://your-app.com/api/ottaorm/init \
  -H "Authorization: Bearer ${MIGRATION_SECRET}"
```

**What happens automatically:**
- ✅ Creates tables that don't exist
- ✅ Adds new columns to existing tables
- ✅ Runs custom migrations (seeds, indexes)
- ✅ Tracks all migrations

### Adding a New Field

```typescript
export const todosTable = sqliteTable("todos", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  priority: integer("priority").default(0).notNull(), // NEW!
});

// Call /api/ottaorm/init → Column added automatically ✅
```

### Custom Migrations

```typescript
// ottabase/migrations/index.ts
export const appMigrations: Migration[] = [
  {
    name: "0000_seed_admin",
    up: async (db) => {
      await db.execute(`INSERT INTO users ...`);
    },
  },
];
```

## CRUD Operations

```typescript
// Create
const todo = await Todo.create({ title: "Task" });

// Read
const todo = await Todo.find("id");
const all = await Todo.all();
const active = await Todo.where({ completed: false });

// Update
todo.set('title', "Updated");
await todo.save();

// Delete
await todo.delete();
```

## Relationships

```typescript
// belongsTo (N:1)
export class Post extends BaseModel {
  async author() {
    const { User } = await import("./User");
    return this.belongsTo(User, 'authorId');
  }
}

// hasMany (1:N)
export class User extends BaseModel {
  async posts() {
    const { Post } = await import("./Post");
    return this.hasMany(Post, 'authorId');
  }
}

// Usage
const post = await Post.find("id");
const author = await post.author();
const posts = await user.posts({ orderBy: 'createdAt' });
```

## Core Models

Included core models (in `@ottabase/ottaorm`):
- **User** - Users with name, email, image
- **Account** - OAuth provider accounts
- **Session** - User sessions
- **Post** - Blog posts with author
- **Tag** - Tags with many-to-many posts

## Architecture

```
@ottabase/ottaorm (CORE)
├── User, Post, Tag, Account (Models)
└── Auto-migration system

Your App
├── ottabase/
│   ├── models/Todo.ts           # App-specific models
│   ├── db/schema.ts             # Core + app tables
│   └── migrations/index.ts      # Custom migrations
└── /api/ottaorm/init            # Auto-creates everything!
```

## Documentation

- **[Migration Guide](../../MIGRATION_GUIDE.md)** - Complete auto-migration guide
- **[Architecture](../../ARCHITECTURE.md)** - Core models + per-app structure

## License

MIT
