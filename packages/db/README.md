# @ottabase/db

Shared database layer for Ottabase applications. It bundles three independent capabilities that apps opt into as needed: a Drizzle driver for Cloudflare D1, a native MongoDB driver, and a Prisma schema-composition system for building per-app Prisma schemas out of feature packages.

## Drizzle (Cloudflare D1)

Best for Cloudflare D1 and modern edge deployments with better type safety and performance.

```typescript
// Use in Cloudflare Worker with D1
import { createD1Driver } from '@ottabase/db/drizzle-d1';

const driver = createD1Driver(env.DB);
const db = driver.getDb();

// Use with your Drizzle schema
const users = await db.select().from(usersTable);
```

## Raw Queries

Execute custom SQL when you need more control:

```typescript
import { createD1Driver, raw } from '@ottabase/db/drizzle-d1';

const driver = createD1Driver(env.DB);

// Simple query
const result = await raw(driver, 'SELECT * FROM users WHERE active = 1');
console.log(result.results); // typed as unknown[]

// With parameters
const user = await raw<{ id: string; name: string }>(driver, 'SELECT id, name FROM users WHERE id = ?', [userId]);

// INSERT/UPDATE/DELETE
const inserted = await raw(driver, 'INSERT INTO logs (message) VALUES (?)', ['User logged in']);
console.log(inserted.meta?.changes); // rows affected
```

## MongoDB

A native MongoDB driver used by OttaORM's Mongo-backed models (e.g. `packages/ottaorm`'s `MongoBaseModel`):

```typescript
import { createMongoDriver } from '@ottabase/db/mongodb';

const driver = await createMongoDriver('mongodb://localhost:27017', 'myapp', { log: true });

const users = await driver.find('users', { active: true });
const user = await driver.findOne('users', { email: 'test@example.com' });
await driver.insertOne('users', { email: 'new@example.com' });
await driver.updateOne('users', { _id }, { $set: { active: false } });
await driver.deleteOne('users', { _id });
await driver.count('users', { active: true });
```

`MongoDriver` also exposes `getDb()`/`getCollection()` for direct native access. The subpath re-exports `isObjectId()`/`toObjectId()` helpers, plus the underlying `mongodb` package's `MongoClient`, `Db`, `Collection`, `Document`, and `ObjectId` types.

## Prisma Schema Composition

`@ottabase/db/config` and `@ottabase/db/registry` define the mechanism used to compose each app's Prisma schema from the base schema plus opt-in feature packages (e.g. `@ottabase/auth`):

```typescript
// apps/web/db.config.ts
import { defineAppDbConfig } from '@ottabase/db/config';

export default defineAppDbConfig({
  appId: 'web',
  dbProvider: 'd1',
  features: ['auth'], // pulls in the auth feature's schema + migrations
});
```

Feature packages register their `.schema.prisma` file and migrations via `registerFeature`/`defineFeatureSchema`; `createFeatureRegistry`/`discoverFeatures`/`FeatureRegistry` handle dependency resolution (topological sort) across features. `packages/scripts` uses this to concatenate schemas and drive migrations (`db-generate`, `db-migrate`, `db-migrate-apply`, `db-migrate-status`) for each app. See `src/prisma/D1_LOCAL_DEVELOPMENT.md` and `src/prisma/D1_PRODUCTION_DEPLOYMENT.md` for the full local-dev and production workflows.

## Exports

| Import                    | Function                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `@ottabase/db`            | Shared types                                                                             |
| `@ottabase/db/config`     | `defineAppDbConfig()`, `AppDbConfig`, feature/schema config types                        |
| `@ottabase/db/registry`   | `createFeatureRegistry()`, `registerFeature()`, `discoverFeatures()`, `FeatureRegistry`  |
| `@ottabase/db/drizzle`    | `BaseDbDriver`, `DbDriver`, `raw`, `DbRawResult`                                         |
| `@ottabase/db/drizzle-d1` | `createD1Driver()`, `D1Driver`, `raw`                                                    |
| `@ottabase/db/mongodb`    | `createMongoDriver()`, `MongoDriver`, `isObjectId()`, `toObjectId()`                     |

## Package Separation

- **`@ottabase/db`**: Database layer (Drizzle/D1 driver, MongoDB driver, and Prisma schema composition)
- **`@ottabase/cf`**: Cloudflare bindings (D1, KV, R2, Queues, etc.)
