// ============================================================
// Every table auto-init should know about: core, then whatever the installed packages
// contribute (ottabase/packages.ts). `collectTableSchemas` picks up entries whose KEY ends
// in `Table`; the kernel refuses a manifest table under any other key.
// ============================================================

import {
    accountsTable,
    auditLogsTable,
    mediaTable,
    organizationMembersTable,
    organizationsTable,
    permissionsTable,
    rolesTable,
    scheduledTasksTable,
    tagsTable,
    userGroupMembersTable,
    userGroupsTable,
    userRolesTable,
    usersTable,
    verificationTokensTable,
} from '@ottabase/ottaorm';
import { packages } from '../packages';

const coreTables = {
    accountsTable,
    mediaTable,
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
};

export function getAllSchemas() {
    // Later entries override earlier ones; the kernel already refused duplicate package keys.
    return { ...coreTables, ...packages.tables() };
}

/** Schema breakdown for the admin Database page and for debugging. */
export function getSchemaSummary() {
    const packageTables = packages.tables();
    return {
        core: Object.keys(coreTables),
        packages: Object.keys(packageTables),
        byPackage: Object.fromEntries(packages.packages.map((pkg) => [pkg.key, Object.keys(pkg.tables ?? {})])),
        total: Object.keys(coreTables).length + Object.keys(packageTables).length,
    };
}
