// ============================================================
// @ottabase/ottaorm - UserRole junction table schema
// ============================================================

import { integer, sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';
import { usersTable } from './User.schema';
import { rolesTable } from './Role.schema';

/**
 * UserRole junction table for many-to-many relationship
 * between users and roles
 *
 * Hierarchy: Tenant > App > User (RBAC)
 * - User can have different roles in different organizations
 * - User can have different roles in different apps within same organization
 */
export const userRolesTable = sqliteTable('user_roles', {
    userId: text('user_id')
        .notNull()
        .references(() => usersTable.id, { onDelete: 'cascade' }),
    roleId: text('role_id')
        .notNull()
        .references(() => rolesTable.id, { onDelete: 'cascade' }),
    // Tenant/organization scoping (REQUIRED for multi-tenant)
    organizationId: text('organization_id').notNull(),
    // App scoping (OPTIONAL - null means role applies to all apps)
    appId: text('app_id'),
    assignedAt: integer('assigned_at', { mode: 'timestamp' })
        .$defaultFn(() => new Date())
        .notNull(),
    assignedBy: text('assigned_by'),
}, (table) => ({
    // Composite key: user can have same role in different orgs/apps
    pk: primaryKey({ columns: [table.userId, table.roleId, table.organizationId] }),
}));

/**
 * UserRole model type
 */
export type UserRoleType = typeof userRolesTable.$inferSelect;
export type NewUserRoleType = typeof userRolesTable.$inferInsert;
