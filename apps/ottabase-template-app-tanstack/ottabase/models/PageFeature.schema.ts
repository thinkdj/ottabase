/**
 * PageFeature Schema
 *
 * Features are child items within a section (e.g., feature cards, benefits list).
 */
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { pageSectionsTable } from './PageSection.schema';

export const pageFeaturesTable = sqliteTable('page_features', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),

    // Reference to parent section
    sectionId: text('section_id')
        .notNull()
        .references(() => pageSectionsTable.id, { onDelete: 'cascade' }),

    // Content
    title: text('title').notNull(),
    description: text('description'),

    // Visual
    icon: text('icon'), // Lucide icon name
    imageUrl: text('image_url'),

    // Optional link
    href: text('href'),
    external: integer('external', { mode: 'boolean' }).default(false),

    // Sort order
    sortOrder: integer('sort_order').notNull().default(0),

    // Timestamps
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

export type PageFeatureRow = typeof pageFeaturesTable.$inferSelect;
export type NewPageFeatureRow = typeof pageFeaturesTable.$inferInsert;
