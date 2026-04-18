// ============================================================
// Schema Collection Helper (otta-web)
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

// Blog tables are included via package registry (getEnabledPackageTables)
// No need to import them directly here to avoid duplication
import {
    accountsTable,
    auditLogsTable,
    authenticatorsTable,
    mediaTable,
    organizationMembersTable,
    organizationsTable,
    permissionsTable,
    rolesTable,
    scheduledTasksTable,
    sessionsTable,
    tagsTable,
    userRolesTable,
    usersTable,
    verificationTokensTable,
} from '@ottabase/ottaorm';
import { getEnabledPackageTables } from '../config.migrations';
import { todosTable } from '../models/Todo';

/**
 * Get all table schemas organized by source
 */
export function getAllSchemas() {
    // 1. Core schemas from @ottabase/ottaorm (users, auth tables, etc.)
    const coreTables = {
        accountsTable,
        authenticatorsTable,
        mediaTable,
        sessionsTable,
        tagsTable,
        usersTable,
        verificationTokensTable,
        scheduledTasksTable,
        // Multi-tenant/RBAC tables
        organizationsTable,
        organizationMembersTable,
        rolesTable,
        permissionsTable,
        userRolesTable,
        auditLogsTable,
    };

    // 2. App-specific schemas
    const appTables = {
        todosTable,
    };

    // 3. Package schemas from enabled packages (ottablog, shortlinks, referrals, etc.)
    // This includes blog tables (posts, categories, series, etc.) from ottablog package
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
        mediaTable,
        sessionsTable,
        tagsTable,
        usersTable,
        verificationTokensTable,
        scheduledTasksTable,
        // Multi-tenant/RBAC tables
        organizationsTable,
        organizationMembersTable,
        rolesTable,
        permissionsTable,
        userRolesTable,
        auditLogsTable,
    };

    const appTables = {
        todosTable,
    };

    const packageTables = getEnabledPackageTables();

    return {
        core: Object.keys(coreTables),
        app: Object.keys(appTables),
        packages: Object.keys(packageTables),
        total: Object.keys({
            ...coreTables,
            ...appTables,
            ...packageTables,
        }).length,
    };
}
