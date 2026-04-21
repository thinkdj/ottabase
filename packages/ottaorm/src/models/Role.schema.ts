// ============================================================
// @ottabase/ottaorm - Role table schema
// ============================================================

import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Role table schema for RBAC.
 *
 * System roles (isSystem=true) have a NULL organizationId and are shared
 * across all tenants. Custom roles always carry a non-null organizationId so
 * every tenant has its own isolated role namespace.
 *
 * Uniqueness: (name, organizationId) is unique. Because SQLite treats NULLs as
 * distinct in unique indexes, system-role uniqueness is additionally enforced at
 * the application layer inside Role.ensureDefaults().
 */
export const rolesTable = sqliteTable(
    'roles',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        name: text('name').notNull(),
        // NULL  → system / platform-wide role (isSystem=true, shared across tenants)
        // <id>  → tenant-specific custom role (isSystem=false, visible only to that org)
        organizationId: text('organization_id'),
        description: text('description'),
        // JSON array of permission strings e.g. '["blog:read","blog:write"]'
        permissions: text('permissions')
            .notNull()
            .$defaultFn(() => '[]'),
        // System roles cannot be modified or deleted
        isSystem: integer('is_system', { mode: 'boolean' })
            .$defaultFn(() => false)
            .notNull(),
        createdAt: integer('created_at')
            .$defaultFn(() => Date.now())
            .notNull(),
        updatedAt: integer('updated_at')
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now())
            .notNull(),
    },
    (table) => ({
        // One role name per (organization). System roles (org=NULL) get separate
        // enforcement because SQLite treats NULL!=NULL in unique indexes.
        nameOrgUniq: uniqueIndex('roles_name_org_uniq').on(table.name, table.organizationId),
    }),
);

/**
 * Role model type
 */
export type RoleType = typeof rolesTable.$inferSelect;
export type NewRoleType = typeof rolesTable.$inferInsert;
