# @ottabase/ottaorm

An ORM for Cloudflare D1 and SQLite. Fat model pattern with all logic in one place.

## Features

- **Fat Models** - All metadata, validation, relationships in model class
- **Eloquent-like API** - `Model.find()`, `Model.where()`, `Model.create()`
- **Automated Migrations** - Auto-creates tables from Models, no CLI needed
- **Type-Safe** - Full TypeScript support with Drizzle ORM
- **Relationships** - belongsTo, hasMany, hasOne, belongsToMany
- **Field Metadata** - UI config, validation, form/table config
- **Type Casting** - Automatic boolean, date, json conversion
- **Per-App Models** - Core models + app-specific models

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
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
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

  // Custom methods
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
export { shortlinksTable } from "@ottabase/shortlinks";       // Package tables
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
import { setDriver } from "@ottabase/ottaorm";

// Set driver once (in middleware or route)
setDriver(createD1Driver(env.OBCF_D1));

// Use models anywhere
const todo = await Todo.create({ title: "Buy groceries" });
await todo.toggle();
const all = await Todo.all();
```

## D1 Database Setup

### Local Development

Ottabase uses Cloudflare D1 (SQLite) for data storage. Local development works without a Cloudflare account.

#### 1. Configure D1 Binding

Add D1 binding to your `wrangler.jsonc`:

```jsonc
{
  "name": "your-app",
  "compatibility_date": "2024-01-01",
  "d1_databases": [
    {
      "binding": "OBCF_D1",              // Accessible as env.OBCF_D1
      "database_name": "your-app-db",
      "database_id": "local"             // Use "local" for dev
    }
  ]
}
```

#### 2. Local Database Location

Wrangler automatically creates a local SQLite database in:

```
.wrangler/state/v3/d1/
```

**Note**: This directory is auto-managed and git-ignored.

#### 3. Run Migrations

Initialize database via your API endpoint:

```bash
# Start dev server
pnpm dev

# Initialize database (creates all tables automatically)
curl -X POST http://localhost:3000/api/ottaorm/init
```

### Production Setup

#### 1. Create D1 Database

```bash
# Create production database
wrangler d1 create your-app-db

# Wrangler outputs:
# database_id = "abc123-def456-ghi789"
```

#### 2. Update wrangler.jsonc

Replace `database_id` with your production ID:

```jsonc
{
  "d1_databases": [
    {
      "binding": "OBCF_D1",
      "database_name": "your-app-db",
      "database_id": "abc123-def456-ghi789"  // ← Your production ID
    }
  ]
}
```

#### 3. Deploy & Run Migrations

```bash
# Deploy your app
pnpm deploy

# Run migrations via deployed API
curl -X POST https://your-app.workers.dev/api/ottaorm/init \
  -H "Authorization: Bearer ${MIGRATION_SECRET}"
```

### Environment Variables

No environment variables needed! D1 binding is configured via `wrangler.jsonc` and accessed as `env.OBCF_D1`.

#### Next.js on Cloudflare (using @opennextjs/cloudflare)

```typescript
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { setDriver } from "@ottabase/ottaorm";

export async function GET() {
  const { env } = getCloudflareContext();
  const driver = createD1Driver(env.OBCF_D1);
  setDriver(driver);

  const users = await User.all();
  return Response.json(users);
}
```

#### Cloudflare Workers

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

## Fat Model Pattern

Everything in one class - schema, validation, relationships, custom methods:

```typescript
import { BaseModel } from "@ottabase/ottaorm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// 1. Define table schema
export const todosTable = sqliteTable("todos", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  completed: integer("completed", { mode: "boolean" }).default(false).notNull(),
  userId: text("user_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// 2. Define model class
export class Todo extends BaseModel {
  static entity = "todos";
  static table = todosTable;
  static primaryKey = "id";

  // Type casting
  static casts = {
    completed: 'boolean' as const,
    createdAt: 'date' as const,
    updatedAt: 'date' as const,
  };

  // Default values
  protected static defaults = {
    completed: false,
  };

  // Field metadata (for UI generation)
  protected static fields = {
    title: {
      type: 'string',
      editable: true,
      searchable: true,
      sortable: true,
      uiConfig: {
        label: 'Title',
        placeholder: 'What needs to be done?',
      },
      validation: {
        rules: "required",
        messages: {
          required: "Title is required",
        }
      }
    },
    // ... more fields
  };

  // Relationships
  async user(select?: string[]) {
    const { User } = await import("@ottabase/ottaorm");
    return this.belongsTo(User, 'userId', { select });
  }

  // Custom methods
  static async incomplete() {
    return this.where({ completed: false });
  }

  async toggle() {
    this.set('completed', !this.get('completed'));
    return this.save();
  }
}
```

## CRUD Operations

### Creating Records

```typescript
// Create single record
const todo = await Todo.create({
  title: "Buy groceries",
  userId: "user-123"
});

// Create multiple records
const todos = await Todo.createMany([
  { title: "Task 1" },
  { title: "Task 2" }
]);
```

### Reading Records

```typescript
// Find by primary key
const todo = await Todo.find("todo-id");

// Find or throw error
const todo = await Todo.findOrFail("todo-id");

// First record matching conditions
const todo = await Todo.first({ completed: false });

// All records
const todos = await Todo.all();

// Where conditions
const todos = await Todo.where({ completed: true });

// With ordering
const todos = await Todo.where({ userId: "user-123" }, {
  orderBy: 'createdAt',
  orderDirection: 'desc'
});

// Pagination
const result = await Todo.paginate({
  page: 1,
  perPage: 10,
  orderBy: 'createdAt',
  orderDirection: 'desc'
});
// result = { data: Todo[], meta: { total, page, perPage, totalPages } }
```

### Updating Records

```typescript
// Update via instance
const todo = await Todo.find("todo-id");
todo.set('title', "Updated title");
await todo.save();

// Update multiple fields
todo.fill({ title: "New title", completed: true });
await todo.save();

// Static update
await Todo.update("todo-id", { completed: true });
```

### Deleting Records

```typescript
// Delete instance
const todo = await Todo.find("todo-id");
await todo.delete();

// Static delete
await Todo.destroy("todo-id");
```

## Relationships

### belongsTo (N:1)

```typescript
export class Post extends BaseModel {
  async author(select?: string[]) {
    const { User } = await import("./User");
    return this.belongsTo(User, 'authorId', { select });
  }
}

// Usage
const post = await Post.find("post-id");
const author = await post.author(['id', 'name', 'email']);
```

### hasMany (1:N)

```typescript
export class User extends BaseModel {
  async posts(options?: {
    select?: string[];
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    limit?: number;
  }) {
    const { Post } = await import("./Post");
    return this.hasMany(Post, 'authorId', options);
  }
}

// Usage
const user = await User.find("user-id");
const posts = await user.posts({
  select: ['id', 'title', 'createdAt'],
  orderBy: 'createdAt',
  orderDirection: 'desc',
  limit: 10
});
```

### hasOne (1:1)

```typescript
export class User extends BaseModel {
  async profile() {
    const { Profile } = await import("./Profile");
    return this.hasOne(Profile, 'userId');
  }
}

// Usage
const user = await User.find("user-id");
const profile = await user.profile();
```

### belongsToMany (N:M)

```typescript
export class Post extends BaseModel {
  async tags(options?: {
    select?: string[];
    orderBy?: string;
    withPivot?: string[];
  }) {
    const { Tag } = await import("./Tag");
    return this.belongsToMany(Tag, postTagsTable, {
      foreignKey: 'postId',
      otherKey: 'tagId',
      ...options
    });
  }
}

// Usage
const post = await Post.find("post-id");
const tags = await post.tags({
  select: ['id', 'name', 'slug'],
  withPivot: ['createdAt']
});
```

## Automated Migrations

**No CLI commands needed!** Just define Models and call `/api/ottaorm/init`:

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
      await db.execute(`
        INSERT OR IGNORE INTO users (id, name, email, created_at, updated_at)
        VALUES ('admin-001', 'Admin', 'admin@example.com', ...)
      `);
    },
  },
];
```

### Limitations

SQLite's `ALTER TABLE` has restrictions. The automated system **cannot**:

- ❌ **Change column types** - Use custom migration to recreate table
- ❌ **Rename columns** - Use custom migration to recreate table
- ❌ **Drop columns** - Use custom migration to recreate table
- ❌ **Modify constraints** - Use custom migration to recreate table
- ⚠️ **Add NOT NULL columns** - Must have `DEFAULT` value

**Example:**
```typescript
// ✅ GOOD - Has default value
status: text("status").default("active").notNull()

// ❌ BAD - No default, will fail if table has data
status: text("status").notNull()
```

For complex schema changes, use custom migrations. See [Migration READMEs](../../apps/ottabase-template-app/ottabase/migrations/README.md) for examples.

## Type Casting

Automatic type conversion:

```typescript
export class Todo extends BaseModel {
  static casts = {
    completed: 'boolean' as const,      // INTEGER -> boolean
    createdAt: 'date' as const,         // INTEGER -> Date
    updatedAt: 'date' as const,
    metadata: 'json' as const,          // TEXT -> object
    tags: 'array' as const,             // TEXT -> array
  };
}

const todo = await Todo.find("todo-id");
console.log(typeof todo.get('completed')); // "boolean"
console.log(todo.get('createdAt'));        // Date object
```

## Field Metadata

Define field metadata for UI generation:

```typescript
protected static fields = {
  title: {
    type: 'string',
    editable: true,
    searchable: true,
    sortable: true,
    uiConfig: {
      label: 'Title',
      description: 'Todo title',
      placeholder: 'What needs to be done?',
    },
    formConfig: {
      visible: true,
      fieldType: 'input',
    },
    tableConfig: {
      visible: true,
      colWidth: 'auto',
    },
    validation: {
      rules: "required",
      messages: {
        required: "Title is required",
      }
    }
  }
};

// Access field metadata
const fields = Todo.getFields();
console.log(fields.title.uiConfig.label); // "Title"
```

## Core Models

The package includes these core models (in `@ottabase/ottaorm`):

- **User** - Users with name, email, image
- **Account** - OAuth provider accounts (NextAuth)
- **Tag** - Tags with name and slug
- **Session** - User sessions
- **VerificationToken** - Email verification tokens
- **Authenticator** - WebAuthn/Passkey credentials

**Note:** The Post model has been moved to `@ottabase/ottablog` as a comprehensive blog/content management model with enhanced features.

## Architecture

```
@ottabase/ottaorm (CORE)
├── User, Tag, Account (Models)
├── Auto-migration system
└── Base model & utilities

@ottabase/ottablog (CONTENT)
├── Post, PostCategory, PostVersion, PostSeries (Models)
├── Tag system with type support
└── Content management utilities

Your App
├── ottabase/
│   ├── models/Todo.ts           # App-specific models
│   ├── db/schema.ts             # Core + blog + app tables
│   └── migrations/index.ts      # Custom migrations
└── /api/ottaorm/init            # Auto-creates everything!
```

**Core + Per-App Architecture:**
- Core models exported from `@ottabase/ottaorm` (User, Account, Tag, etc.)
- Blog/Content models exported from `@ottabase/ottablog` (Post, PostCategory, etc.)
- Each app defines its own models in `ottabase/models/`
- Schema combines core + blog + app tables
- Migrations run per-app against separate databases
- Type column on categories/tags enables multi-content-type support

## Complete Example: API Route

```typescript
// app/api/ottaorm/init/route.ts
import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createD1Driver } from "@ottabase/db/drizzle-d1";
import { autoInit, collectTableSchemas } from "@ottabase/ottaorm";
import * as schema from "../../../../ottabase/db/schema";
import { appMigrations } from "../../../../ottabase/migrations";

export const runtime = "edge";

export async function POST(request) {
  const { env } = getCloudflareContext();

  const driver = createD1Driver(env.OBCF_D1);
  const tables = collectTableSchemas(schema);

  const result = await autoInit({
    driver,
    schema: tables,
    customMigrations: appMigrations,
  });

  return NextResponse.json(result);
}
```

```typescript
// app/api/ottaorm/todos/route.ts
import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createD1Driver } from "@ottabase/db/drizzle-d1";
import { setDriver } from "@ottabase/ottaorm";
import { Todo } from "../../../../ottabase/models/Todo";

export const runtime = "edge";

export async function GET() {
  const { env } = getCloudflareContext();
  setDriver(createD1Driver(env.OBCF_D1));

  const todos = await Todo.all();
  return NextResponse.json({ todos: todos.map(t => t.toJson()) });
}

export async function POST(request: Request) {
  const { env } = getCloudflareContext();
  setDriver(createD1Driver(env.OBCF_D1));

  const body = await request.json();
  const todo = await Todo.create(body);

  return NextResponse.json({ todo: todo.toJson() });
}
```

## Benefits

- **Simple** - No complex configuration, just set driver and use models
- **Type-Safe** - Full TypeScript with IDE autocomplete
- **Self-Contained** - Each model has everything in one place
- **Automated** - Migrations run automatically from Model definitions
- **Extensible** - Easy to add custom methods and relationships
- **Familiar** - Laravel Eloquent-like API developers know
- **Cloudflare-First** - Built specifically for D1 and Edge runtime

## License

MIT
