// ============================================================
// @ottabase/ottaorm - Tag table schema
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Tag table schema
 */
export const tagsTable = sqliteTable('tags', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    // App identifier for multi-app database sharing (nullable, opt-in)
    appId: text('app_id'),
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

/**
 * Tag model type
 */
export type TagType = typeof tagsTable.$inferSelect;
export type NewTagType = typeof tagsTable.$inferInsert;
