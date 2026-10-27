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
export { accountsTable, mediaTable, usersTable, verificationTokensTable } from '@ottabase/ottaorm';

// ============================================================
// APP-SPECIFIC TABLES
// ============================================================
export { todosTable } from '../models/Todo'; // otta:only demo

// ============================================================
// PACKAGE TABLES (from enabled packages)
// ============================================================
// Statically re-exported so drizzle-kit sees them without evaluating config. One statement per
// package: the shape `otta add` writes and `otta strip` removes.
export { aiProviderCredentialsTable } from '@ottabase/ottaai/schema';
export { apiKeysTable } from '@ottabase/apikeys/schema';
export { flagOverridesTable } from '@ottabase/flags/schema';
export { meterBalancesTable, meterUsageTable } from '@ottabase/meter/schema';
export { emailSuppressionsTable } from '@ottabase/postmaster/schema';
export { alertChannelsTable, alertDeliveriesTable, alertEventsTable, alertKeysTable } from '@ottabase/alerts/schema';
export {
    brandKitsTable,
    layoutRouteMappingsTable,
    layoutTemplatesTable,
    menuItemsTable,
    menuSlotAssignmentsTable,
    menusTable,
} from '@ottabase/brand-engine/persistence';
export { commentReactionsTable, commentsTable } from '@ottabase/comments/schema';
export { landingLeadsTable, landingPagesTable, landingSitesTable } from '@ottabase/ottalanding/schema';
export {
    categoriesTable,
    ottablogPluginsTable,
    ottablogSettingsTable,
    ottablogThemesTable,
    postCategoryLinksTable,
    postsTable,
    postTagLinksTable,
    postTagsTable,
    postTranslationsTable,
    postVersionsTable,
    seriesTable,
} from '@ottabase/ottablog';
export { referralTrackingTable } from '@ottabase/referrals';
export { shortlinksTable } from '@ottabase/shortlinks';

// ============================================================
// PREMIUM PACKAGE TABLES (listed in ottabase/packages.ts)
// ============================================================
// Re-exported statically for the same reason as the package tables above: drizzle-kit
// reads this module's NAMED EXPORTS and never evaluates config, so a table reachable only
// through the runtime registry (ottabase/packages.ts) is invisible to `db:push`.
export { webhookDeliveriesTable, webhookEndpointsTable } from '@ottabase/webhooks/schema';
