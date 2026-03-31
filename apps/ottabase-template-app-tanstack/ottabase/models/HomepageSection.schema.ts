// ============================================================
// Homepage section (per slot: navbar, hero, features, cta, footer, about)
// ============================================================

import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const homepageSectionsTable = sqliteTable(
    'homepage_sections',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        slot: text('slot').notNull(),
        title: text('title'),
        subtitle: text('subtitle'),
        description: text('description'),
        body: text('body'),
        /** Navbar / footer structured JSON — validate with @ottabase/homepage-contract when reading/writing */
        contentJson: text('content_json', { mode: 'json' }).$type<unknown | null>(),
        isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
        sortOrder: integer('sort_order').default(0).notNull(),
        createdAt: integer('created_at')
            .$defaultFn(() => Date.now())
            .notNull(),
        updatedAt: integer('updated_at')
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now())
            .notNull(),
    },
    (table) => [
        uniqueIndex('homepage_sections_slot_uidx').on(table.slot),
        index('homepage_sections_active_sort_idx').on(table.isActive, table.sortOrder),
    ],
);

export type HomepageSectionRow = typeof homepageSectionsTable.$inferSelect;
export type NewHomepageSectionRow = typeof homepageSectionsTable.$inferInsert;
