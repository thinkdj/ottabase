/**
 * PostTagLink table schema - junction table for Post <-> PostTag many-to-many
 */
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { postsTable } from './Post.schema';
import { postTagsTable } from './PostTag.schema';

export const postTagLinksTable = sqliteTable(
    'post_tag_links',
    {
        postId: text('post_id')
            .notNull()
            .references(() => postsTable.id, { onDelete: 'cascade' }),

        tagId: text('tag_id')
            .notNull()
            .references(() => postTagsTable.id, { onDelete: 'cascade' }),

        // When the tag was added to the post
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
    },
    (table) => [
        // Composite primary key prevents duplicate tag assignments
        primaryKey({ columns: [table.postId, table.tagId] }),

        // Get all tags for a post
        index('post_tag_links_post_id_idx').on(table.postId),

        // Get all posts with a tag
        index('post_tag_links_tag_id_idx').on(table.tagId),
    ],
);

export type PostTagLinkType = typeof postTagLinksTable.$inferSelect;
export type NewPostTagLinkType = typeof postTagLinksTable.$inferInsert;
