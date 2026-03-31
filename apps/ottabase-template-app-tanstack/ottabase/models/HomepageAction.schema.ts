// ============================================================
// Homepage CTA / nav action (belongs to a section)
// ============================================================

import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { homepageSectionsTable } from './HomepageSection.schema';

export const homepageActionsTable = sqliteTable(
    'homepage_actions',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        sectionId: text('section_id')
            .notNull()
            .references(() => homepageSectionsTable.id, { onDelete: 'cascade' }),
        label: text('label').notNull(),
        href: text('href').notNull(),
        variant: text('variant').default('default').notNull(),
        icon: text('icon'),
        isExternal: integer('is_external', { mode: 'boolean' }).default(false).notNull(),
        sortOrder: integer('sort_order').default(0).notNull(),
        createdAt: integer('created_at')
            .$defaultFn(() => Date.now())
            .notNull(),
        updatedAt: integer('updated_at')
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now())
            .notNull(),
    },
    (table) => [index('homepage_actions_section_sort_idx').on(table.sectionId, table.sortOrder)],
);

export type HomepageActionRow = typeof homepageActionsTable.$inferSelect;
export type NewHomepageActionRow = typeof homepageActionsTable.$inferInsert;
