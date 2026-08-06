// ============================================================
// Database Schema (otta-web)
// ============================================================
//
// This file exports all Drizzle table schemas for the application.
// It combines CORE tables from @ottabase/ottaorm + APP-SPECIFIC tables.
//
// Usage with drizzle-kit push (codebase first approach):
//   pnpm db:push   - Push schema changes to D1
//   pnpm db:studio - Open Drizzle Studio for database browsing
//
// The TypeScript schema is the single source of truth.
// No SQL migration files needed - drizzle-kit handles everything.
// ============================================================

// ============================================================
// CORE TABLES (from @ottabase/ottaorm)
// ============================================================
import { commentsTable } from '@ottabase/comments/schema';
import {
    categoriesTable,
    ottablogPluginsTable,
    ottablogThemesTable,
    postCategoryLinksTable,
    postTagLinksTable,
    postTagsTable,
    postVersionsTable,
    postsTable,
    seriesTable,
} from '@ottabase/ottablog';
import {
    accountsTable,
    authenticatorsTable,
    mediaTable,
    sessionsTable,
    usersTable,
    verificationTokensTable,
} from '@ottabase/ottaorm';
import { referralTrackingTable } from '@ottabase/referrals';
import { shortlinksTable } from '@ottabase/shortlinks';

export { accountsTable, authenticatorsTable, mediaTable, sessionsTable, usersTable, verificationTokensTable };

// ============================================================
// APP-SPECIFIC TABLES
// ============================================================
export { todosTable } from '../models/Todo';

// ============================================================
// PACKAGE TABLES (from enabled packages)
// ============================================================
// Statically re-exported so drizzle-kit sees them without evaluating config.
export { aiProviderCredentialsTable } from '@ottabase/ottaai/schema';
export {
    categoriesTable,
    commentsTable,
    ottablogPluginsTable,
    ottablogThemesTable,
    postCategoryLinksTable,
    postTagLinksTable,
    postTagsTable,
    postVersionsTable,
    postsTable,
    referralTrackingTable,
    seriesTable,
    shortlinksTable,
};

// ============================================================
// PREMIUM PACKAGE TABLES (installed in config.premium.ts)
// ============================================================
// Re-exported statically for the same reason as the package tables above: drizzle-kit
// reads this module's NAMED EXPORTS and never evaluates config, so a table reachable only
// through `packageTables` below is invisible to `db:push`.
//
// Remove this block along with the package if you uninstall @ottabase/premium-webhooks.
export { webhookDeliveriesTable, webhookEndpointsTable } from '@ottabase/premium-webhooks/schema';

// ============================================================
// DYNAMIC PACKAGE TABLES (Configured in config.migrations.ts)
// ============================================================
import { getEnabledPackageTables } from '../config.migrations';

export const packageTables = getEnabledPackageTables();
