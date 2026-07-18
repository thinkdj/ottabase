# @ottabase/db

Shared database layer for Ottabase applications: a Drizzle driver for Cloudflare D1, plus a `raw()` helper for
hand-written SQL when you need more control than the query builder gives you.

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

## Exports

| Import                    | Function                                       |
| -------------------------- | ----------------------------------------------- |
| `@ottabase/db`            | Intentionally empty — import from a subpath below |
| `@ottabase/db/drizzle`    | `BaseDbDriver`, `DbDriver`, `raw`, `DbRawResult` |
| `@ottabase/db/drizzle-d1` | `createD1Driver()`, `D1Driver`, `raw`          |

## Package Separation

- **`@ottabase/db`**: Database layer (Drizzle/D1 driver)
- **`@ottabase/cf`**: Cloudflare bindings (D1, KV, R2, Queues, etc.)
