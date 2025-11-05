# Ottabase Core Schemas

Modular Prisma schemas for selective inclusion in your applications.

## Available Schemas

- **`base.schema.prisma`** - Generator/datasource template (dynamically configured per app)
- **`user.schema.prisma`** - User authentication model
- **`post.schema.prisma`** - Blog/content management model

## Configuration

Configure in `prisma.config.js`:

```javascript
const { definePrismaConfig } = require("@ottabase/db/prisma");

module.exports = definePrismaConfig({
  coreSchemas: ["user", "post"],        // Select schemas
  datasource: "d1",                      // Database type (default: d1)
  appSchemaPath: "ottabase/prisma/app.schema.prisma",
  outputSchemaPath: "prisma/schema.prisma",
});
```

## Datasources

| Type | Description |
|------|-------------|
| `d1` | Cloudflare D1 (default, serverless SQLite) |
| `postgresql` | PostgreSQL |
| `mysql` | MySQL/MariaDB |
| `sqlite` | Local SQLite |
| `sqlserver` | SQL Server |
| `mongodb` | MongoDB |
| `cockroachdb` | CockroachDB |

### D1 (Default)

Cloudflare D1 generates special configuration with setup instructions and automatically transforms incompatible schema attributes:

```javascript
datasource: "d1"  // Default
```

**Automatic Transformations:**
- Removes `@db.Text` (SQLite maps `String` → `TEXT` by default)
- Future transformations for other SQLite/D1 incompatibilities

Generated schema includes helpful comments:
```prisma
// Cloudflare D1 Configuration
// Requires: @prisma/adapter-d1 package installed
// Setup: npm install @prisma/adapter-d1
// Runtime: Initialize PrismaClient with D1 adapter

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

## Adding Schemas

1. Create `[name].schema.prisma` with models only (no generator/datasource)
2. Update `CoreSchemaName` type in [index.ts](index.ts)
3. Document in this README

## Schema Transformations

The generator automatically transforms schemas for datasource compatibility:

| Datasource | Transformations |
|------------|-----------------|
| `d1`, `sqlite` | Removes `@db.Text` (uses default `String` → `TEXT`) |
| Others | No transformations applied |

This allows you to write schemas with database-specific optimizations (like `@db.Text` for PostgreSQL) while maintaining compatibility with SQLite/D1.

## Notes

- Base configuration is auto-generated based on `datasource` setting
- Model schemas contain only model definitions
- Transformations are logged during generation (e.g., "⚙️ Removed @db.Text attributes")
- Run `pnpm db:generate` to concatenate schemas
