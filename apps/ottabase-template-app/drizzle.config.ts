// ============================================================
// Drizzle Kit Configuration (ottabase-template-app)
// ============================================================
//
// This configuration enables "codebase first" approach using drizzle-kit push.
// No SQL migration files - schema TypeScript is the single source of truth.
//
// Commands:
//   pnpm db:push   - Push schema changes to D1
//   pnpm db:studio - Open Drizzle Studio for database browsing
//
// ============================================================

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    // Schema location - combines CORE + APP tables
    schema: './ottabase/db/schema.ts',

    // Output directory for drizzle introspection
    out: './drizzle',

    // Database dialect - SQLite for Cloudflare D1
    dialect: 'sqlite',

    // D1 HTTP driver for Cloudflare
    driver: 'd1-http',

    // D1 credentials (set via environment variables or wrangler)
    dbCredentials: {
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
        databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID || '',
        token: process.env.CLOUDFLARE_API_TOKEN || '',
    },

    // Verbose output for debugging
    verbose: true,

    // Strict mode for safer schema operations
    strict: true,
});
