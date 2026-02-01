// ============================================================
// @ottabase/ottaorm - Permission table schema
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Permission table schema for RBAC
 *
 * Permissions follow format: resource:action
 * Examples: users:read, users:create, users:update, users:delete
 */
export const permissionsTable = sqliteTable('permissions', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull().unique(),
    description: text('description'),
    // Resource type (e.g., 'users', 'posts', 'settings')
    resource: text('resource').notNull(),
    // Action (e.g., 'create', 'read', 'update', 'delete', 'manage')
    action: text('action').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
        .$defaultFn(() => new Date())
        .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
        .$defaultFn(() => new Date())
        .$onUpdateFn(() => new Date())
        .notNull(),
});

/**
 * Permission model type
 */
export type PermissionType = typeof permissionsTable.$inferSelect;
export type NewPermissionType = typeof permissionsTable.$inferInsert;
