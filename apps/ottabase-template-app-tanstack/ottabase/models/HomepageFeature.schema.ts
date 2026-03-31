// ============================================================
// Homepage feature row (belongs to a section, e.g. features grid)
// ============================================================

import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { homepageSectionsTable } from './HomepageSection.schema';

export const homepageFeaturesTable = sqliteTable(
    'homepage_features',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        sectionId: text('section_id')
            .notNull()
            .references(() => homepageSectionsTable.id, { onDelete: 'cascade' }),
        title: text('title').notNull(),
        description: text('description').notNull(),
        icon: text('icon'),
        sortOrder: integer('sort_order').default(0).notNull(),
        createdAt: integer('created_at')
            .$defaultFn(() => Date.now())
            .notNull(),
        updatedAt: integer('updated_at')
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now())
            .notNull(),
    },
    (table) => [index('homepage_features_section_sort_idx').on(table.sectionId, table.sortOrder)],
);

export type HomepageFeatureRow = typeof homepageFeaturesTable.$inferSelect;
export type NewHomepageFeatureRow = typeof homepageFeaturesTable.$inferInsert;
