// ============================================================
// @ottabase/ottaorm - Organization (Tenant) table schema
// ============================================================

import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Organization table schema
 * Top-level tenant entity for multi-tenant SaaS
 */
export const organizationsTable = sqliteTable(
    'organizations',
    {
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
        createdAt: integer('created_at')
            .$defaultFn(() => Date.now())
            .notNull(),
        updatedAt: integer('updated_at')
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now())
            .notNull(),
    },
    (t) => ({
        // The organizations RLS policy falls back to filtering by ownerId, and "my owned orgs"
        // is a common lookup. slug is already covered by its UNIQUE index.
        ownerIdx: index('organizations_owner_idx').on(t.ownerId),
    }),
);

/**
 * Organization model type
 */
export type OrganizationType = typeof organizationsTable.$inferSelect;
export type NewOrganizationType = typeof organizationsTable.$inferInsert;
