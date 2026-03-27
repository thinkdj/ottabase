/**
 * PostCategoryLink table schema - junction table for Post <-> PostCategory many-to-many
 */
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { postsTable } from './Post.schema';
import { categoriesTable } from './PostCategory.schema';

export const postCategoryLinksTable = sqliteTable(
    'post_category_links',
    {
        // Single-column PK for OttaORM compatibility (find/delete by id)
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),

        postId: text('post_id')
            .notNull()
            .references(() => postsTable.id, { onDelete: 'cascade' }),

        categoryId: text('category_id')
            .notNull()
            .references(() => categoriesTable.id, { onDelete: 'cascade' }),

        // When the category was assigned to the post
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
    },
    (table) => [
        // Unique constraint prevents duplicate category assignments
        uniqueIndex('post_category_links_unique_idx').on(table.postId, table.categoryId),

        // Get all categories for a post
        index('post_category_links_post_id_idx').on(table.postId),

        // Get all posts in a category
        index('post_category_links_category_id_idx').on(table.categoryId),
    ],
);

export type PostCategoryLinkType = typeof postCategoryLinksTable.$inferSelect;
export type NewPostCategoryLinkType = typeof postCategoryLinksTable.$inferInsert;
