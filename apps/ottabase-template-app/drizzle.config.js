// ============================================================
// Drizzle Kit Configuration (ottabase-template-app)
// ============================================================
//
// This configuration enables "codebase first" migrations (Option 2)
// for Cloudflare D1 using drizzle-kit.
//
// Commands:
//   pnpm db:generate       - Generate SQL migrations from schema changes
//   pnpm db:migrate        - Apply migrations to local D1
//   pnpm db:migrate:remote - Apply migrations to remote D1
//   pnpm db:studio         - Open Drizzle Studio for database browsing
//
// ============================================================

/** @type {import('drizzle-kit').Config} */
const config = {
  // Schema location - exports all Drizzle table definitions
  schema: "./ottabase/db/schema.ts",

  // Output directory for generated migrations
  out: "./drizzle/migrations",

  // Database dialect - SQLite for Cloudflare D1
  dialect: "sqlite",

  // Database credentials for D1 (optional - mainly for studio)
  // These can be set via environment variables for remote access:
  //   CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID, CLOUDFLARE_D1_TOKEN
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || "",
    databaseId: process.env.CLOUDFLARE_DATABASE_ID || "",
    token: process.env.CLOUDFLARE_D1_TOKEN || "",
  },

  // Verbose output for debugging
  verbose: true,

  // Strict mode for safer migrations
  strict: true,
};

module.exports = config;
