// ============================================================
// Homepage Section table (App-specific)
// ============================================================

import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const homepageSectionsTable = sqliteTable(
    'homepage_sections',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        /** Slot name: navbar, hero, features, cta, footer, about */
        slot: text('slot').notNull(),
        title: text('title'),
        subtitle: text('subtitle'),
        body: text('body'),
        /** Optional GitHub URL (used by navbar/about slots) */
        githubUrl: text('github_url'),
        /** Display order for listing */
        sortOrder: integer('sort_order').notNull().default(0),
        /** Multi-app identifier */
        appId: text('app_id'),
        createdAt: integer('created_at')
            .$defaultFn(() => Date.now())
            .notNull(),
        updatedAt: integer('updated_at')
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now())
            .notNull(),
    },
    (table) => [
        index('homepage_sections_slot_idx').on(table.slot),
        index('homepage_sections_app_slot_idx').on(table.appId, table.slot),
    ],
);

export type HomepageSectionRow = typeof homepageSectionsTable.$inferSelect;
export type NewHomepageSectionRow = typeof homepageSectionsTable.$inferInsert;
