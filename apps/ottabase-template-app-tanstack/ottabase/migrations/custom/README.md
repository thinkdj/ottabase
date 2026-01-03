# Custom Migrations

This directory is for your custom SQL migrations that run alongside the auto-generated migrations.

## Usage

Create migration files with this naming pattern:

```
0000_seed_initial_data.sql
0001_add_custom_indexes.sql
0002_create_views.sql
```

## Example

**0000_seed_admin_user.sql:**
```sql
-- Seed admin user
INSERT OR IGNORE INTO users (id, name, email, created_at, updated_at)
VALUES (
  'admin-001',
  'Admin User',
  'admin@example.com',
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);
```

**0001_add_performance_indexes.sql:**
```sql
-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_posts_author_published
ON posts(author_id, published);

CREATE INDEX IF NOT EXISTS idx_todos_user_completed
ON todos(user_id, completed);
```

## How It Works

1. Custom migrations are imported in `/ottabase/migrations/index.ts`
2. They run AFTER auto-generated table migrations
3. Each migration runs only once (tracked in `_ottabase_migrations` table)
4. Migrations are executed in alphabetical order

## Best Practices

- ✅ Use descriptive names: `0000_seed_data` not `migration1`
- ✅ Use `IF NOT EXISTS` / `OR IGNORE` for idempotency
- ✅ Keep migrations small and focused
- ✅ Test migrations in development first
- ⚠️ Don't modify past migrations (create new ones instead)
- ⚠️ Be careful with data migrations in production
