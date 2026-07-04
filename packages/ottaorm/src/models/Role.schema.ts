// ============================================================
// @ottabase/ottaorm - Role table schema
// ============================================================

import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Role table schema for RBAC
 *
 * Built-in roles: admin, editor, viewer, member
 * Custom roles can be added as needed
 *
 * Multi-tenant: `organizationId` scopes a role definition to an organization. A NULL
 * `organizationId` is a system/global role (the seeded defaults) that every org can use;
 * a non-null value is a tenant's own custom role. Two orgs may each define a role with the
 * same name — the composite unique index keys uniqueness by (organizationId, name).
 */
export const rolesTable = sqliteTable(
    'roles',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        // Owning organization. NULL = system/global role, shared across all tenants.
        organizationId: text('organization_id'),
        // Not column-level UNIQUE: uniqueness is per (organizationId, name), see roles_org_name_unique.
        name: text('name').notNull(),
        description: text('description'),
        // JSON array of permission names
        permissions: text('permissions')
            .notNull()
            .$defaultFn(() => '[]'),
        // System roles cannot be deleted
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
    (t) => ({
        // One role name per org. (SQLite treats NULL organization_id as distinct, so global-role
        // name uniqueness is additionally guarded in the seed/create paths; org-scoped roles are
        // fully DB-enforced here.)
        orgNameUnique: uniqueIndex('roles_org_name_unique').on(t.organizationId, t.name),
        // RLS/admin listing filters roles by their owning organization.
        orgIdx: index('roles_org_idx').on(t.organizationId),
    }),
);

/**
 * Role model type
 */
export type RoleType = typeof rolesTable.$inferSelect;
export type NewRoleType = typeof rolesTable.$inferInsert;
