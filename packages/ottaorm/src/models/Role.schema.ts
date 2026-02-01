// ============================================================
// @ottabase/ottaorm - Role table schema
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Role table schema for RBAC
 *
 * Built-in roles: admin, editor, viewer
 * Custom roles can be added as needed
 */
export const rolesTable = sqliteTable('roles', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull().unique(),
    description: text('description'),
    // JSON array of permission names
    permissions: text('permissions').notNull().$defaultFn(() => '[]'),
    // System roles cannot be deleted
    isSystem: integer('is_system', { mode: 'boolean' }).$defaultFn(() => false).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
        .$defaultFn(() => new Date())
        .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
        .$defaultFn(() => new Date())
        .$onUpdateFn(() => new Date())
        .notNull(),
});

/**
 * Role model type
 */
export type RoleType = typeof rolesTable.$inferSelect;
export type NewRoleType = typeof rolesTable.$inferInsert;
