const { definePrismaConfig } = require("@ottabase/db/prisma");

/**
 * Prisma Schema Configuration
 *
 * Select core schemas and configure your database datasource.
 * Run `pnpm db:generate` after changes.
 */
module.exports = definePrismaConfig({
  // Core schemas to include: "user", "post"
  coreSchemas: ["user", "post"],

  // Database datasource (default: "d1")
  // Options: "d1", "postgresql", "mysql", "sqlite", "sqlserver", "mongodb", "cockroachdb"
  //
  // D1 Setup (default):
  //   1. Install: npm install @prisma/adapter-d1
  //   2. Initialize PrismaClient with D1 adapter in your worker
  //   3. Docs: https://www.prisma.io/docs/orm/overview/databases/cloudflare-d1
  datasource: "d1",

  // Schema paths (relative to app root)
  appSchemaPath: "ottabase/prisma/app.schema.prisma",
  outputSchemaPath: "prisma/schema.prisma",
});
