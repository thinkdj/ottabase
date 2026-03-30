// ============================================================
// Homepage Action table (App-specific)
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { homepageSectionsTable } from './HomepageSection.schema';

export const homepageActionsTable = sqliteTable('homepage_actions', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    /** Parent section (hero, cta, about, etc.) */
    sectionId: text('section_id')
        .notNull()
        .references(() => homepageSectionsTable.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    href: text('href').notNull(),
    /** Button style variant: default, secondary, outline, ghost */
    variant: text('variant').default('default'),
    /** Whether the link opens in a new tab */
    external: integer('external', { mode: 'boolean' }).default(false),
    /** Display order */
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

export type HomepageActionRow = typeof homepageActionsTable.$inferSelect;
export type NewHomepageActionRow = typeof homepageActionsTable.$inferInsert;
