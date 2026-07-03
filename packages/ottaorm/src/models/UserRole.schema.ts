// ============================================================
// @ottabase/ottaorm - UserRole junction table schema
// ============================================================

import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { rolesTable } from './Role.schema';
import { usersTable } from './User.schema';

/**
 * UserRole junction table for many-to-many relationship
 * between users and roles
 *
 * Hierarchy: Tenant > App > User (RBAC)
 * - User can have different roles in different organizations
 * - User can have different roles in different apps within same organization
 */
export const userRolesTable = sqliteTable(
    'user_roles',
    {
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
        assignedAt: integer('assigned_at')
            .$defaultFn(() => Date.now())
            .notNull(),
        assignedBy: text('assigned_by'),
    },
    (table) => ({
        // Composite key: user can have same role in different orgs/apps
        pk: primaryKey({ columns: [table.userId, table.roleId, table.organizationId] }),
        // RBAC resolves a user's roles within an org: WHERE user_id = ? AND organization_id = ?.
        // The composite PK leads with user_id but interleaves role_id, so it can't serve this
        // filter efficiently — an explicit (user_id, organization_id) index does.
        userOrgIdx: index('user_roles_user_org_idx').on(table.userId, table.organizationId),
        // Reverse lookup: which users hold a given role (e.g. role deletion/impact checks).
        roleIdx: index('user_roles_role_idx').on(table.roleId),
    }),
);

/**
 * UserRole model type
 */
export type UserRoleType = typeof userRolesTable.$inferSelect;
export type NewUserRoleType = typeof userRolesTable.$inferInsert;
