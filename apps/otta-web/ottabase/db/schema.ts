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
import { commentReactionsTable, commentsTable } from '@ottabase/comments/schema';
import {
    categoriesTable,
    ottablogPluginsTable,
    ottablogThemesTable,
    ottablogSettingsTable,
    postTranslationsTable,
    postCategoryLinksTable,
    postTagLinksTable,
    postTagsTable,
    postVersionsTable,
    postsTable,
    seriesTable,
} from '@ottabase/ottablog';
import { accountsTable, mediaTable, usersTable, verificationTokensTable } from '@ottabase/ottaorm';
import { landingLeadsTable, landingPagesTable, landingSitesTable } from '@ottabase/ottalanding/schema';
import { referralTrackingTable } from '@ottabase/referrals';
import { shortlinksTable } from '@ottabase/shortlinks';

export { accountsTable, mediaTable, usersTable, verificationTokensTable };

// ============================================================
// APP-SPECIFIC TABLES
// ============================================================
export { todosTable } from '../models/Todo';

// ============================================================
// PACKAGE TABLES (from enabled packages)
// ============================================================
// Statically re-exported so drizzle-kit sees them without evaluating config.
export { aiProviderCredentialsTable } from '@ottabase/ottaai/schema';
export { apiKeysTable } from '@ottabase/apikeys/schema';
export { flagOverridesTable } from '@ottabase/flags/schema';
export { meterBalancesTable, meterUsageTable } from '@ottabase/meter/schema';
export { emailSuppressionsTable } from '@ottabase/postmaster/schema';
export {
    brandKitsTable,
    layoutRouteMappingsTable,
    layoutTemplatesTable,
    menuItemsTable,
    menuSlotAssignmentsTable,
    menusTable,
} from '@ottabase/brand-engine/persistence';
export {
    categoriesTable,
    commentsTable,
    commentReactionsTable,
    landingLeadsTable,
    landingPagesTable,
    landingSitesTable,
    ottablogPluginsTable,
    ottablogThemesTable,
    ottablogSettingsTable,
    postTranslationsTable,
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
// PREMIUM PACKAGE TABLES (listed in ottabase/packages.ts)
// ============================================================
// Re-exported statically for the same reason as the package tables above: drizzle-kit
// reads this module's NAMED EXPORTS and never evaluates config, so a table reachable only
// through the runtime registry (ottabase/packages.ts) is invisible to `db:push`.
//
// Remove this block along with the package if you uninstall @ottabase/webhooks.
export { webhookDeliveriesTable, webhookEndpointsTable } from '@ottabase/webhooks/schema';
