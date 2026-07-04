# @ottabase/ottaorm

An ORM for Cloudflare D1 and SQLite. Fat model pattern with all logic in one place.

## Features

- **Fat Models** - All metadata, validation, relationships in model class
- **Zod Validation** - Auto-generated Zod schemas from field metadata, validates in create/update
- **Eloquent-like API** - `Model.find()`, `Model.where()`, `Model.create()`
- **Automated Migrations** - Auto-creates tables from Models, no CLI needed
- **Type-Safe** - Full TypeScript support with Drizzle ORM
- **Relationships** - belongsTo, hasMany, hasOne, belongsToMany
- **Eager Loading** - `instance.load('author', 'comments')` for relationship loading
- **Soft Deletes** - Optional `deletedAt` support with `restore()`, `withTrashed()`, `onlyTrashed()`
- **Batch Operations** - Atomic batch execution via D1's native batch API
- **Optimistic Updates** - Built-in optimistic cache updates in TanStack Query mutation hooks
- **Query Safeguards** - Auto-capped `limit` (max 1000) and `offset` (max 100k) on list endpoints
- **Field Metadata** - UI config, validation, form/table config
- **Type Casting** - Automatic boolean, date, json conversion
- **Per-App Models** - Core models + app-specific models

## Installation

```bash
pnpm add @ottabase/ottaorm @ottabase/db drizzle-orm
```

## Quick Start

### File layout: schema and model

Table definitions live in **`ModelName.schema.ts`** next to the model file. The model file imports the table from
`./ModelName.schema` and **re-exports** it so existing imports (e.g. for migrations or schema collection) continue to
work. No breaking changes for callers: `from '../models/Todo'` or `from '@ottabase/ottaorm'` still provide the table and
types.

### 1. Define Your Model

**Todo.schema.ts** – table and inferred types:

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const todosTable = sqliteTable('todos', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    title: text('title').notNull(),
    completed: integer('completed', { mode: 'boolean' }).default(false).notNull(),
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

export type TodoType = typeof todosTable.$inferSelect;
export type NewTodoType = typeof todosTable.$inferInsert;
```

**Todo.ts** – model class and re-exports:

```typescript
import { BaseModel } from '@ottabase/ottaorm';
import { todosTable, type NewTodoType, type TodoType } from './Todo.schema';

export { todosTable, type NewTodoType, type TodoType } from './Todo.schema';

export class Todo extends BaseModel {
    static entity = 'todos';
    static table = todosTable;
    static primaryKey = 'id';

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
export { usersTable, postsTable } from '@ottabase/ottaorm'; // Core tables
export { todosTable } from '../models/Todo'; // Your tables
export { shortlinksTable } from '@ottabase/shortlinks'; // Package tables
```

### 3. Initialize Database

```typescript
// app/api/ottaorm/init/route.ts
import { autoInit, collectTableSchemas } from '@ottabase/ottaorm';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import * as schema from '../../../../ottabase/db/schema';

const driver = createD1Driver(env.OBCF_D1);
const result = await autoInit({
    driver,
    schema: collectTableSchemas(schema),
});
// ✅ All tables created automatically!
```

### 4. Use Models

```typescript
import { Todo } from './models/Todo';
import { setDriver } from '@ottabase/ottaorm';

// Set driver once (in middleware or route)
setDriver(createD1Driver(env.OBCF_D1));

// Use models anywhere
const todo = await Todo.create({ title: 'Buy groceries' });
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
            "binding": "OBCF_D1", // Accessible as env.OBCF_D1
            "database_name": "your-app-db",
            "database_id": "local", // Use "local" for dev
        },
    ],
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
curl -X POST http://localhost:3004/api/ottaorm/init
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
            "database_id": "abc123-def456-ghi789", // ← Your production ID
        },
    ],
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
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { setDriver } from '@ottabase/ottaorm';

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
    },
};
```

## Zod Validation

Models auto-generate Zod schemas from field metadata. Validation runs automatically in `create()` and `update()`, and
can be used client-side via `@ottabase/forms`.

### Automatic (in create/update)

```typescript
// Throws if validation fails
const user = await User.create({ name: '', email: 'bad' });
// → Error('Validation failed: Name is required')
```

### Manual

```typescript
// Get Zod schema
const schema = User.getZodSchema('create'); // or 'update'
const result = schema.safeParse(data);

// Validate with flat error map
const { success, errors } = User.validate({ name: 'John', email: 'bad' }, 'create');
// → { success: false, errors: { email: 'Invalid email format' } }
```

### Schema Builder

```typescript
import { buildZodSchema, validateField } from '@ottabase/ottaorm';

// Build from any field metadata
const schema = buildZodSchema(fields, 'create');

// Validate a single field
const error = validateField(field, value); // null if valid
```

**Supported rules**: `required`, `email`, `url`, `min:N`, `max:N` (defined in `field.validation.rules`)

## Fat Model Pattern

Logic lives in the model class; the table schema lives in `ModelName.schema.ts` and is re-exported from the model file.

**Todo.schema.ts** – table and types:

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const todosTable = sqliteTable('todos', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    title: text('title').notNull(),
    completed: integer('completed', { mode: 'boolean' }).default(false).notNull(),
    userId: text('user_id'),
    createdAt: integer('created_at', { mode: 'timestamp' })
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
        .$defaultFn(() => Date.now())
        .notNull(),
});

export type TodoType = typeof todosTable.$inferSelect;
export type NewTodoType = typeof todosTable.$inferInsert;
```

**Todo.ts** – model class (import table from schema, re-export for migrations/schema collection):

```typescript
import { BaseModel } from '@ottabase/ottaorm';
import { todosTable, type NewTodoType, type TodoType } from './Todo.schema';

export { todosTable, type NewTodoType, type TodoType } from './Todo.schema';

export class Todo extends BaseModel {
    static entity = 'todos';
    static table = todosTable;
    static primaryKey = 'id';

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
                rules: 'required',
                messages: {
                    required: 'Title is required',
                },
            },
        },
        // ... more fields
    };

    // Relationships
    async user(select?: string[]) {
        const { User } = await import('@ottabase/ottaorm');
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
    title: 'Buy groceries',
    userId: 'user-123',
});

// Create multiple records
const todos = await Todo.createMany([{ title: 'Task 1' }, { title: 'Task 2' }]);
```

### Reading Records

```typescript
// Find by primary key
const todo = await Todo.find('todo-id');

// Find or throw error
const todo = await Todo.findOrFail('todo-id');

// First record matching conditions
const todo = await Todo.first({ completed: false });

// All records
const todos = await Todo.all();

// Where conditions
const todos = await Todo.where({ completed: true });

// With ordering
const todos = await Todo.where(
    { userId: 'user-123' },
    {
        orderBy: 'createdAt',
        orderDirection: 'desc',
    },
);

// Pagination
const result = await Todo.paginate(1, 10, undefined, {
    orderBy: 'createdAt',
    orderDirection: 'desc',
});
// result = { data, total, page, perPage, totalPages, hasNextPage, hasPrevPage }

// Search + pagination (uses fields marked searchable: true)
const searched = await Todo.searchPaginate('groceries', ['title', 'notes'], 1, 10);
```

### Updating Records

```typescript
// Update via instance
const todo = await Todo.find('todo-id');
todo.set('title', 'Updated title');
await todo.save();

// Update multiple fields
todo.fill({ title: 'New title', completed: true });
await todo.save();

// Static update
await Todo.update('todo-id', { completed: true });
```

### Deleting Records

```typescript
// Delete instance
const todo = await Todo.find('todo-id');
await todo.delete();

// Static delete
await Todo.destroy('todo-id');
```

### Soft Deletes

Enable soft deletes on a model by setting `softDeletes = true`. The table must have a `deletedAt` integer column.

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const postsTable = sqliteTable('posts', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    deletedAt: integer('deleted_at'), // required for soft deletes
});

export class Post extends BaseModel {
    static entity = 'posts';
    static table = postsTable;
    static softDeletes = true; // enables soft deletes
}

// Soft delete — sets deletedAt, row stays in DB
await Post.delete('post-id');

// Queries automatically exclude soft-deleted records
const posts = await Post.where({}); // excludes deleted

// Include soft-deleted records
const allPosts = await Post.withTrashed().where({});

// Query only soft-deleted records
const trashed = await Post.onlyTrashed();

// Restore a soft-deleted record
await Post.restore('post-id');

// Permanently delete (bypasses soft delete)
await Post.forceDelete('post-id');
```

### Batch Operations

Execute multiple SQL statements atomically using D1's native batch API:

```typescript
await BaseModel.batch([
    "INSERT INTO todos (id, title) VALUES ('1', 'First')",
    "INSERT INTO todos (id, title) VALUES ('2', 'Second')",
]);
// All succeed or all fail — atomic execution
```

### Eager Loading

Load relationships after the initial query:

```typescript
// Single instance — loads each relation in parallel
const post = await Post.find('post-id');
await post.load('author', 'comments');
console.log(post.get('author')); // { id: '...', name: '...' }
console.log(post.get('comments')); // [{ id: '...', content: '...' }, ...]

// Collection — loads each instance's relations in parallel (N queries per relation)
// For truly batched loading, use whereIn directly on the related model
const posts = await Post.where({});
await Post.loadAll(posts, 'author', 'tags');
```

Relationship methods must be defined as instance methods on the model:

```typescript
export class Post extends BaseModel {
    async author() {
        return this.belongsTo(User, 'authorId');
    }
    async comments() {
        return this.hasMany(Comment, 'postId');
    }
}
```

## Relationships

### belongsTo (N:1)

```typescript
export class Post extends BaseModel {
    async author(select?: string[]) {
        const { User } = await import('./User');
        return this.belongsTo(User, 'authorId', { select });
    }
}

// Usage
const post = await Post.find('post-id');
const author = await post.author(['id', 'name', 'email']);
```

### hasMany (1:N)

```typescript
export class User extends BaseModel {
    async posts(options?: { select?: string[]; orderBy?: string; orderDirection?: 'asc' | 'desc'; limit?: number }) {
        const { Post } = await import('./Post');
        return this.hasMany(Post, 'authorId', options);
    }
}

// Usage
const user = await User.find('user-id');
const posts = await user.posts({
    select: ['id', 'title', 'createdAt'],
    orderBy: 'createdAt',
    orderDirection: 'desc',
    limit: 10,
});
```

### hasOne (1:1)

```typescript
export class User extends BaseModel {
    async profile() {
        const { Profile } = await import('./Profile');
        return this.hasOne(Profile, 'userId');
    }
}

// Usage
const user = await User.find('user-id');
const profile = await user.profile();
```

### belongsToMany (N:M)

```typescript
export class Post extends BaseModel {
    async tags(options?: { select?: string[]; orderBy?: string; withPivot?: string[] }) {
        const { Tag } = await import('./Tag');
        return this.belongsToMany(Tag, postTagsTable, {
            foreignKey: 'postId',
            otherKey: 'tagId',
            ...options,
        });
    }
}

// Usage
const post = await Post.find('post-id');
const tags = await post.tags({
    select: ['id', 'name', 'slug'],
    withPivot: ['createdAt'],
});
```

## Automated Migrations

**No CLI commands needed!** Just define Models and call `/api/ottaorm/init`:

```bash
# Development (no auth)
curl -X POST http://localhost:3004/api/ottaorm/init

# Production (requires MIGRATION_SECRET)
curl -X POST https://your-app.com/api/ottaorm/init \
  -H "Authorization: Bearer ${MIGRATION_SECRET}"
```

**What happens automatically:**

- ✅ Creates tables that don't exist — including **composite primary keys** (`primaryKey({ columns })`) and table-level
  `UNIQUE` constraints
- ✅ Adds new columns to existing tables
- ✅ Creates declared **indexes** (`index()` / `uniqueIndex()`, including composite unique indexes). Idempotent
  (`IF NOT EXISTS`), so it also **backfills** missing indexes onto existing tables
- ✅ Runs custom migrations (seeds, data backfills)
- ✅ Tracks all migrations

### Adding a New Field

```typescript
export const todosTable = sqliteTable('todos', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    priority: integer('priority').default(0).notNull(), // NEW!
});

// Call /api/ottaorm/init → Column added automatically ✅
```

## Auth Integration

OttaORM core migrations include the auth tables used by `@ottabase/auth`:

- `users`
- `accounts`
- `sessions`
- `verification_tokens`
- `authenticators`

Credentials auth uses `users.password_hash` (PBKDF2) and `users.email_verified` (optional).

### Custom Migrations

```typescript
// ottabase/migrations/index.ts
export const appMigrations: Migration[] = [
    {
        name: '0000_seed_admin',
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

SQLite's `ALTER TABLE` can only add columns. So a **non-destructive** run (the default) **cannot**:

- ❌ **Change column types** — requires a table rebuild
- ❌ **Rename columns** — requires a table rebuild
- ❌ **Drop columns** — requires a table rebuild
- ⚠️ **Add NOT NULL columns** — must have a `DEFAULT` value

For type changes, renames, and drops, run with `allowDestructive: true` (plus `renameMap` for renames). The generator
rebuilds the table (create new → copy intersecting columns → drop old → rename), **preserving primary keys, unique
constraints, and indexes**. Destructive rebuilds are **off by default** — enable them deliberately (ideally gated behind
your `MIGRATION_SECRET`). For anything complex, prefer a custom migration.

**Example:**

```typescript
// ✅ GOOD - Has default value
status: text('status').default('active').notNull();

// ❌ BAD - No default, will fail if table has data
status: text('status').notNull();
```

For complex schema changes, use custom migrations. See
[Migration README](../../apps/otta-web/ottabase/migrations/README.md) for examples.

## Type Casting

Automatic type conversion:

```typescript
export class Todo extends BaseModel {
    static casts = {
        completed: 'boolean' as const, // INTEGER -> boolean
        createdAt: 'date' as const, // INTEGER -> Date
        updatedAt: 'date' as const,
        metadata: 'json' as const, // TEXT -> object
        tags: 'array' as const, // TEXT -> array
    };
}

const todo = await Todo.find('todo-id');
console.log(typeof todo.get('completed')); // "boolean"
console.log(todo.get('createdAt')); // Date object
```

Casting is symmetric: `json` / `array` casts are also **serialized on write**, so an object/array round-trips through a
plain `TEXT` column without manual `JSON.stringify`. If a column uses Drizzle's `mode: 'json'`, serialization is left to
Drizzle (no double-encoding). `number` casts use `parseFloat`, so decimals are preserved.

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
- **Account** - OAuth provider accounts
- **Tag** - Tags with name and slug
- **Session** - User sessions
- **VerificationToken** - Email verification tokens
- **Authenticator** - WebAuthn/Passkey credentials

**Note:** The Post model has been moved to `@ottabase/ottablog` as a comprehensive blog/content management model with
enhanced features.

## Multi-Tenant Models

Ottabase includes built-in multi-tenant SaaS models following the **Tenant > App > User** hierarchy:

- **Organization** - Tenants with plan, status, settings, metadata
- **OrganizationMember** - User memberships with roles (owner, admin, member)

### Organization Model

Organizations represent tenants in your multi-tenant application:

```typescript
import { Organization } from '@ottabase/ottaorm';

// Create organization (tenant)
const org = await Organization.create({
    name: 'Acme Corp',
    slug: 'acme-corp',
    ownerId: 'user-123',
    plan: 'pro',
    status: 'active',
    settings: {
        features: ['rbac', 'audit'],
        maxMembers: 50,
    },
});

// Find by slug
const org = await Organization.first({ slug: 'acme-corp' });

// Get all active organizations
const activeOrgs = await Organization.where({ status: 'active' });
```

**Available Plans:** `free`, `pro`, `enterprise` **Available Statuses:** `active`, `suspended`, `deleted`

### OrganizationMember Model

Manage user memberships and roles within organizations:

```typescript
import { OrganizationMember } from '@ottabase/ottaorm';

// Add member to organization
const member = await OrganizationMember.create({
    userId: 'user-456',
    organizationId: org.id,
    role: 'member',
    status: 'active',
    invitedBy: 'user-123',
    joinedAt: Date.now(),
});

// Get all members of an organization
const members = await OrganizationMember.where(
    { organizationId: org.id, status: 'active' },
    { orderBy: 'joinedAt', orderDirection: 'desc' },
);

// Check user's role in organization
const membership = await OrganizationMember.first({
    userId: 'user-456',
    organizationId: org.id,
});
console.log(membership.get('role')); // 'admin', 'member', etc.

// Update member role
await OrganizationMember.update(membership.id, { role: 'admin' });
```

**Available Roles:** `owner`, `admin`, `member` **Available Statuses:** `active`, `invited`, `suspended`

**Email-first invites.** A member is either a real user (`userId`) or a pending invite by email (`invitedEmail`, with
`userId` null) — the same membership shape as `user_group_members`. Invites start `invited`; activate them when the
person signs up:

```typescript
// Invite by email (no account yet) — joinedAt is stamped on activation, not now
await OrganizationMember.addMember({
    organizationId: org.id,
    invitedEmail: 'teammate@example.com',
    role: 'member',
    status: 'invited',
    invitedBy: 'user-123',
});

// On sign-up / sign-in, claim any pending invites matching this email
await OrganizationMember.activatePendingInvites(user.id, user.email);

// Accessible org ids for the security context (active memberships + owned orgs)
const orgIds = await OrganizationMember.organizationIdsForUser(user.id);
```

### UserGroup Model (generic groups)

`UserGroup` is a **reusable membership primitive**: a named group of users _within_ an organization (optionally scoped
to one app). Instead of every feature re-implementing "members with roles and invites", an app entity attaches to a
group via a `user_group_id` FK and inherits the whole member / role / invite machinery.

```typescript
// Your app entity owns one group for its membership:
import { userGroupsTable } from '@ottabase/ottaorm';

export const expenseGroupsTable = sqliteTable('expense_groups', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    userGroupId: text('user_group_id')
        .notNull()
        .references(() => userGroupsTable.id, { onDelete: 'cascade' }),
    // ...feature-specific columns
});
```

**Roles** are free-form (apps choose the vocabulary; defaults to `member` — e.g. `manager`/`member` or
`owner`/`admin`/`member`). **Statuses** match `OrganizationMember`: `invited` → `active` → `suspended`. A member is
either an existing user (`userId`) **or** an email invite (`invitedEmail`, with `userId` null until they sign up).

```typescript
import { UserGroup, UserGroupMember } from '@ottabase/ottaorm';

// Create a group (org-scoped, optional app scope)
const group = await UserGroup.create({
    name: 'Trip to Japan',
    slug: 'trip-to-japan',
    organizationId: org.id,
    appId: 'tuskly',
    createdBy: userId,
});

// Add an existing user as an active member
await UserGroupMember.addMember({
    groupId: group.id,
    organizationId: org.id,
    userId: 'user-456',
    role: 'manager',
    status: 'active',
});

// Invite someone by email (no account yet) — joinedAt is stamped on activation, not now
await UserGroupMember.addMember({
    groupId: group.id,
    organizationId: org.id,
    invitedEmail: 'friend@example.com',
    role: 'member',
    status: 'invited',
    invitedBy: userId,
});

// Role / membership checks (active members only)
await UserGroupMember.isMember(group.id, 'user-456'); // true
await UserGroupMember.hasRole(group.id, 'user-456', 'manager'); // true

// Members of a group (with basic user info), and all groups in an org
await UserGroupMember.getGroupMembers(group.id);
await UserGroup.forOrganization(org.id, { appId: 'tuskly' });
```

**Activate email invites on sign-in.** When an invited user signs up, flip their pending invites to active and link the
account — call this from your auth flow (the org-level equivalent lives on `OrganizationMember`):

```typescript
// worker/lib/auth-utils.ts (on sign-in / sign-up)
await UserGroupMember.activatePendingInvites(user.id, user.email);
```

**Membership-scoped RLS.** Unlike org-wide tenant models, `user_groups` and `user_group_members` are filtered to the
groups a user actually belongs to. The policy reads `SecurityContext.memberGroupIds`, so resolve it where you build the
context (alongside `memberOrganizationIds`):

```typescript
const context: SecurityContext = {
    userId,
    organizationId,
    memberOrganizationIds: await OrganizationMember.organizationIdsForUser(userId),
    // active memberships + groups the user created
    memberGroupIds: await UserGroup.groupIdsForUser(userId, organizationId),
};
```

With `memberGroupIds` set, secure CRUD returns only the caller's groups (and only members of those groups). If it is
absent the policy falls back to groups the user **created**, so a creator never loses access. On writes the policy
enforces org isolation only — _who_ may add or remove members (group-admin authorization) is the app's call.

### Multi-Tenant Setup

```typescript
// ottabase/db/schema.ts
export {
    usersTable,
    organizationsTable, // Multi-tenant
    organizationMembersTable, // Multi-tenant
} from '@ottabase/ottaorm';

// ottabase/middleware/tenant.ts
import { Organization, OrganizationMember } from '@ottabase/ottaorm';

export async function getTenantContext(userId: string, orgSlug: string) {
    const org = await Organization.first({ slug: orgSlug });
    if (!org) throw new Error('Organization not found');

    const member = await OrganizationMember.first({
        userId,
        organizationId: org.id,
        status: 'active',
    });
    if (!member) throw new Error('Not a member');

    return {
        organization: org,
        role: member.get('role'),
        userId,
    };
}
```

For complete RBAC integration with these models, see the [@ottabase/rbac](../rbac/README.md) package.

## Row-Level Security (RLS)

OttaORM includes a built-in RLS engine that enforces data isolation at the query level. Policies are defined per-model
and applied automatically by the secure CRUD handler.

**Fail-closed by design:**

- **No policy → no access.** A model without a registered policy throws, rather than returning unscoped rows.
- **Unknown filter column → no access.** If a policy's filter field isn't a real column on the model, the secure CRUD
  layer throws instead of silently dropping the filter (which would otherwise leak across tenants). Keep policy `field`
  / `contextFields` / `enforceOnWrite` names in sync with your table columns.
- **Caller `where` can't widen scope.** The RLS filter is merged last, so a client can't override a security field.
- **Read-before-write.** Update/delete first verify the record is visible under the caller's RLS filter.

### Policy Levels

| Level    | Description                              | Filter field     |
| -------- | ---------------------------------------- | ---------------- |
| `tenant` | Scoped to an organization                | `organizationId` |
| `user`   | Scoped to the authenticated user         | `userId`         |
| `app`    | Scoped to an application context         | `appId`          |
| `public` | No filter applied (read-only by default) | —                |
| `custom` | Fully custom filter function             | —                |

### Quick Setup

```typescript
import { RLSPolicies, type ModelRLSConfig } from '@ottabase/ottaorm';

const policies: ModelRLSConfig[] = [
    { model: 'posts', policy: RLSPolicies.TenantScoped(false) },
    { model: 'todos', policy: RLSPolicies.UserScoped() },
    { model: 'audit_logs', policy: { ...RLSPolicies.TenantScoped(true), readOnly: true } },
    { model: 'config', policy: RLSPolicies.AdminOnly() },
];
```

### Organization Membership Filter

The built-in `organizations` policy supports both ownership and membership. When the `SecurityContext` includes
`memberOrganizationIds`, the filter returns all orgs the user can access (owned + member). Otherwise it falls back to
`ownerId` only:

```typescript
// SecurityContext populated by your auth middleware:
const context: SecurityContext = {
    userId: 'user-123',
    organizationId: 'org-1',
    memberOrganizationIds: ['org-1', 'org-2', 'org-3'], // owned + member orgs
};

// The organizations RLS filter will return:
// { id: ['org-1', 'org-2', 'org-3'] }   ← inArray query
```

### Array Filters (IN queries)

`buildWhereConditions` supports array values, translating them to `inArray()` queries:

```typescript
// In a custom RLS filter:
filter: (context) => ({
    id: context.memberOrganizationIds, // → WHERE id IN ('org-1', 'org-2', ...)
});
```

### Slug uniqueness (`GET /api/ottaorm/posts/unique`)

The `posts` model uses **Hierarchical** RLS (`organizationId` + `userId` + `appId`). For `GET …/unique`, user-scoped
reads would make slug checks see only the current author’s rows. **Secure CRUD** therefore drops `userId` from the
merged `where` for `model === 'posts'` and `id === 'unique'` only, so `BaseModel.isUnique` matches **organization +
app** scope (aligned with composite unique indexes on posts).

### SQLite `UNIQUE` errors

`executeSecureCrudRequest` maps `UNIQUE constraint failed` (including **composite** indexes) to HTTP **409** with
`fieldErrors`. `parseSqliteUniqueConstraintForApi()` prefers meaningful columns (e.g. `slug`) when SQLite lists several.

### Malformed request payloads

`parseCrudRequest` **fails closed** when it can't parse user input, attaching a `parseError` to the returned
`CrudRequest`. Both `handleCrud` and `executeSecureCrudRequest` short-circuit with **HTTP 400** when `parseError` is
present, so malformed input never silently degrades into an empty-body no-op or an unfiltered query:

| Scenario                        | Code            | Status |
| ------------------------------- | --------------- | ------ |
| Invalid JSON in `?where=` param | `INVALID_QUERY` | 400    |
| Invalid JSON body on POST/PATCH | `INVALID_BODY`  | 400    |

### SecurityContext

The security context is passed to all RLS operations:

```typescript
interface SecurityContext {
    userId?: string;
    organizationId?: string | null;
    appId?: string;
    roles?: string[];
    permissions?: string[];
    memberOrganizationIds?: string[]; // orgs the user can access
}
```

> **⚠️ Build the context from a trusted source.** Derive `SecurityContext` from a **verified session or JWT** — never
> from raw client input. `rlsMiddleware` therefore **requires** an explicit `getContext(request, env)` resolver:
>
> ```typescript
> return rlsMiddleware(request, env, async (req) => {
>     const session = await getVerifiedSession(req); // your auth
>     return { userId: session.userId, organizationId: session.orgId, appId: 'web', roles: session.roles };
> });
> ```
>
> A header-based helper, `extractSecurityContext(request)`, exists for gateways that set/strip trusted headers
> (`x-user-id`, `x-org-id`, …). **It is spoofable if exposed to clients directly** — only use it behind a trusted proxy.

### Permission Wildcards

When a policy uses `requiredPermissions` (e.g. `['brand:edit']`), the RLS engine supports wildcard matching:

| Pattern   | Matches              | Example                                   |
| --------- | -------------------- | ----------------------------------------- |
| `*:*`     | All permissions      | Super-admin bypasses any permission check |
| `brand:*` | All brand actions    | Satisfies `brand:edit`, `brand:read`      |
| `*:edit`  | Edit on any resource | Satisfies `posts:edit`, `brand:edit`      |

Admins with `*:*` or `brand:*` will pass policies requiring `brand:edit`. Same semantics as
[@ottabase/rbac](../rbac/README.md).

**Limits:** Only 2-segment `resource:action` format is supported. Bare `*` does not grant—use `*:*`. 3+ segments (e.g.
`brand:edit:admin`) are not matched by wildcards; only exact match applies.

### Audit Integration

RLS violations are persisted to the `audit_logs` table via the `AuditLog` model. Logging happens at the secure-CRUD
boundary (awaited as part of the request), so it is reliable on edge runtimes. `getRecentViolations(n)` returns the
**most recent `n`** violations, ordered and limited at the database layer (it does not load the whole table):

```typescript
import { getRecentViolations } from '@ottabase/ottaorm';

const violations = await getRecentViolations(50); // newest 50, ordered by createdAt desc
```

## Architecture

```
@ottabase/ottaorm (CORE)
├── User, Tag, Account (Models)
├── Auto-migration system
├── RLS engine & policies
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

## Generic CRUD API

OttaORM provides a generic CRUD endpoint that works with all registered models:

```
/api/ottaorm/{model}/{id?}
```

### Supported Operations

| Method   | URL                                           | Description                |
| -------- | --------------------------------------------- | -------------------------- |
| `GET`    | `/api/ottaorm/posts`                          | List all (paginated)       |
| `GET`    | `/api/ottaorm/posts/123`                      | Get single by ID           |
| `GET`    | `/api/ottaorm/posts?field=slug&value=my-post` | Get single by field/value  |
| `GET`    | `/api/ottaorm/posts?search=hello`             | Search (searchable fields) |
| `POST`   | `/api/ottaorm/posts`                          | Create new                 |
| `PATCH`  | `/api/ottaorm/posts/123`                      | Update existing            |
| `DELETE` | `/api/ottaorm/posts/123`                      | Delete                     |

### Find by Field/Value

Find a single record by any field (e.g., slug, email, code):

```bash
# API endpoint
GET /api/ottaorm/posts?field=slug&value=my-post-slug
```

**Response:** Returns the object directly (not wrapped):

```json
{
  "id": "123",
  "slug": "my-post-slug",
  "title": "My Post",
  ...
}
```

### Search

Search uses fields marked `searchable: true` in model metadata and supports pagination.

```bash
GET /api/ottaorm/posts?search=hello&orderBy=createdAt&orderDirection=desc&page=1&perPage=10
```

### Query Limits

To prevent abuse, the CRUD API enforces upper bounds on query parameters:

| Parameter | Paginated | Non-paginated |
| --------- | --------- | ------------- |
| `perPage` | max 100   | N/A           |
| `limit`   | N/A       | max 1000      |
| `offset`  | N/A       | max 100,000   |

Values exceeding these limits are silently capped to the maximum.

### Client Hooks

TanStack Query hooks for React components. Mutations include built-in optimistic updates — `useUpdate` patches the
detail cache immediately and rolls back on error, `useDelete` removes the cached item and restores it on failure.

```typescript
import { createModelHooks } from '@ottabase/ottaorm/client';

const blogPostHooks = createModelHooks<BlogPost>({ entityName: 'posts' });

// In your component
function BlogDetailPage() {
    const { data: post, isLoading } = blogPostHooks.useFind('slug', 'my-post-slug');

    // Or by ID
    const { data: postById } = blogPostHooks.useDetail('123');

    // List all
    const { data: posts } = blogPostHooks.useList();

    // Mutations (with built-in optimistic updates)
    const createPost = blogPostHooks.useCreate();
    const updatePost = blogPostHooks.useUpdate();
    const deletePost = blogPostHooks.useDelete();
}
```

**Available hooks:**

- `useList()` - List all records (supports filters and pagination via endpoint)
- `useDetail(id)` - Get by primary key
- `useFind(field, value)` - Get by field/value
- `useCreate()` - Create new record
- `useUpdate()` - Update existing record
- `useDelete()` - Delete record
- `useInfiniteList()` - Infinite scroll pagination

### Cache & Invalidation

Ottabase uses **entity-namespaced query keys** and a **global mutation observer** to make cache invalidation automatic —
similar to SWR, but layered on TanStack Query.

#### How it works

Every query that belongs to an entity is namespaced under `[entityName, ...]`. Every mutation that changes an entity
broadcasts `meta: { entity: entityName }`. The `OttaQueryProvider` subscribes to the mutation cache and calls
`invalidateQueries([entity])` on success, which TanStack propagates to all matching queries via prefix matching —
regardless of which endpoint they hit.

This means a delete in the admin panel automatically busts the public blog list, the detail page, infinite scroll — any
query for that entity, anywhere in the app.

#### `createModelHooks` — automatic, zero config

All mutations from `createModelHooks` carry `meta.entity` automatically. No extra config needed.

```typescript
const blogPostHooks = createModelHooks<BlogPost>({ entityName: 'posts' });

// Deleting a post invalidates ALL ['posts', ...] queries everywhere
const deletePost = blogPostHooks.useDelete();
await deletePost.mutateAsync(id);
```

#### `useApiQuery` — custom endpoints, same invalidation

Use the `entity` option for any custom endpoint query. The key is namespaced as `[entity, ...queryKey]`, so it's busted
by mutations on that entity automatically.

```typescript
// Key becomes ['posts', 'list', { page, contentType }]
const { data } = useApiQuery<BlogListResponse>({
    entity: 'posts',
    queryKey: ['list', { page, contentType }],
    endpoint: `/api/blog/posts?page=${page}`,
    queryOptions: BLOG_LIST_QUERY_CONFIG,
});
```

#### `useEntityQuery` — custom queryFn, same invalidation

When you need a fully custom `queryFn` (not just an endpoint string), use `useEntityQuery`. The hook always provides a
non-null `api` function — the injected client when available, a raw fetch adapter otherwise. No null-guarding needed.

```typescript
const { data } = useEntityQuery<BlogPost>('posts', (api) => api(`/api/blog/posts/by-slug/${slug}`), {
    subKey: ['by-slug', slug],
    enabled: !!slug,
    ...BLOG_DETAIL_QUERY_CONFIG,
});
```

#### `useApiMutation` — custom mutations with entity invalidation

Invalidation runs on **success only** — failed mutations leave the cache untouched.

```typescript
const publishAll = useApiMutation({
    endpoint: '/api/blog/publish-all',
    method: 'POST',
    invalidateEntities: ['posts'], // busts all ['posts', ...] queries on success
});
```

#### Opting in from raw `useMutation`

Any `useMutation` call participates in automatic invalidation by setting `meta.entity`:

```typescript
useMutation({
    meta: { entity: 'posts' }, // observer picks this up
    mutationFn: (id) => api(`/api/posts/${id}`, { method: 'DELETE' }),
});
```

#### Convention: always declare `entity`

| Scenario                        | Correct hook                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------- |
| Standard CRUD on a model        | `createModelHooks`                                                              |
| Custom endpoint, standard fetch | `useApiQuery({ entity, queryKey, endpoint })`                                   |
| Custom endpoint, custom queryFn | `useEntityQuery(entity, queryFn, { subKey })`                                   |
| Custom mutation                 | `useApiMutation({ invalidateEntities })` or `useMutation({ meta: { entity } })` |

Queries without an `entity` declaration are not invalidated by any mutation. This is intentional for truly static or
cross-entity data (e.g. config, stats).

## Complete Example: API Route

```typescript
// app/api/ottaorm/init/route.ts
import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { autoInit, collectTableSchemas } from '@ottabase/ottaorm';
import * as schema from '../../../../ottabase/db/schema';
import { appMigrations } from '../../../../ottabase/migrations';

export const runtime = 'edge';

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
import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { setDriver } from '@ottabase/ottaorm';
import { Todo } from '../../../../ottabase/models/Todo';

export const runtime = 'edge';

export async function GET() {
    const { env } = getCloudflareContext();
    setDriver(createD1Driver(env.OBCF_D1));

    const todos = await Todo.all();
    return NextResponse.json({ todos: todos.map((t) => t.toJson()) });
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
