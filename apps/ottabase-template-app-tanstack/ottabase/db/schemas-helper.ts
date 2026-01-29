// ============================================================
// Schema Collection Helper (ottabase-template-app-tanstack)
// ============================================================
//
// This file provides utilities to collect and organize all table
// schemas from different sources:
// 1. CORE schemas (from @ottabase/ottaorm)
// 2. APP schemas (app-specific models like Todo)
// 3. PACKAGE schemas (from enabled packages)
//
// Usage in cloudflare-worker.ts:
// import { getAllSchemas } from './ottabase/db/schemas-helper';
// const allSchemas = getAllSchemas();
// await autoInit({ driver, schema: allSchemas, ... });
// ============================================================

import {
  postsTable,
  postTagLinksTable,
  postTagsTable,
} from "@ottabase/ottablog";
import {
  accountsTable,
  authenticatorsTable,
  scheduledTasksTable,
  sessionsTable,
  tagsTable,
  usersTable,
  verificationTokensTable,
} from "@ottabase/ottaorm";
import { getEnabledPackageTables } from "../config.migrations";
import { todosTable } from "../models/Todo";

/**
 * Get all table schemas organized by source
 */
export function getAllSchemas() {
  // 1. Core schemas from @ottabase/ottaorm (users, auth tables, etc.)
  const coreTables = {
    accountsTable,
    authenticatorsTable,
    sessionsTable,
    tagsTable,
    usersTable,
    verificationTokensTable,
    scheduledTasksTable,
  };

  // 2. Blog/Content schemas from @ottabase/ottablog
  const blogTables = {
    postsTable,
    postTagsTable,
    postTagLinksTable,
  };

  // 3. App-specific schemas
  const appTables = {
    todosTable,
  };

  // 4. Package schemas from enabled packages (shortlinks, etc.)
  const packageTables = getEnabledPackageTables();

  // Combine all schemas
  // Note: Later entries override earlier ones if there are duplicates
  const allSchemas = {
    ...coreTables,
    ...blogTables,
    ...appTables,
    ...packageTables,
  };

  return allSchemas;
}

/**
 * Get schema breakdown for debugging/status
 */
export function getSchemaSummary() {
  const coreTables = {
    accountsTable,
    authenticatorsTable,
    sessionsTable,
    tagsTable,
    usersTable,
    verificationTokensTable,
    scheduledTasksTable,
  };

  const blogTables = {
    postsTable,
    postTagsTable,
    postTagLinksTable,
  };

  const appTables = {
    todosTable,
  };

  const packageTables = getEnabledPackageTables();

  return {
    core: Object.keys(coreTables),
    blog: Object.keys(blogTables),
    app: Object.keys(appTables),
    packages: Object.keys(packageTables),
    total: Object.keys({
      ...coreTables,
      ...blogTables,
      ...appTables,
      ...packageTables,
    }).length,
  };
}
