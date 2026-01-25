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
  accountsTable,
  authenticatorsTable,
  postsTable,
  postTagsTable,
  sessionsTable,
  tagsTable,
  usersTable,
  verificationTokensTable,
} from "@ottabase/ottaorm";
import {
  postsTable as blogPostsTable,
  categoriesTable as blogCategoriesTable,
  tagsTable as blogTagsTable,
  postTagsTable as blogPostTagsTable,
} from "@ottabase/ottablog/schema";
import { getEnabledPackageTables } from "../config.migrations";
import { todosTable } from "../models/Todo";

/**
 * Get all table schemas organized by source
 */
export function getAllSchemas() {
  // 1. Core schemas from @ottabase/ottaorm (users, posts, auth tables, etc.)
  const coreTables = {
    accountsTable,
    authenticatorsTable,
    postsTable,
    postTagsTable,
    sessionsTable,
    tagsTable,
    usersTable,
    verificationTokensTable,
  };

  // 2. App-specific schemas
  const appTables = {
    todosTable,
    // Blog tables from @ottabase/ottablog
    blogPostsTable,
    blogCategoriesTable,
    blogTagsTable,
    blogPostTagsTable,
  };

  // 3. Package schemas from enabled packages (shortlinks, etc.)
  const packageTables = getEnabledPackageTables();

  // Combine all schemas
  // Note: Later entries override earlier ones if there are duplicates
  const allSchemas = {
    ...coreTables,
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
    postsTable,
    postTagsTable,
    sessionsTable,
    tagsTable,
    usersTable,
    verificationTokensTable,
  };

  const appTables = {
    todosTable,
    blogPostsTable,
    blogCategoriesTable,
    blogTagsTable,
    blogPostTagsTable,
  };

  const packageTables = getEnabledPackageTables();

  return {
    core: Object.keys(coreTables),
    app: Object.keys(appTables),
    packages: Object.keys(packageTables),
    total: Object.keys({ ...coreTables, ...appTables, ...packageTables })
      .length,
  };
}
