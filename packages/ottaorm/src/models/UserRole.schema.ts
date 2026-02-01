// ============================================================
// @ottabase/ottaorm - UserRole junction table schema
// ============================================================

import { integer, sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';
import { usersTable } from './User.schema';
import { rolesTable } from './Role.schema';

/**
 * UserRole junction table for many-to-many relationship
 * between users and roles
 */
export const userRolesTable = sqliteTable('user_roles', {
    userId: text('user_id')
        .notNull()
        .references(() => usersTable.id, { onDelete: 'cascade' }),
    roleId: text('role_id')
        .notNull()
        .references(() => rolesTable.id, { onDelete: 'cascade' }),
    // Optional: organization/tenant scoping
    organizationId: text('organization_id'),
    assignedAt: integer('assigned_at', { mode: 'timestamp' })
        .$defaultFn(() => new Date())
        .notNull(),
    assignedBy: text('assigned_by'),
}, (table) => ({
    pk: primaryKey({ columns: [table.userId, table.roleId] }),
}));

/**
 * UserRole model type
 */
export type UserRoleType = typeof userRolesTable.$inferSelect;
export type NewUserRoleType = typeof userRolesTable.$inferInsert;
