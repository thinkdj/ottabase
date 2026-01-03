# OttaORM Architecture: Core Models + Per-App Models

## ✅ Yes, Everything is Intact!

### 1. Core Models Registry (Still Works!)

```
packages/ottaorm/
  ├── src/
  │   ├── models/               # CORE MODELS
  │   │   ├── User.ts           ✅ Core model
  │   │   ├── Post.ts           ✅ Core model
  │   │   ├── Tag.ts            ✅ Core model
  │   │   ├── Account.ts        ✅ Core model
  │   │   ├── Session.ts        ✅ Core model
  │   │   └── index.ts          → Exports all core models
  │   │
  │   ├── registry/             # MODEL REGISTRY
  │   │   └── index.ts          ✅ registerModels, getModel, etc.
  │   │
  │   ├── context/              # CONNECTION REGISTRY
  │   │   └── index.ts          ✅ registerConnection, getConnection
  │   │
  │   ├── migrations/           # MIGRATIONS (Both old & new!)
  │   │   ├── index.ts          ✅ coreMigrations (backward compat)
  │   │   ├── auto-init.ts      🆕 autoInit, collectTableSchemas
  │   │   └── runtime-generator.ts  🆕 Runtime schema detection
  │   │
  │   └── index.ts              # MAIN EXPORTS
  │       ├── Core models       ✅ User, Post, Tag, etc.
  │       ├── Registry          ✅ registerModels, registerConnection
  │       ├── Old migrations    ✅ runMigrations, coreMigrations
  │       └── New migrations    🆕 autoInit, collectTableSchemas
```

### 2. Per-App Models (Independent!)

#### TanStack App
```
apps/ottabase-template-app-tanstack/
  ├── ottabase/
  │   ├── models/
  │   │   └── Todo.ts           # App-specific model
  │   │
  │   ├── db/
  │   │   └── schema.ts         # Combines CORE + APP tables
  │   │       ├── Import: @ottabase/ottaorm  (usersTable, postsTable, etc.)
  │   │       └── Import: ../models/Todo     (todosTable)
  │   │
  │   └── migrations/
  │       ├── index.ts          # App-specific custom migrations
  │       └── custom/           # Custom SQL migrations (seeds, indexes)
  │
  └── cloudflare-worker.ts      # Uses TanStack's schema & migrations
      ├── import * as schema from "./ottabase/db/schema"
      ├── import { appMigrations } from "./ottabase/migrations"
      └── autoInit({ schema, customMigrations: appMigrations })
```

#### Next.js App
```
apps/ottabase-template-app/
  ├── ottabase/
  │   ├── models/
  │   │   └── Todo.ts           # App-specific model
  │   │
  │   ├── db/
  │   │   └── schema.ts         # Combines CORE + APP tables
  │   │       ├── Import: @ottabase/ottaorm  (usersTable, postsTable, etc.)
  │   │       └── Import: ../models/Todo     (todosTable)
  │   │
  │   └── migrations/
  │       ├── index.ts          # App-specific custom migrations
  │       └── custom/           # Custom SQL migrations (seeds, indexes)
  │
  └── app/api/ottaorm/init/route.ts  # Uses Next.js's schema & migrations
      ├── import * as schema from "../../../../ottabase/db/schema"
      ├── import { appMigrations } from "../../../../ottabase/migrations"
      └── autoInit({ schema, customMigrations: appMigrations })
```

## How It Works Together

### Core Models Flow
```typescript
// 1. Core models defined in package
packages/ottaorm/src/models/User.ts
  → export const usersTable = sqliteTable(...)
  → export class User extends BaseModel { ... }

// 2. Exported from @ottabase/ottaorm
packages/ottaorm/src/index.ts
  → export { User, usersTable } from "./models"

// 3. Imported in each app's schema
apps/*/ottabase/db/schema.ts
  → export { usersTable } from "@ottabase/ottaorm"

// 4. Auto-created when app calls /api/ottaorm/init
POST /api/ottaorm/init
  → collectTableSchemas(schema)
  → autoInit creates 'users' table ✅
```

### Per-App Models Flow
```typescript
// 1. App-specific model defined
apps/ottabase-template-app-tanstack/ottabase/models/Todo.ts
  → export const todosTable = sqliteTable(...)
  → export class Todo extends BaseModel { ... }

// 2. Exported in app's schema
apps/ottabase-template-app-tanstack/ottabase/db/schema.ts
  → export { todosTable } from "../models/Todo"

// 3. Auto-created when THIS app calls /api/ottaorm/init
POST /api/ottaorm/init (TanStack app)
  → collectTableSchemas(schema)  // Includes todosTable
  → autoInit creates 'todos' table ✅

// 4. Other apps don't get this table
POST /api/ottaorm/init (Next.js app)
  → Only creates tables in ITS schema
  → Can have different tables!
```

## Per-App Migrations (Separate DBs)

### TanStack App → D1 Database A
```typescript
// wrangler.jsonc
{
  "d1_databases": [{
    "binding": "OBCF_D1",
    "database_id": "tanstack-db-id"  // Database A
  }]
}

// cloudflare-worker.ts
const driver = createD1Driver(env.OBCF_D1);  // Points to Database A
const tables = collectTableSchemas(schema);   // TanStack's schema

await autoInit({
  driver,        // Database A
  schema: tables // Core + Todo + any other TanStack models
});
```

### Next.js App → D1 Database B
```typescript
// wrangler.jsonc
{
  "d1_databases": [{
    "binding": "OBCF_D1",
    "database_id": "nextjs-db-id"  // Database B (different!)
  }]
}

// route.ts
const driver = createD1Driver(env.OBCF_D1);  // Points to Database B
const tables = collectTableSchemas(schema);   // Next.js's schema

await autoInit({
  driver,        // Database B
  schema: tables // Core + Todo + any other Next.js models
});
```

## Example: Different Models Per App

### TanStack App: E-commerce
```typescript
// apps/ottabase-template-app-tanstack/ottabase/models/
├── Product.ts       // E-commerce specific
├── Order.ts         // E-commerce specific
└── Cart.ts          // E-commerce specific

// schema.ts
export { usersTable } from "@ottabase/ottaorm";  // Core
export { productsTable } from "../models/Product";  // App-specific
export { ordersTable } from "../models/Order";      // App-specific
export { cartsTable } from "../models/Cart";        // App-specific
```

### Next.js App: Blog
```typescript
// apps/ottabase-template-app/ottabase/models/
├── Article.ts       // Blog specific
├── Comment.ts       // Blog specific
└── Category.ts      // Blog specific

// schema.ts
export { usersTable, postsTable } from "@ottabase/ottaorm";  // Core
export { articlesTable } from "../models/Article";   // App-specific
export { commentsTable } from "../models/Comment";   // App-specific
export { categoriesTable } from "../models/Category"; // App-specific
```

### Result
```
Database A (TanStack):
  ✅ users (core)
  ✅ posts (core)
  ✅ products (app)
  ✅ orders (app)
  ✅ carts (app)

Database B (Next.js):
  ✅ users (core)
  ✅ posts (core)
  ✅ articles (app)
  ✅ comments (app)
  ✅ categories (app)
```

## Registry Still Works!

```typescript
// In TanStack worker
registerConnection("default", createD1Driver(env.OBCF_D1));
registerModels([User, Post, Tag, Todo, Product, Order]);

// Now you can use models dynamically
const crudRequest = await parseCrudRequest(request, url, "/api/ottaorm");
const result = await handleCrud(crudRequest);  // Uses registry!

// Or directly
const user = await User.find("123");  // Uses registered connection
const product = await Product.all();  // Uses registered connection
```

## Backward Compatibility

### Old System (Still Works!)
```typescript
import { runMigrations, coreMigrations } from "@ottabase/ottaorm";
import { appMigrations } from "./migrations";

await runMigrations(driver, [...coreMigrations, ...appMigrations]);
// ✅ Still works for manual migrations
```

### New System (Automated!)
```typescript
import { autoInit, collectTableSchemas } from "@ottabase/ottaorm";
import * as schema from "./db/schema";
import { appMigrations } from "./migrations";

await autoInit({
  driver,
  schema: collectTableSchemas(schema),
  customMigrations: appMigrations
});
// 🆕 Auto-creates tables from Models!
```

## Summary

✅ **Core Models**: Still intact in `@ottabase/ottaorm`
✅ **Model Registry**: Still works (`registerModels`, `getModel`)
✅ **Connection Registry**: Still works (`registerConnection`, `getConnection`)
✅ **Per-App Models**: Each app has its own `ottabase/models/`
✅ **Per-App Schema**: Each app combines core + app tables
✅ **Per-App Migrations**: Each app has its own `migrations/index.ts`
✅ **Separate Databases**: Each app can connect to different D1 database
✅ **Backward Compatible**: Old `runMigrations` still works

🆕 **New Feature**: Automatic table creation from Models via `autoInit()`
