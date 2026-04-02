// ============================================================
// Homepage Feature table (App-specific)
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { homepageSectionsTable } from './HomepageSection.schema';

export const homepageFeaturesTable = sqliteTable('homepage_features', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    /** Parent section (typically the "features" slot) */
    sectionId: text('section_id')
        .notNull()
        .references(() => homepageSectionsTable.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull(),
    /** Lucide icon name (e.g. 'Zap', 'Shield', 'Globe') */
    icon: text('icon'),
    /** Optional image URL for visual features */
    imageUrl: text('image_url'),
    /** Optional link destination */
    href: text('href'),
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

export type HomepageFeatureRow = typeof homepageFeaturesTable.$inferSelect;
export type NewHomepageFeatureRow = typeof homepageFeaturesTable.$inferInsert;
