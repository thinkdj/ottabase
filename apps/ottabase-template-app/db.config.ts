// ============================================================
// Database Configuration for Ottabase Template App
// ============================================================
//
// This file configures the database layer for this application.
// Run: pnpm db:generate after making changes.
//
// ============================================================

import { defineAppDbConfig } from '@ottabase/db/config';

export default defineAppDbConfig({
    appId: 'ottabase-template-app',

    // Database provider (default: "d1" for Cloudflare D1)
    dbProvider: 'd1',

    // Feature packages to enable (adds models to schema)
    features: [
        // "auth",  // Uncomment to add authentication models
    ],

    // Path to app-specific schema
    appSchemaPath: 'ottabase/prisma/app.schema.prisma',

    // Output path for generated schema
    outputSchemaPath: 'prisma/schema.prisma',

    // ============================================================
    // D1 CONFIGURATION
    // ============================================================

    // D1 database binding name (must match wrangler.jsonc)
    d1Database: 'OBCF_D1',

    // Wrangler config file path
    wranglerConfig: 'wrangler.jsonc',

    // Auto-apply migrations in development (use with caution)
    autoApplyMigrations: false,
});
