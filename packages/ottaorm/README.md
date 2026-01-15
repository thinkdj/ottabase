# @ottabase/ottaorm

Drizzle-based ORM for Cloudflare D1 with automated migrations, fat model pattern, and Laravel Eloquent-like API.

## Features

- Fat model pattern (schema, validation, relationships in one class)
- Eloquent-like API (`Model.find()`, `Model.where()`, `Model.create()`)
- Automated migrations (auto-creates tables from models)
- Type-safe with Drizzle ORM
- Relationships (belongsTo, hasMany, hasOne, belongsToMany)
- Field metadata for UI generation
- Type casting (boolean, date, json)

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
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export class Todo extends BaseModel {
  static entity = "todos";
  static table = todosTable;
  static primaryKey = "id";

  static casts = {
    completed: 'boolean' as const,
    createdAt: 'date' as const,
    updatedAt: 'date' as const,
  };

  static async incomplete() {
    return this.where({ completed: false });
  }

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
// All tables created automatically!
```

### 4. Use Models

```typescript
import { Todo } from "./models/Todo";
import { setDriver } from "@ottabase/ottaorm";

// Set driver once
setDriver(createD1Driver(env.OBCF_D1));

// Use models
const todo = await Todo.create({ title: "Buy groceries" });
await todo.toggle();
const all = await Todo.all();
```

## CRUD Operations

```typescript
// Create
const todo = await Todo.create({ title: "Task 1" });
const todos = await Todo.createMany([{ title: "Task 2" }, { title: "Task 3" }]);

// Read
const todo = await Todo.find("todo-id");
const first = await Todo.first({ completed: false });
const all = await Todo.all();
const completed = await Todo.where({ completed: true });

// Update
todo.set('title', "Updated title");
await todo.save();
await Todo.update("todo-id", { completed: true });

// Delete
await todo.delete();
await Todo.destroy("todo-id");

// Pagination
const result = await Todo.paginate({ page: 1, perPage: 10 });
// { data: Todo[], meta: { total, page, perPage, totalPages } }
```

## Relationships

```typescript
// belongsTo (N:1)
export class Post extends BaseModel {
  async author(select?: string[]) {
    const { User } = await import("./User");
    return this.belongsTo(User, 'authorId', { select });
  }
}

// hasMany (1:N)
export class User extends BaseModel {
  async posts(options?: { select?: string[]; orderBy?: string; limit?: number }) {
    const { Post } = await import("./Post");
    return this.hasMany(Post, 'authorId', options);
  }
}

// hasOne (1:1)
export class User extends BaseModel {
  async profile() {
    const { Profile } = await import("./Profile");
    return this.hasOne(Profile, 'userId');
  }
}

// belongsToMany (N:M)
export class Post extends BaseModel {
  async tags() {
    const { Tag } = await import("./Tag");
    return this.belongsToMany(Tag, postTagsTable, {
      foreignKey: 'postId',
      otherKey: 'tagId',
    });
  }
}
```

## Automated Migrations

```bash
# Development
curl -X POST http://localhost:3000/api/ottaorm/init

# Production (requires MIGRATION_SECRET)
curl -X POST https://your-app.com/api/ottaorm/init \
  -H "Authorization: Bearer ${MIGRATION_SECRET}"
```

**What happens automatically:**
- Creates missing tables
- Adds new columns to existing tables
- Runs custom migrations
- Tracks all migrations

### Adding a New Field

```typescript
export const todosTable = sqliteTable("todos", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  priority: integer("priority").default(0).notNull(), // NEW!
});

// Call /api/ottaorm/init → Column added automatically
```

### Custom Migrations

```typescript
// ottabase/migrations/index.ts
export const appMigrations: Migration[] = [
  {
    name: "0000_seed_admin",
    up: async (db) => {
      await db.execute(`
        INSERT OR IGNORE INTO users (id, name, email, created_at, updated_at)
        VALUES ('admin-001', 'Admin', 'admin@example.com', ...)
      `);
    },
  },
];
```

## D1 Database Setup

### Local Development

```jsonc
// wrangler.jsonc
{
  "d1_databases": [
    {
      "binding": "OBCF_D1",
      "database_name": "your-app-db",
      "database_id": "local"
    }
  ]
}
```

```bash
pnpm dev
curl -X POST http://localhost:3000/api/ottaorm/init
```

### Production

```bash
# Create D1 database
wrangler d1 create your-app-db

# Update wrangler.jsonc with production database_id
# Deploy and run migrations
pnpm deploy
curl -X POST https://your-app.workers.dev/api/ottaorm/init \
  -H "Authorization: Bearer ${MIGRATION_SECRET}"
```

## Framework Integration

### Next.js with Cloudflare

```typescript
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { setDriver } from "@ottabase/ottaorm";
import { createD1Driver } from "@ottabase/db/drizzle-d1";

export async function GET() {
  const { env } = getCloudflareContext();
  setDriver(createD1Driver(env.OBCF_D1));

  const users = await User.all();
  return Response.json(users);
}
```

### Cloudflare Workers

```typescript
export default {
  async fetch(request: Request, env: Env) {
    const driver = createD1Driver(env.OBCF_D1);
    setDriver(driver);

    const users = await User.all();
    return Response.json(users);
  }
}
```

## Core Models

Available in `@ottabase/ottaorm`:
- **User** - Users with name, email, image
- **Account** - OAuth provider accounts
- **Post** - Blog posts with title, slug, content
- **Tag** - Tags with name and slug
- **Session** - User sessions
- **VerificationToken** - Email verification
- **Authenticator** - WebAuthn/Passkey credentials

## License

MIT
