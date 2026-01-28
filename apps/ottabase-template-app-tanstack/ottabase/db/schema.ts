// ============================================================
// Database Schema (ottabase-template-app-tanstack)
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
import {
  accountsTable,
  authenticatorsTable,
  sessionsTable,
  usersTable,
  verificationTokensTable,
} from "@ottabase/ottaorm";
import {
  categoriesTable,
  postTagLinksTable,
  postTagsTable,
  postVersionsTable,
  postsTable,
  seriesTable,
} from "@ottabase/ottablog";
import { referralTrackingTable } from "@ottabase/referrals";
import { shortlinksTable } from "@ottabase/shortlinks";

export {
  accountsTable,
  authenticatorsTable,
  sessionsTable,
  usersTable,
  verificationTokensTable,
};

// ============================================================
// APP-SPECIFIC TABLES
// ============================================================
export { todosTable } from "../models/Todo";

// ============================================================
// PACKAGE TABLES (from enabled packages)
// ============================================================
export {
  categoriesTable,
  postTagLinksTable,
  postTagsTable,
  postVersionsTable,
  postsTable,
  seriesTable,
  referralTrackingTable,
  shortlinksTable,
};

// ============================================================
// DYNAMIC PACKAGE TABLES (Configured in config.migrations.ts)
// ============================================================
import { getEnabledPackageTables } from "../config.migrations";

export const packageTables = getEnabledPackageTables();
