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
    userGroupMembersTable,
    userGroupsTable,
    userRolesTable,
    usersTable,
    verificationTokensTable,
} from '@ottabase/ottaorm';
import { notificationPreferencesTable, notificationsTable } from '@ottabase/notifications';
import { getEnabledPackageTables } from '../config.migrations';
import { todosTable } from '../models/Todo';

/** Core tables every app has: auth, tenancy, RBAC, media, and the in-app inbox */
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
    userGroupsTable,
    userGroupMembersTable,
    // The inbox behind the bell, and its per-person preferences
    notificationsTable,
    notificationPreferencesTable,
};

/** App-specific tables */
const appTables = {
    todosTable,
};

/**
 * Get all table schemas organized by source
 */
export function getAllSchemas() {
    // Package schemas come from the enabled packages (ottablog, shortlinks, referrals, etc.).
    // Later entries override earlier ones if there are duplicates.
    return {
        ...coreTables,
        ...appTables,
        ...getEnabledPackageTables(),
    };
}

/**
 * Get schema breakdown for debugging/status
 */
export function getSchemaSummary() {
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
