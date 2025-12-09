// ============================================================
// Database Configuration for Ottabase Template App
// ============================================================
//
// This file configures the database layer for this application.
// Run: pnpm db:generate after making changes.
//
// ============================================================

import { defineAppDbConfig } from "@ottabase/db/prisma";

export default defineAppDbConfig({
  appId: "ottabase-template-app",

  // Database provider (default: "d1" for Cloudflare D1)
  dbProvider: "d1",

  // Feature packages to enable
  // Note: Auth uses OttaORM migrations (not Prisma schema)
  // Auth tables are in OttaORM core migrations when using Drizzle
  features: [],

  // Path to app-specific schema
  appSchemaPath: "ottabase/prisma/app.schema.prisma",

  // Output path for generated schema
  outputSchemaPath: "prisma/schema.prisma",

  // ============================================================
  // D1 CONFIGURATION
  // ============================================================

  // D1 database binding name (must match wrangler.jsonc)
  d1Database: "DB",

  // Wrangler config file path
  wranglerConfig: "wrangler.jsonc",

  // Auto-apply migrations in development (use with caution)
  autoApplyMigrations: false,
});
