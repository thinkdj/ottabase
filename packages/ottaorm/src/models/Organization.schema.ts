// ============================================================
// @ottabase/ottaorm - Organization (Tenant) table schema
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Organization table schema
 * Top-level tenant entity for multi-tenant SaaS
 */
export const organizationsTable = sqliteTable('organizations', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => `org-${crypto.randomUUID()}`),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    ownerId: text('owner_id'),
    plan: text('plan').default('free'), // free, pro, enterprise
    status: text('status').default('active'), // active, suspended, cancelled
    settings: text('settings', { mode: 'json' }).$type<Record<string, any>>(),
    metadata: text('metadata', { mode: 'json' }).$type<Record<string, any>>(),
    createdAt: integer('created_at', { mode: 'timestamp' })
        .$defaultFn(() => new Date())
        .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
        .$defaultFn(() => new Date())
        .$onUpdateFn(() => new Date())
        .notNull(),
});

/**
 * Organization model type
 */
export type OrganizationType = typeof organizationsTable.$inferSelect;
export type NewOrganizationType = typeof organizationsTable.$inferInsert;
